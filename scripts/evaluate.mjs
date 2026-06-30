/**
 * scripts/evaluate.mjs
 *
 * Task 1  – seedDatabase()   : Creates MySQL tables & seeds from CSV
 * Task 2  – flagScenarios()  : Deterministic flagging from scenario_costs
 * Task 3  – evaluateMetrics(): Precision / Recall / F1 vs ground truth
 *
 * Auto-detects mode:
 *   • If scenario_flags table has rows → full evaluation (P/R/F1)
 *   • Otherwise                        → predict-only (pretty table + JSON)
 *
 * Usage:
 *   node scripts/evaluate.mjs [path/to/no_flags.csv]
 *
 * Credentials via .env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)
 */

import 'dotenv/config';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

// ─── DB config from .env ──────────────────────────────────────────────────────
const DB_CONFIG = {
  host              : process.env.DB_HOST     || '127.0.0.1',
  port              : Number(process.env.DB_PORT || 3306),
  user              : process.env.DB_USER     || 'root',
  password          : process.env.DB_PASSWORD || '',
  database          : process.env.DB_NAME     || 'skk_migas',
  multipleStatements: true,
};

// ─── CSV path: CLI arg → default no_flags.csv ────────────────────────────────
const NO_FLAGS_CSV = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, 'scripts', 'data', 'no_flags.csv');

const WITH_FLAGS_CSV = path.join(ROOT, 'scripts', 'data', 'with_flags.csv');

// ─── Column map: CSV header ↔ DB column ↔ display label ──────────────────────
const COST_COLS = [
  { csv: 'Substructures',       db: 'substructures',       label: 'Substructures'       },
  { csv: 'TS Deck Structure',   db: 'ts_deck_structure',   label: 'TS Deck Structure'   },
  { csv: 'TS Prod. Facilities', db: 'ts_prod_facilities',  label: 'TS Prod. Facilities' },
  { csv: 'Pipeline',            db: 'pipeline',            label: 'Pipeline'            },
  { csv: 'Cert. & Permit',      db: 'cert_and_permit',     label: 'Cert. & Permit'      },
  { csv: 'General Support',     db: 'general_support',     label: 'General Support'     },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCsv(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8')
    .split('\n').map(l => l.trim()).filter(Boolean);
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const parts = line.split(',');
    const obj   = {};
    headers.forEach((h, i) => { obj[h] = (parts[i] || '').trim(); });
    return obj;
  });
}

const r2  = n => Math.round(n * 100) / 100;
const fmt = n => new Intl.NumberFormat('en-US').format(n);

// ─────────────────────────────────────────────────────────────────────────────
// Task 1 — seedDatabase
// ─────────────────────────────────────────────────────────────────────────────

async function seedDatabase(conn) {
  console.log('\n━━━ Task 1: seedDatabase ━━━');

  await conn.query(`
    CREATE TABLE IF NOT EXISTS scenario_costs (
      id                 INT AUTO_INCREMENT PRIMARY KEY,
      scenario_id        INT  NOT NULL,
      row_type           ENUM('Baseline','Forecast') NOT NULL,
      substructures      BIGINT NOT NULL,
      ts_deck_structure  BIGINT NOT NULL,
      ts_prod_facilities BIGINT NOT NULL,
      pipeline           BIGINT NOT NULL,
      cert_and_permit    BIGINT NOT NULL,
      general_support    BIGINT NOT NULL,
      total_cost_sum     BIGINT NOT NULL
    );
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS scenario_flags (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      scenario_id     INT  NOT NULL UNIQUE,
      dominant_driver VARCHAR(50) NOT NULL,
      historical_flag ENUM('Within Normal Range','Outlier','Unprecedented') NOT NULL
    );
  `);

  await conn.query('TRUNCATE TABLE scenario_costs;');
  await conn.query('TRUNCATE TABLE scenario_flags;');

  // ── Seed scenario_costs from the provided no_flags CSV ────────────────────
  const noFlagRows  = parseCsv(NO_FLAGS_CSV);
  const costInserts = noFlagRows.map(r => [
    Number(r['scenario_id']), r['row_type'],
    Number(r['Substructures']),       Number(r['TS Deck Structure']),
    Number(r['TS Prod. Facilities']), Number(r['Pipeline']),
    Number(r['Cert. & Permit']),      Number(r['General Support']),
    Number(r['Total Cost Sum']),
  ]);
  await conn.query(
    `INSERT INTO scenario_costs
       (scenario_id, row_type, substructures, ts_deck_structure,
        ts_prod_facilities, pipeline, cert_and_permit, general_support, total_cost_sum)
     VALUES ?`,
    [costInserts]
  );
  console.log(`  ✔ scenario_costs  : ${costInserts.length} rows inserted`);

  // ── Seed scenario_flags from with_flags.csv only if the file exists ────────
  if (fs.existsSync(WITH_FLAGS_CSV)) {
    const withFlagRows = parseCsv(WITH_FLAGS_CSV);
    const flagInserts  = withFlagRows
      .filter(r => r['row_type'] === 'Forecast' && r['historical_flag'])
      .map(r => [Number(r['scenario_id']), r['dominant_driver'], r['historical_flag']]);

    if (flagInserts.length > 0) {
      await conn.query(
        `INSERT INTO scenario_flags (scenario_id, dominant_driver, historical_flag) VALUES ?`,
        [flagInserts]
      );
      console.log(`  ✔ scenario_flags  : ${flagInserts.length} rows inserted`);
    }
  } else {
    console.log('  ℹ  with_flags.csv not found — scenario_flags left empty (predict-only mode)');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 2 — flagScenarios
// ─────────────────────────────────────────────────────────────────────────────

async function flagScenarios(conn) {
  console.log('\n━━━ Task 2: flagScenarios ━━━');

  const [rows] = await conn.query(`
    SELECT scenario_id, row_type,
           substructures, ts_deck_structure, ts_prod_facilities,
           pipeline, cert_and_permit, general_support, total_cost_sum
    FROM   scenario_costs
    ORDER  BY scenario_id, FIELD(row_type,'Baseline','Forecast')
  `);

  const scenarios = {};
  for (const row of rows) {
    if (!scenarios[row.scenario_id]) scenarios[row.scenario_id] = {};
    scenarios[row.scenario_id][row.row_type.toLowerCase()] = row;
  }

  const predictions = [];

  for (const [sid, { baseline, forecast }] of Object.entries(scenarios)) {
    if (!baseline || !forecast) {
      console.warn(`  ⚠ scenario ${sid}: incomplete pair, skipped`);
      continue;
    }

    // Dominant driver: highest |forecast - baseline|
    let maxAbsVar = -Infinity, dominantDriver = null;
    const compDetails = [];

    for (const { db: col, label } of COST_COLS) {
      const absVar     = Math.abs(forecast[col] - baseline[col]);
      const compPctDev = ((forecast[col] - baseline[col]) / baseline[col]) * 100;
      compDetails.push({ label, absVar, compPctDev });
      if (absVar > maxAbsVar) { maxAbsVar = absVar; dominantDriver = label; }
    }

    // Historical flag
    const totalPctDev = ((forecast.total_cost_sum - baseline.total_cost_sum) / baseline.total_cost_sum) * 100;
    const maxCompPct  = Math.max(...compDetails.map(c => c.compPctDev));

    const historicalFlag =
      totalPctDev > 25 || maxCompPct > 35 ? 'Unprecedented'
      : totalPctDev > 10                  ? 'Outlier'
      :                                     'Within Normal Range';

    predictions.push({
      scenario_id    : Number(sid),
      dominant_driver: dominantDriver,
      historical_flag: historicalFlag,
      totalPctDev    : +totalPctDev.toFixed(2),
      maxCompPct     : +maxCompPct.toFixed(2),
      baseTotal      : baseline.total_cost_sum,
      fcastTotal     : forecast.total_cost_sum,
    });
  }

  console.log(`  ✔ Produced predictions for ${predictions.length} scenarios`);
  return predictions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 3 — evaluateMetrics
// ─────────────────────────────────────────────────────────────────────────────

async function evaluateMetrics(conn) {
  console.log('\n━━━ Task 3: evaluateMetrics ━━━');

  const predictions = await flagScenarios(conn);

  const [truthRows] = await conn.query(
    'SELECT scenario_id, dominant_driver, historical_flag FROM scenario_flags'
  );
  const truth = {};
  for (const r of truthRows) truth[r.scenario_id] = r;

  let dd_tp = 0, dd_fp = 0, dd_fn = 0;
  const mismatches = [];

  const FLAG_CLASSES = ['Within Normal Range', 'Outlier', 'Unprecedented'];
  const flagCounters = {};
  for (const cls of FLAG_CLASSES) flagCounters[cls] = { tp: 0, fp: 0, fn: 0 };

  for (const pred of predictions) {
    const gt = truth[pred.scenario_id];
    if (!gt) { console.warn(`  ⚠ No ground truth for scenario_id ${pred.scenario_id}`); continue; }

    if (pred.dominant_driver === gt.dominant_driver) {
      dd_tp++;
    } else {
      dd_fp++; dd_fn++;
      mismatches.push(
        `MISMATCH [scenario_id: ${pred.scenario_id}] dominant_driver: ` +
        `predicted=${pred.dominant_driver} actual=${gt.dominant_driver}`
      );
    }

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

  const prf = (tp, fp, fn) => {
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall    = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
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

  const results = {
    dominantDriver: {
      precision: ddMetrics.precision, recall: ddMetrics.recall, f1: ddMetrics.f1,
      truePositives: dd_tp, falsePositives: dd_fp, falseNegatives: dd_fn,
    },
    historicalFlag: {
      withinNormalRange: flagMetrics.withinNormalRange,
      outlier          : flagMetrics.outlier,
      unprecedented    : flagMetrics.unprecedented,
      macroF1          : r2(macroF1Sum / FLAG_CLASSES.length),
    },
  };

  if (mismatches.length === 0) {
    console.log('\n  ✔ No mismatches — all predictions matched ground truth!');
  } else {
    console.log(`\n  ⚠ ${mismatches.length} mismatch(es):\n`);
    mismatches.forEach(m => console.log(' ', m));
  }

  console.log('\n── Evaluation Results ──────────────────────────────────────');
  console.log(JSON.stringify(results, null, 2));
  console.log('────────────────────────────────────────────────────────────');

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Predict-only output (no ground truth)
// ─────────────────────────────────────────────────────────────────────────────

function printPredictions(predictions) {
  const flagCount   = { 'Within Normal Range': 0, 'Outlier': 0, 'Unprecedented': 0 };
  const driverCount = {};

  console.log('\n' + '═'.repeat(72));
  console.log(' SID  │ Dominant Driver          │ Flag                   │ Total Δ%');
  console.log('─'.repeat(72));

  for (const p of predictions) {
    flagCount[p.historical_flag]++;
    driverCount[p.dominant_driver] = (driverCount[p.dominant_driver] || 0) + 1;
    const icon = p.historical_flag === 'Unprecedented' ? '🔴'
               : p.historical_flag === 'Outlier'       ? '🟡' : '🟢';
    console.log(
      ` ${String(p.scenario_id).padStart(3)}  │ ` +
      `${p.dominant_driver.padEnd(24)} │ ` +
      `${icon} ${p.historical_flag.padEnd(21)} │ ${String(p.totalPctDev + '%').padStart(8)}`
    );
  }
  console.log('═'.repeat(72));

  console.log('\n── Historical Flag Distribution ──────────────────────────────────────');
  for (const [flag, count] of Object.entries(flagCount)) {
    const icon = flag === 'Unprecedented' ? '🔴' : flag === 'Outlier' ? '🟡' : '🟢';
    console.log(`  ${icon} ${flag.padEnd(22)} : ${String(count).padStart(3)}  ${'█'.repeat(count)}`);
  }

  console.log('\n── Dominant Driver Frequency ─────────────────────────────────────────');
  for (const [driver, count] of Object.entries(driverCount).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${driver.padEnd(26)} : ${String(count).padStart(3)}  ${'█'.repeat(count)}`);
  }

  console.log('\n── Full Predictions (JSON) ───────────────────────────────────────────');
  console.log(JSON.stringify(predictions.map(({ scenario_id, dominant_driver, historical_flag, totalPctDev, maxCompPct }) => ({
    scenario_id, dominant_driver, historical_flag,
    total_pct_deviation: totalPctDev,
    max_component_pct_deviation: maxCompPct,
  })), null, 2));
}

// ─────────────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const csvLabel = path.relative(ROOT, NO_FLAGS_CSV);
  console.log(`\n━━━ evaluate.mjs — source: ${csvLabel} ━━━`);

  let conn;
  try {
    // 1. Create DB if needed
    const initConn = await mysql.createConnection({
      host: DB_CONFIG.host, port: DB_CONFIG.port,
      user: DB_CONFIG.user, password: DB_CONFIG.password,
    });
    await initConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    await initConn.end();

    conn = await mysql.createConnection(DB_CONFIG);

    // 2. Seed tables
    await seedDatabase(conn);

    // 3. Detect mode
    const [[{ cnt }]] = await conn.query('SELECT COUNT(*) AS cnt FROM scenario_flags');
    if (cnt > 0) {
      console.log(`\n  ℹ  Ground-truth labels found (${cnt} rows) — running full evaluation`);
      await evaluateMetrics(conn);
    } else {
      console.log('\n  ℹ  No ground-truth labels — running predict-only mode');
      const predictions = await flagScenarios(conn);
      printPredictions(predictions);
    }

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
