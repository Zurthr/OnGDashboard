import Database from 'better-sqlite3'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

const dbDir = join(process.cwd(), 'server', 'database')
mkdirSync(dbDir, { recursive: true })

const dbPath = join(dbDir, 'database.sqlite3')

// Singleton: only ever open one connection for the life of the server process
let _afeDb: Database.Database | null = null

export function useAfeDb() {
  if (_afeDb) return _afeDb

  _afeDb = new Database(dbPath)
  _afeDb.pragma('journal_mode = WAL')   // better concurrent read/write behavior
  _afeDb.pragma('foreign_keys = ON')    // SQLite disables FK enforcement by default

  _afeDb.exec(`
    CREATE TABLE IF NOT EXISTS afe_records (
      afe_number                    TEXT PRIMARY KEY,
      project_type                  TEXT,
      water_depth                   REAL,
      water_depth_unit              TEXT,
      weight_topside                REAL,
      weight_jacket                 REAL,
      piling_weight                 REAL,
      number_of_legs                INTEGER,
      number_of_slots               INTEGER,
      topside_equipment_wellhead    TEXT,
      topside_equipment_processing  TEXT,
      topside_equipment_utilities   TEXT,
      impurities_h2s                REAL,
      impurities_co2                REAL,
      impurities_hg                 REAL,
      created_at                    TEXT DEFAULT (datetime('now')),
      updated_at                    TEXT DEFAULT (datetime('now'))
    );

    -- One row per (parameter, sub_parameter) as originally imported from
    -- curated_records.csv, in long format — preserved verbatim (including
    -- validation_status / notes) for the "Curated Data" tab. Separate from
    -- afe_records, which holds the pivoted, editable, one-row-per-AFE view.
    CREATE TABLE IF NOT EXISTS curated_raw_rows (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      afe_number         TEXT NOT NULL,
      parameter_name     TEXT NOT NULL,
      sub_parameter      TEXT,
      value              TEXT,
      unit               TEXT,
      validation_status  TEXT,
      notes              TEXT,
      filename           TEXT,
      json_path          TEXT,
      reference_context  TEXT,
      pages              TEXT,
      created_at         TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (afe_number) REFERENCES afe_records(afe_number) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS dlq_entries (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      afe_number          TEXT NOT NULL,
      parameter_name      TEXT NOT NULL,
      sub_parameter       TEXT,
      raw_value           TEXT,
      normalized_value    TEXT,
      failed_rule         TEXT,
      error_type          TEXT,
      severity             TEXT,
      failure_action       TEXT,
      reference_context     TEXT,
      pages                 TEXT,
      json_path             TEXT,
      source_file           TEXT,
      resolved              INTEGER DEFAULT 0,
      resolved_at           TEXT,
      created_at            TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (afe_number) REFERENCES afe_records(afe_number) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_dlq_afe_number ON dlq_entries(afe_number);
    CREATE INDEX IF NOT EXISTS idx_curated_raw_afe_number ON curated_raw_rows(afe_number);
  `)

  // Lightweight migrations: add any columns/tables that didn't exist in an
  // older version of this database, so existing data doesn't need to be
  // deleted every time the schema grows.
  const afeColumns = _afeDb.prepare(`PRAGMA table_info(afe_records)`).all() as Array<{ name: string }>
  if (!afeColumns.some(c => c.name === 'water_depth_unit')) {
    _afeDb.exec(`ALTER TABLE afe_records ADD COLUMN water_depth_unit TEXT`)
  }

  const dlqColumns = _afeDb.prepare(`PRAGMA table_info(dlq_entries)`).all() as Array<{ name: string }>
  const requiredDlqColumns = [
    'raw_value', 'normalized_value', 'failure_action',
    'reference_context', 'pages', 'json_path', 'source_file',
    'resolved', 'resolved_at',
  ]
  for (const col of requiredDlqColumns) {
    if (!dlqColumns.some(c => c.name === col)) {
      const type = col === 'resolved' ? 'INTEGER DEFAULT 0' : 'TEXT'
      _afeDb.exec(`ALTER TABLE dlq_entries ADD COLUMN ${col} ${type}`)
    }
  }

  const curatedRawColumns = _afeDb.prepare(`PRAGMA table_info(curated_raw_rows)`).all() as Array<{ name: string }>
  const requiredCuratedRawColumns = ['filename', 'json_path', 'reference_context', 'pages']
  for (const col of requiredCuratedRawColumns) {
    if (!curatedRawColumns.some(c => c.name === col)) {
      _afeDb.exec(`ALTER TABLE curated_raw_rows ADD COLUMN ${col} TEXT`)
    }
  }

  return _afeDb
}
