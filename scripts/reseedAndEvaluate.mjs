/**
 * scripts/reseedAndEvaluate.mjs
 *
 * 1. TRUNCATE scenario_costs and scenario_flags
 * 2. Reseed scenario_costs from every row in the CSV (all 200 rows — Baseline + Forecast)
 * 3. Reseed scenario_flags from Forecast rows with non-empty dominant_driver / historical_flag
 * 4. Run evaluateMetrics() — VEDA deterministic output vs CSV ground truth
 *    Logs all mismatches as: MISMATCH [scenario_id: X] field: predicted=Y actual=Z
 *
 * Usage:
 *   node scripts/reseedAndEvaluate.mjs [path/to/csv]
 *   Default CSV: scripts/data/synthetic_cost_benchmarking_100_scenarios.csv
 *
 * Credentials via .env
 */

import 'dotenv/config';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

const DB_CONFIG = {
  host              : process.env.DB_HOST     || '127.0.0.1',
  port              : Number(process.env.DB_PORT || 3306),
  user              : process.env.DB_USER     || 'root',
  password          : process.env.DB_PASSWORD || '',
  database          : process.env.DB_NAME     || 'skk_migas',
  multipleStatements: true,
};

const CSV_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, 'scripts', 'data', 'synthetic_cost_benchmarking_100_scenarios.csv');

// ─── Column map ───────────────────────────────────────────────────────────────
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

// ─── CSV parser — handles CRLF and trailing empty fields ─────────────────────
function parseCsv(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const headers = lines[0].split(',').map(h => h.trim());

  return lines.slice(1).map(line => {
    const parts = line.split(',');
    const obj   = {};
    headers.forEach((h, i) => {
      obj[h] = (parts[i] !== undefined ? parts[i] : '').trim();
    });
    return obj;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 + 2 + 3  — truncate & reseed both tables from CSV
// ─────────────────────────────────────────────────────────────────────────────

async function reseed(conn, rows) {
  console.log('\n━━━ Step 1: Truncate both tables ━━━');
  await conn.query('SET FOREIGN_KEY_CHECKS = 0;');
  await conn.query('TRUNCATE TABLE scenario_costs;');
  await conn.query('TRUNCATE TABLE scenario_flags;');
  await conn.query('SET FOREIGN_KEY_CHECKS = 1;');
  console.log('  ✔ scenario_costs  — truncated');
  console.log('  ✔ scenario_flags  — truncated');

  // ── scenario_costs: every row (Baseline + Forecast) ──────────────────────
  console.log('\n━━━ Step 2: Reseed scenario_costs ━━━');
  const costInserts = rows.map(r => [
    Number(r['scenario_id']),
    r['row_type'],
    Number(r['Substructures']),
    Number(r['TS Deck Structure']),
    Number(r['TS Prod. Facilities']),
    Number(r['Pipeline']),
    Number(r['Cert. & Permit']),
    Number(r['General Support']),
    Number(r['Total Cost Sum']),
  ]);

  await conn.query(
    `INSERT INTO scenario_costs
       (scenario_id, row_type, substructures, ts_deck_structure,
        ts_prod_facilities, pipeline, cert_and_permit, general_support, total_cost_sum)
     VALUES ?`,
    [costInserts]
  );
  console.log(`  ✔ scenario_costs  — ${costInserts.length} rows inserted (Baseline + Forecast)`);

  // ── scenario_flags: Forecast rows with non-empty labels only ─────────────
  console.log('\n━━━ Step 3: Reseed scenario_flags ━━━');
  const flagInserts = rows
    .filter(r =>
      r['row_type'] === 'Forecast' &&
      r['dominant_driver'] !== '' &&
      r['historical_flag'] !== ''
    )
    .map(r => [
      Number(r['scenario_id']),
      r['dominant_driver'],
      r['historical_flag'],
    ]);

  if (flagInserts.length === 0) {
    throw new Error('No Forecast rows with non-empty flags found — check CSV format');
  }

  await conn.query(
    `INSERT INTO scenario_flags (scenario_id, dominant_driver, historical_flag) VALUES ?`,
    [flagInserts]
  );
  console.log(`  ✔ scenario_flags  — ${flagInserts.length} rows inserted (CSV ground truth, verbatim)`);

  // Distribution snapshot
  const dist = { 'Within Normal Range': 0, 'Outlier': 0, 'Unprecedented': 0 };
  for (const [, , flag] of flagInserts) dist[flag] = (dist[flag] || 0) + 1;
  console.log('\n  Ground truth distribution from CSV:');
  for (const [flag, count] of Object.entries(dist)) {
    const icon = flag === 'Unprecedented' ? '🔴' : flag === 'Outlier' ? '🟡' : '🟢';
    console.log(`    ${icon} ${flag.padEnd(22)} : ${count}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VEDA flagScenarios — deterministic predictions from scenario_costs
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
    if (!baseline || !forecast) {
      console.warn(`  ⚠  scenario ${sid}: incomplete pair, skipped`);
      continue;
    }

    // Dominant driver: component with highest absolute variance
    let maxAbsVar = -Infinity, dominantDriver = null;
    const compDetails = [];

    for (const { db: col, label } of COST_COLS) {
      const absVar     = Math.abs(forecast[col] - baseline[col]);
      const compPctDev = ((forecast[col] - baseline[col]) / baseline[col]) * 100;
      compDetails.push({ label, absVar, compPctDev });
      if (absVar > maxAbsVar) { maxAbsVar = absVar; dominantDriver = label; }
    }

    // Historical flag — strict priority order
    const totalPctDev = ((forecast.total_cost_sum - baseline.total_cost_sum) / baseline.total_cost_sum) * 100;
    const maxCompPct  = Math.max(...compDetails.map(c => c.compPctDev));

    let historicalFlag;
    if (maxCompPct > 35) {
      historicalFlag = 'Unprecedented';   // Priority 1: any component > 35%
    } else if (totalPctDev > 25) {
      historicalFlag = 'Unprecedented';   // Priority 2: total > 25%
    } else if (totalPctDev > 10) {
      historicalFlag = 'Outlier';         // Priority 3: total > 10%
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

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — evaluateMetrics
// ─────────────────────────────────────────────────────────────────────────────

async function evaluateMetrics(conn) {
  console.log('\n━━━ Step 4: evaluateMetrics (VEDA vs CSV ground truth) ━━━');

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

  // ── P / R / F1 ────────────────────────────────────────────────────────────
  const prf = (tp, fp, fn) => {
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall    = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1        = precision + recall > 0
      ? 2 * precision * recall / (precision + recall) : 0;
    return { precision: r2(precision), recall: r2(recall), f1: r2(f1) };
  };

  const ddM = prf(dd_tp, dd_fp, dd_fn);

  const flagMetrics = {};
  let macroF1Sum = 0, classesWithSupport = 0;

  for (const cls of FLAG_CLASSES) {
    const { tp, fp, fn } = flagCounters[cls];
    const support = tp + fn;  // total actual instances of this class
    const m = prf(tp, fp, fn);
    const key = cls === 'Within Normal Range' ? 'withinNormalRange'
              : cls === 'Outlier'             ? 'outlier'
              :                                  'unprecedented';
    flagMetrics[key] = { ...m, support };
    if (support > 0) { macroF1Sum += m.f1; classesWithSupport++; }
  }

  // Macro-F1 computed only over classes that have at least one ground-truth instance
  const macroF1 = classesWithSupport > 0 ? r2(macroF1Sum / classesWithSupport) : 0;

  // ── Mismatch report ───────────────────────────────────────────────────────
  console.log('');
  if (mismatches.length === 0) {
    console.log('  ✔ No mismatches — VEDA and CSV ground truth agree on all scenarios.');
  } else {
    console.log(`  ⚠  ${mismatches.length} mismatch(es):\n`);
    mismatches.forEach(m => console.log('  ' + m));
  }

  // ── Results ───────────────────────────────────────────────────────────────
  const results = {
    dominantDriver: {
      precision    : ddM.precision,
      recall       : ddM.recall,
      f1           : ddM.f1,
      truePositives: dd_tp,
      falsePositives: dd_fp,
      falseNegatives: dd_fn,
    },
    historicalFlag: {
      withinNormalRange: flagMetrics.withinNormalRange,
      outlier          : flagMetrics.outlier,
      unprecedented    : flagMetrics.unprecedented,
      macroF1_supportOnly: macroF1,
    },
  };

  console.log('\n── Evaluation Results ──────────────────────────────────────────────────');
  console.log(JSON.stringify(results, null, 2));
  console.log('────────────────────────────────────────────────────────────────────────');

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const csvLabel = path.relative(ROOT, CSV_PATH);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  reseedAndEvaluate.mjs');
  console.log(`  Source CSV: ${csvLabel}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`\n  ✖ CSV not found: ${CSV_PATH}`);
    process.exit(1);
  }

  const rows = parseCsv(CSV_PATH);
  console.log(`\n  ✔ Parsed ${rows.length} rows from CSV`);

  let conn;
  try {
    const initConn = await mysql.createConnection({
      host: DB_CONFIG.host, port: DB_CONFIG.port,
      user: DB_CONFIG.user, password: DB_CONFIG.password,
    });
    await initConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    await initConn.end();

    conn = await mysql.createConnection(DB_CONFIG);

    await reseed(conn, rows);
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
