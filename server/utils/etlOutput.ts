import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Shapes ETL output — curated_records / dlq_records, whether from a batch
 * integration_output.json file or the live ETL API (see etlApiClient.ts) —
 * into the flat structures the database layer (upsertAfe.ts) expects. See
 * docs: INTEGRATION_OUTPUT_CONTRACT.md / REST_API_REFERENCE.md in the ETL
 * project for the exact contract this matches.
 */

export interface RawCuratedRecord {
  afe_number: string
  project_type: string | null
  parameter_name: string
  sub_parameter: string | null
  value: number | string | null
  unit: string | null
  validation_status: string
  notes: string[]
  filename: string
  json_path: string
  reference_context: string | null
  pages: string[] | string | null
}

export interface RawDlqRecord {
  afe_number: string
  project_type: string | null
  parameter_name: string
  sub_parameter: string | null
  raw_value: string | null
  normalized_value: number | string | null
  failed_rule: string
  error_type: string
  severity: string
  failure_action: string
  reference_context: string | null
  pages: string[] | string | null
  json_path: string
  filename: string
}

interface EtlOutput {
  run_info: { timestamp: string; pipeline_version: string }
  validation_summary: Record<string, unknown>
  curated_records: RawCuratedRecord[]
  dlq_records: RawDlqRecord[]
}

// Maps a (parameter_name, sub_parameter) pair into the flat column name used
// in afe_records. IMPORTANT: several of the ETL's parameter names use the
// opposite word order from the JSON schema's field names (e.g. "topside_weight"
// vs. "Weight_Topside") — this table matches the ETL's actual naming, not the
// extraction schema's naming.
function toColumnName(parameterName: string, subParameter: string): string | null {
  const p = parameterName.trim().toLowerCase()
  const s = (subParameter || '').trim().toLowerCase()

  const direct: Record<string, string> = {
    project_type: 'project_type',
    water_depth: 'water_depth',
    topside_weight: 'topside_weight',
    jacket_weight: 'jacket_weight',
    piling_weight: 'piling_weight',
    number_of_legs: 'number_of_legs',
    number_of_slots: 'number_of_slots',
  }
  if (direct[p]) return direct[p]

  if (p === 'topside_equipment') {
    if (s === 'wellhead') return 'topside_equipment_wellhead'
    if (s === 'processing') return 'topside_equipment_processing'
    if (s === 'utilities') return 'topside_equipment_utilities'
  }
  if (p === 'impurities') {
    if (s === 'h2s') return 'impurities_h2s'
    if (s === 'co2') return 'impurities_co2'
    if (s === 'hg') return 'impurities_hg'
  }
  return null
}

// notes / pages can arrive as an array, a plain string, or null — normalize
// all three into a single string (or null) for TEXT storage.
function joinIfArray(v: string[] | string | null | undefined): string | null {
  if (v == null) return null
  if (Array.isArray(v)) return v.length ? v.join('; ') : null
  return v
}

export interface BulkCuratedData {
  afe_records: AfeRecordInput[]
  curated_raw_rows: CuratedRawRowInput[]
  dlq_entries_by_afe: Record<string, DlqEntryInput[]>
}

/**
 * Takes raw curated_records/dlq_records (the shape returned by both
 * integration_output.json and the live ETL API's POST /api/v1/etl/process)
 * and reshapes them into three things:
 * - afe_records: pivoted, one flat row per AFE (for the editable Overview table)
 * - curated_raw_rows: every curated record verbatim (for the Raw Data tab)
 * - dlq_entries_by_afe: every DLQ record, grouped by AFE (for cell flagging + the Issue tab)
 *
 * Pure function, no I/O — shared by getAllEtlData() (dev/offline file mode)
 * and fetchEtlDataFromApi() (live API mode), so this reshaping logic only
 * lives in one place regardless of where the raw records came from.
 */
export function shapeEtlRecords(curatedRecords: RawCuratedRecord[], dlqRecords: RawDlqRecord[]): BulkCuratedData {
  const recordsByAfe = new Map<string, AfeRecordInput>()
  const rawRows: CuratedRawRowInput[] = []

  for (const row of curatedRecords ?? []) {
    if (!row.afe_number) continue

    if (!recordsByAfe.has(row.afe_number)) {
      recordsByAfe.set(row.afe_number, { afe_number: row.afe_number })
    }
    const record = recordsByAfe.get(row.afe_number)!
    if (row.project_type && !record.project_type) record.project_type = row.project_type

    // Preserve this row verbatim for the Raw Data tab
    rawRows.push({
      afe_number: row.afe_number,
      parameter_name: row.parameter_name,
      sub_parameter: row.sub_parameter,
      value: row.value == null ? null : String(row.value),
      unit: row.unit,
      validation_status: row.validation_status,
      notes: joinIfArray(row.notes),
      filename: row.filename ?? null,
      json_path: row.json_path ?? null,
      reference_context: row.reference_context ?? null,
      pages: joinIfArray(row.pages),
    })

    const column = toColumnName(row.parameter_name, row.sub_parameter ?? '')
    if (!column) continue

    const value = row.value
    ;(record as any)[column] = value === '' ? null
      : typeof value === 'number' ? value
      : (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) ? Number(value)
      : value

    if (column === 'water_depth' && row.unit) {
      record.water_depth_unit = row.unit
    }
  }

  const dlqByAfe: Record<string, DlqEntryInput[]> = {}
  for (const row of dlqRecords ?? []) {
    if (!row.afe_number) continue

    if (!dlqByAfe[row.afe_number]) dlqByAfe[row.afe_number] = []
    dlqByAfe[row.afe_number].push({
      parameter_name: row.parameter_name,
      sub_parameter: row.sub_parameter,
      raw_value: row.raw_value,
      normalized_value: row.normalized_value == null ? null : String(row.normalized_value),
      failed_rule: row.failed_rule,
      error_type: row.error_type,
      severity: row.severity,
      failure_action: row.failure_action,
      reference_context: row.reference_context,
      pages: joinIfArray(row.pages),
      json_path: row.json_path,
      source_file: row.filename ?? null, // ETL calls this "filename"; our column is "source_file"
    })
  }

  return {
    afe_records: [...recordsByAfe.values()],
    curated_raw_rows: rawRows,
    dlq_entries_by_afe: dlqByAfe,
  }
}

/**
 * Dev/offline fallback: reads integration_output.json from the project root
 * (a batch export from the ETL, covering many documents at once) and shapes
 * it the same way as the live API path below. Useful for testing without
 * the FastAPI server running, but the real import flow now uses
 * fetchEtlDataFromApi() instead — see import.post.ts.
 */
export function getAllEtlData(): BulkCuratedData {
  const path = join(process.cwd(), 'integration_output.json')
  if (!existsSync(path)) {
    return { afe_records: [], curated_raw_rows: [], dlq_entries_by_afe: {} }
  }

  const data: EtlOutput = JSON.parse(readFileSync(path, 'utf-8'))
  return shapeEtlRecords(data.curated_records, data.dlq_records)
}
