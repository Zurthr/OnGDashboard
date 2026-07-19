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
      topside_weight                REAL,
      jacket_weight                 REAL,
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
    -- validation_status / notes) for the "Raw Data" tab. Separate from
    -- afe_records, which holds the pivoted, editable, one-row-per-AFE view.
    CREATE TABLE IF NOT EXISTS raw_data (
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

    CREATE TABLE IF NOT EXISTS issue_data (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      afe_number          TEXT NOT NULL,
      parameter_name      TEXT NOT NULL,
      sub_parameter       TEXT,
      unit                TEXT,
      notes               TEXT,
      validation_status   TEXT DEFAULT 'FAIL',
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

    -- Preserves every successfully-extracted document's raw payload (what the
    -- AI extraction produced, before the ETL API ever sees it), regardless of
    -- what happens downstream — even if AFE_Number extraction fails entirely,
    -- the ETL call fails, or the record ends up entirely in issue_data. Keyed
    -- by source_filename (not afe_number): the whole point is that afe_number
    -- can be missing or malformed, so it can't be a reliable key here.
    -- UNIQUE on source_filename: re-importing the same file replaces its row
    -- rather than accumulating duplicates.
    CREATE TABLE IF NOT EXISTS extraction_payloads (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      source_filename   TEXT NOT NULL UNIQUE,
      afe_number        TEXT,
      payload_json      TEXT NOT NULL,
      imported_at       TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_issue_data_afe_number ON issue_data(afe_number);
    CREATE INDEX IF NOT EXISTS idx_raw_data_afe_number ON raw_data(afe_number);
    CREATE INDEX IF NOT EXISTS idx_extraction_payloads_afe_number ON extraction_payloads(afe_number);
  `)

  return _afeDb
}
