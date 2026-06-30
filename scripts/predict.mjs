/**
 * scripts/predict.mjs
 *
 * Standalone predictor — uses SQLite in-memory (no MySQL server required).
 * Works on any CSV matching the no_flags.csv 9-column schema.
 *
 * Usage:
 *   node scripts/predict.mjs [path/to/no_flags.csv]
 *
 * Defaults to: scripts/data/synthetic_cost_benchmarking_100_scenarios_no_flags.csv
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

// Accept CSV path as CLI arg, default to the synthetic benchmark file
const CSV_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, 'scripts', 'data',
      'synthetic_cost_benchmarking_100_scenarios_no_flags.csv');

// ─── Column mapping ───────────────────────────────────────────────────────────

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

const fmt = n => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);

// ─── Task 1 — seed in-memory SQLite ──────────────────────────────────────────

function seedDatabase(db, rows) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scenario_costs (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      scenario_id        INTEGER NOT NULL,
      row_type           TEXT NOT NULL CHECK(row_type IN ('Baseline','Forecast')),
      substructures      INTEGER NOT NULL,
      ts_deck_structure  INTEGER NOT NULL,
      ts_prod_facilities INTEGER NOT NULL,
      pipeline           INTEGER NOT NULL,
      cert_and_permit    INTEGER NOT NULL,
      general_support    INTEGER NOT NULL,
      total_cost_sum     INTEGER NOT NULL
    );
  `);

  const insert = db.prepare(`
    INSERT INTO scenario_costs
      (scenario_id, row_type, substructures, ts_deck_structure,
       ts_prod_facilities, pipeline, cert_and_permit, general_support, total_cost_sum)
    VALUES (?,?,?,?,?,?,?,?,?)
  `);

  const insertMany = db.transaction(rows => {
    for (const r of rows) insert.run(
      Number(r['scenario_id']),   r['row_type'],
      Number(r['Substructures']), Number(r['TS Deck Structure']),
      Number(r['TS Prod. Facilities']), Number(r['Pipeline']),
      Number(r['Cert. & Permit']),Number(r['General Support']),
      Number(r['Total Cost Sum'])
    );
  });
  insertMany(rows);
  console.log(`  ✔ Loaded ${rows.length} rows into in-memory SQLite`);
}

// ─── Task 2 — flagScenarios ───────────────────────────────────────────────────

function flagScenarios(db) {
  const rows = db.prepare(`
    SELECT scenario_id, row_type,
           substructures, ts_deck_structure, ts_prod_facilities,
           pipeline, cert_and_permit, general_support, total_cost_sum
    FROM   scenario_costs
    ORDER  BY scenario_id, CASE row_type WHEN 'Baseline' THEN 0 ELSE 1 END
  `).all();

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

  return predictions;
}

// ─── Pretty printer ───────────────────────────────────────────────────────────

function printResults(predictions) {
  const flagCount   = { 'Within Normal Range': 0, 'Outlier': 0, 'Unprecedented': 0 };
  const driverCount = {};

  console.log('\n' + '═'.repeat(100));
  console.log(
    ' SID  │ Dominant Driver          │ Flag                   │ Total Δ%   │ Max Comp Δ% │ Baseline Total     │ Forecast Total'
  );
  console.log('─'.repeat(100));

  for (const p of predictions) {
    flagCount[p.historical_flag]++;
    driverCount[p.dominant_driver] = (driverCount[p.dominant_driver] || 0) + 1;

    const icon = p.historical_flag === 'Unprecedented' ? '🔴'
               : p.historical_flag === 'Outlier'       ? '🟡' : '🟢';

    console.log(
      ` ${String(p.scenario_id).padStart(3)}  │ ` +
      `${p.dominant_driver.padEnd(24)} │ ` +
      `${icon} ${p.historical_flag.padEnd(21)} │ ` +
      `${(p.totalPctDev + '%').padStart(9)} │ ` +
      `${(p.maxCompPct  + '%').padStart(11)} │ ` +
      `${fmt(p.baseTotal).padStart(18)} │ ` +
      `${fmt(p.fcastTotal)}`
    );
  }
  console.log('═'.repeat(100));

  // ── Summary tallies ────────────────────────────────────────────────────────
  console.log('\n── Historical Flag Distribution ──────────────────────────────────────────');
  for (const [flag, count] of Object.entries(flagCount)) {
    const bar  = '█'.repeat(count);
    const icon = flag === 'Unprecedented' ? '🔴' : flag === 'Outlier' ? '🟡' : '🟢';
    console.log(`  ${icon} ${flag.padEnd(22)} : ${String(count).padStart(3)}  ${bar}`);
  }

  console.log('\n── Dominant Driver Frequency ─────────────────────────────────────────────');
  for (const [driver, count] of Object.entries(driverCount).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${driver.padEnd(26)} : ${String(count).padStart(3)}  ${'█'.repeat(count)}`);
  }

  // ── Full JSON dump ─────────────────────────────────────────────────────────
  console.log('\n── Full Predictions (JSON) ───────────────────────────────────────────────');
  console.log(JSON.stringify(predictions.map(
    ({ scenario_id, dominant_driver, historical_flag, totalPctDev, maxCompPct }) => ({
      scenario_id, dominant_driver, historical_flag,
      total_pct_deviation        : totalPctDev,
      max_component_pct_deviation: maxCompPct,
    })
  ), null, 2));
}

// ─── main ─────────────────────────────────────────────────────────────────────

function main() {
  const csvLabel = path.relative(ROOT, CSV_PATH);
  console.log(`\n━━━ predict.mjs — loading: ${csvLabel} ━━━`);

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`  ✖ File not found: ${CSV_PATH}`);
    process.exit(1);
  }

  const rows = parseCsv(CSV_PATH);
  console.log(`  ✔ Parsed ${rows.length} CSV rows`);

  console.log('\n━━━ Task 1: seedDatabase (in-memory SQLite) ━━━');
  const db = new Database(':memory:');
  seedDatabase(db, rows);

  console.log('\n━━━ Task 2: flagScenarios ━━━');
  const predictions = flagScenarios(db);
  console.log(`  ✔ Produced predictions for ${predictions.length} scenarios`);

  console.log('\n━━━ Results ━━━');
  printResults(predictions);

  db.close();
}

main();
