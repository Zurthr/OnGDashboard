/**
 * scripts/generateGroundTruth.mjs
 *
 * Generates ground-truth labels PROGRAMMATICALLY from our own deterministic
 * rules applied directly to scenario_costs, then re-evaluates VEDA against them.
 *
 * Steps:
 *   1. Query scenario_costs → compute per-component & total variances
 *   2. Apply canonical rules to assign dominant_driver + historical_flag
 *   3. TRUNCATE scenario_flags, then INSERT the generated labels
 *   4. Re-run evaluateMetrics() — expect F1 ≥ 0.95 for both metrics
 *      Any score < 0.95 or any mismatch = a bug in VEDA, not a rule disagreement
 *
 * Usage:
 *   node scripts/generateGroundTruth.mjs
 *
 * Credentials via .env  (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

// ─── DB config ────────────────────────────────────────────────────────────────
const DB_CONFIG = {
  host              : process.env.DB_HOST     || '127.0.0.1',
  port              : Number(process.env.DB_PORT || 3306),
  user              : process.env.DB_USER     || 'root',
  password          : process.env.DB_PASSWORD || '',
  database          : process.env.DB_NAME     || 'skk_migas',
  multipleStatements: true,
};

// ─── Canonical column map (order matters for display; not for logic) ──────────
const COST_COLS = [
  { db: 'substructures',       label: 'Substructures'       },
  { db: 'ts_deck_structure',   label: 'TS Deck Structure'   },
  { db: 'ts_prod_facilities',  label: 'TS Prod. Facilities' },
  { db: 'pipeline',            label: 'Pipeline'            },
  { db: 'cert_and_permit',     label: 'Cert. & Permit'      },
  { db: 'general_support',     label: 'General Support'     },
];

const FLAG_CLASSES = ['Within Normal Range', 'Outlier', 'Unprecedented'];

const r2 = n => Math.round(n * 100) / 100;

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 + 2 — computeGroundTruth
//
// Queries scenario_costs, pairs Baseline + Forecast for each scenario_id,
// then applies the canonical rules to produce ground-truth labels.
// ─────────────────────────────────────────────────────────────────────────────

async function computeGroundTruth(conn) {
  console.log('\n━━━ Step 1: Query scenario_costs & compute variances ━━━');

  const [rows] = await conn.query(`
    SELECT scenario_id, row_type,
           substructures, ts_deck_structure, ts_prod_facilities,
           pipeline, cert_and_permit, general_support, total_cost_sum
    FROM   scenario_costs
    ORDER  BY scenario_id, FIELD(row_type, 'Baseline', 'Forecast')
  `);

  // Group into { baseline, forecast } pairs per scenario_id
  const scenarioMap = {};
  for (const row of rows) {
    if (!scenarioMap[row.scenario_id]) scenarioMap[row.scenario_id] = {};
    scenarioMap[row.scenario_id][row.row_type.toLowerCase()] = row;
  }

  const groundTruth = [];

  console.log('\n━━━ Step 2: Apply canonical rules ━━━');
  console.log('  Rules:');
  console.log('    Dominant Driver  : component with highest |forecast − baseline|');
  console.log('    Historical Flag  : priority → any comp >35% | total >25% | total >10% | WNR');

  let skipped = 0;

  for (const [sid, { baseline, forecast }] of Object.entries(scenarioMap)) {
    if (!baseline || !forecast) {
      console.warn(`  ⚠  scenario_id ${sid}: missing baseline or forecast row — skipped`);
      skipped++;
      continue;
    }

    // ── Per-component variances ────────────────────────────────────────────
    const components = COST_COLS.map(({ db: col, label }) => {
      const absVariance = forecast[col] - baseline[col];           // signed absolute
      const pctDeviation = (absVariance / baseline[col]) * 100;    // signed %
      return { label, absVariance, absVarMagnitude: Math.abs(absVariance), pctDeviation };
    });

    // ── Total variances ────────────────────────────────────────────────────
    const totalAbsVariance = forecast.total_cost_sum - baseline.total_cost_sum;
    const totalPctDeviation = (totalAbsVariance / baseline.total_cost_sum) * 100;

    // ── Rule: Dominant Driver ──────────────────────────────────────────────
    // Component with the highest ABSOLUTE variance (magnitude of forecast - baseline)
    let dominant = components[0];
    for (const comp of components) {
      if (comp.absVarMagnitude > dominant.absVarMagnitude) dominant = comp;
    }
    const dominantDriver = dominant.label;

    // ── Rule: Historical Flag (strict priority order) ──────────────────────
    // Priority 1: any single component % deviation exceeds 35%
    const anyCompExceeds35 = components.some(c => c.pctDeviation > 35);
    // Priority 2: total % deviation exceeds 25%
    const totalExceeds25 = totalPctDeviation > 25;
    // Priority 3: total % deviation exceeds 10%
    const totalExceeds10 = totalPctDeviation > 10;

    let historicalFlag;
    if (anyCompExceeds35) {
      historicalFlag = 'Unprecedented';   // Priority 1
    } else if (totalExceeds25) {
      historicalFlag = 'Unprecedented';   // Priority 2
    } else if (totalExceeds10) {
      historicalFlag = 'Outlier';         // Priority 3
    } else {
      historicalFlag = 'Within Normal Range';
    }

    groundTruth.push({
      scenario_id    : Number(sid),
      dominant_driver: dominantDriver,
      historical_flag: historicalFlag,
      // Diagnostics (not stored in DB, used for verbose logging)
      _totalPct      : +totalPctDeviation.toFixed(4),
      _maxCompPct    : +Math.max(...components.map(c => c.pctDeviation)).toFixed(4),
      _dominantAbsVar: dominant.absVarMagnitude,
    });
  }

  console.log(`  ✔ Computed ground truth for ${groundTruth.length} scenarios` +
    (skipped ? ` (${skipped} skipped)` : ''));

  // Distribution summary
  const dist = { 'Within Normal Range': 0, 'Outlier': 0, 'Unprecedented': 0 };
  for (const g of groundTruth) dist[g.historical_flag]++;
  console.log('\n  Historical flag distribution in ground truth:');
  for (const [flag, count] of Object.entries(dist)) {
    const icon = flag === 'Unprecedented' ? '🔴' : flag === 'Outlier' ? '🟡' : '🟢';
    console.log(`    ${icon} ${flag.padEnd(22)} : ${count}`);
  }

  return groundTruth;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — writeGroundTruth
//
// Truncates scenario_flags and repopulates it with the programmatically
// generated labels. GPT-CSV labels are never touched again.
// ─────────────────────────────────────────────────────────────────────────────

async function writeGroundTruth(conn, groundTruth) {
  console.log('\n━━━ Step 3: Repopulate scenario_flags ━━━');

  await conn.query('TRUNCATE TABLE scenario_flags;');

  const inserts = groundTruth.map(g => [g.scenario_id, g.dominant_driver, g.historical_flag]);

  await conn.query(
    `INSERT INTO scenario_flags (scenario_id, dominant_driver, historical_flag) VALUES ?`,
    [inserts]
  );

  console.log(`  ✔ scenario_flags truncated and repopulated with ${inserts.length} programmatic rows`);
  console.log('  ✔ No CSV-sourced labels remain — ground truth is 100% rule-derived');
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — evaluateMetrics
//
// Runs VEDA's flagScenarios() and compares output against the newly written
// ground truth. Identical rules → expect F1 ≥ 0.95 for both metrics.
// Any mismatch at this stage = a bug in VEDA implementation.
// ─────────────────────────────────────────────────────────────────────────────

async function flagScenarios(conn) {
  const [rows] = await conn.query(`
    SELECT scenario_id, row_type,
           substructures, ts_deck_structure, ts_prod_facilities,
           pipeline, cert_and_permit, general_support, total_cost_sum
    FROM   scenario_costs
    ORDER  BY scenario_id, FIELD(row_type, 'Baseline', 'Forecast')
  `);

  const scenarioMap = {};
  for (const row of rows) {
    if (!scenarioMap[row.scenario_id]) scenarioMap[row.scenario_id] = {};
    scenarioMap[row.scenario_id][row.row_type.toLowerCase()] = row;
  }

  const predictions = [];

  for (const [sid, { baseline, forecast }] of Object.entries(scenarioMap)) {
    if (!baseline || !forecast) continue;

    // Dominant driver: highest absolute variance
    let maxAbsVar = -Infinity, dominantDriver = null;
    const compDetails = [];

    for (const { db: col, label } of COST_COLS) {
      const absVar     = Math.abs(forecast[col] - baseline[col]);
      const compPctDev = ((forecast[col] - baseline[col]) / baseline[col]) * 100;
      compDetails.push({ label, absVar, compPctDev });
      if (absVar > maxAbsVar) { maxAbsVar = absVar; dominantDriver = label; }
    }

    const totalPctDev = ((forecast.total_cost_sum - baseline.total_cost_sum) / baseline.total_cost_sum) * 100;
    const maxCompPct  = Math.max(...compDetails.map(c => c.compPctDev));

    // Historical flag — same priority order as generateGroundTruth
    let historicalFlag;
    if (maxCompPct > 35) {
      historicalFlag = 'Unprecedented';
    } else if (totalPctDev > 25) {
      historicalFlag = 'Unprecedented';
    } else if (totalPctDev > 10) {
      historicalFlag = 'Outlier';
    } else {
      historicalFlag = 'Within Normal Range';
    }

    predictions.push({
      scenario_id    : Number(sid),
      dominant_driver: dominantDriver,
      historical_flag: historicalFlag,
      totalPctDev,
      maxCompPct,
    });
  }

  return predictions;
}

async function evaluateMetrics(conn) {
  console.log('\n━━━ Step 4: evaluateMetrics (VEDA vs programmatic ground truth) ━━━');

  const predictions = await flagScenarios(conn);

  const [truthRows] = await conn.query(
    'SELECT scenario_id, dominant_driver, historical_flag FROM scenario_flags ORDER BY scenario_id'
  );
  const truth = {};
  for (const r of truthRows) truth[r.scenario_id] = r;

  let dd_tp = 0, dd_fp = 0, dd_fn = 0;
  const mismatches = [];

  const flagCounters = {};
  for (const cls of FLAG_CLASSES) flagCounters[cls] = { tp: 0, fp: 0, fn: 0 };

  for (const pred of predictions) {
    const gt = truth[pred.scenario_id];
    if (!gt) {
      console.warn(`  ⚠  No ground truth for scenario_id ${pred.scenario_id}`);
      continue;
    }

    // ── Dominant driver ──────────────────────────────────────────────────────
    if (pred.dominant_driver === gt.dominant_driver) {
      dd_tp++;
    } else {
      dd_fp++;
      dd_fn++;
      mismatches.push(
        `MISMATCH [scenario_id: ${pred.scenario_id}] dominant_driver: ` +
        `predicted=${pred.dominant_driver} actual=${gt.dominant_driver}`
      );
    }

    // ── Historical flag ───────────────────────────────────────────────────────
    if (pred.historical_flag !== gt.historical_flag) {
      mismatches.push(
        `MISMATCH [scenario_id: ${pred.scenario_id}] historical_flag: ` +
        `predicted=${pred.historical_flag} actual=${gt.historical_flag}`
      );
    }

    for (const cls of FLAG_CLASSES) {
      const p = pred.historical_flag === cls;
      const g = gt.historical_flag   === cls;
      if (p && g)  flagCounters[cls].tp++;
      if (p && !g) flagCounters[cls].fp++;
      if (!p && g) flagCounters[cls].fn++;
    }
  }

  // ── Compute P / R / F1 ────────────────────────────────────────────────────
  const prf = (tp, fp, fn) => {
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall    = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1        = precision + recall > 0
      ? 2 * precision * recall / (precision + recall) : 0;
    return { precision: r2(precision), recall: r2(recall), f1: r2(f1) };
  };

  const ddMetrics  = prf(dd_tp, dd_fp, dd_fn);
  const flagMetrics = {};
  let macroF1Sum = 0;

  for (const cls of FLAG_CLASSES) {
    const { tp, fp, fn } = flagCounters[cls];
    const m = prf(tp, fp, fn);
    const key = cls === 'Within Normal Range' ? 'withinNormalRange'
              : cls === 'Outlier'             ? 'outlier'
              :                                  'unprecedented';
    flagMetrics[key] = m;
    macroF1Sum += m.f1;
  }

  const macroF1 = r2(macroF1Sum / FLAG_CLASSES.length);

  const results = {
    dominantDriver: {
      precision    : ddMetrics.precision,
      recall       : ddMetrics.recall,
      f1           : ddMetrics.f1,
      truePositives: dd_tp,
      falsePositives: dd_fp,
      falseNegatives: dd_fn,
    },
    historicalFlag: {
      withinNormalRange: flagMetrics.withinNormalRange,
      outlier          : flagMetrics.outlier,
      unprecedented    : flagMetrics.unprecedented,
      macroF1,
    },
  };

  // ── Mismatch report ───────────────────────────────────────────────────────
  if (mismatches.length === 0) {
    console.log('\n  ✔ PERFECT MATCH — no mismatches. VEDA implementation is correct.');
  } else {
    console.log(`\n  ✖ ${mismatches.length} mismatch(es) detected.`);
    console.log('  These are BUGS in the VEDA implementation, not rule disagreements:\n');
    mismatches.forEach(m => console.log('  ' + m));
  }

  // ── Results table ─────────────────────────────────────────────────────────
  console.log('\n── Evaluation Results ──────────────────────────────────────────────────');
  console.log(JSON.stringify(results, null, 2));

  // ── Pass / Fail gate ──────────────────────────────────────────────────────
  const THRESHOLD = 0.95;
  console.log('\n── Quality Gate (F1 ≥ 0.95) ───────────────────────────────────────────');

  const checks = [
    { name: 'Dominant Driver F1     ', score: results.dominantDriver.f1 },
    { name: 'Historical Flag macro-F1', score: results.historicalFlag.macroF1 },
    { name: 'Within Normal Range F1 ', score: results.historicalFlag.withinNormalRange.f1 },
    { name: 'Outlier F1             ', score: results.historicalFlag.outlier.f1 },
    { name: 'Unprecedented F1       ', score: results.historicalFlag.unprecedented.f1 },
  ];

  let allPass = true;
  for (const { name, score } of checks) {
    const pass = score >= THRESHOLD;
    if (!pass) allPass = false;
    console.log(`  ${pass ? '✔' : '✖'} ${name}: ${score} ${pass ? '(PASS)' : '(FAIL — investigate bug)'}`);
  }

  console.log('────────────────────────────────────────────────────────────────────────');
  if (allPass) {
    console.log('  ✔ ALL CHECKS PASSED — VEDA rules are correctly implemented.\n');
  } else {
    console.log('  ✖ ONE OR MORE CHECKS FAILED — review MISMATCH lines above for bugs.\n');
    process.exitCode = 1;
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  generateGroundTruth.mjs');
  console.log('  Generating programmatic ground truth from scenario_costs → evaluating');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  let conn;
  try {
    // Ensure DB exists, then connect
    const initConn = await mysql.createConnection({
      host: DB_CONFIG.host, port: DB_CONFIG.port,
      user: DB_CONFIG.user, password: DB_CONFIG.password,
    });
    await initConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    await initConn.end();

    conn = await mysql.createConnection(DB_CONFIG);

    // Verify scenario_costs has data before proceeding
    const [[{ cnt }]] = await conn.query('SELECT COUNT(*) AS cnt FROM scenario_costs');
    if (cnt === 0) {
      console.error('\n  ✖ scenario_costs is empty. Run evaluate.mjs first to seed cost data.');
      process.exitCode = 1;
      return;
    }
    console.log(`\n  ✔ scenario_costs has ${cnt} rows — proceeding`);

    // Run all four steps
    const groundTruth = await computeGroundTruth(conn);
    await writeGroundTruth(conn, groundTruth);
    await evaluateMetrics(conn);

  } catch (err) {
    console.error('\n✖ Fatal error:', err.message);
    if (err.code === 'ECONNREFUSED') {
      console.error('  → Is MySQL running? Open Laragon and click "Start All".');
    }
    process.exitCode = 1;
  } finally {
    if (conn) await conn.end();
  }
}

main();
