export interface AfeRecordInput {
  afe_number: string
  project_type?: string | null
  water_depth?: number | null
  water_depth_unit?: string | null
  topside_weight?: number | null
  jacket_weight?: number | null
  piling_weight?: number | null
  number_of_legs?: number | null
  number_of_slots?: number | null
  topside_equipment_wellhead?: string | null
  topside_equipment_processing?: string | null
  topside_equipment_utilities?: string | null
  impurities_h2s?: number | null
  impurities_co2?: number | null
  impurities_hg?: number | null
}

export interface DlqEntryInput {
  parameter_name: string
  sub_parameter?: string | null
  unit?: string | null
  notes?: string | null
  raw_value?: string | null
  normalized_value?: string | null
  failed_rule?: string | null
  error_type?: string | null
  severity?: string | null
  failure_action?: string | null
  reference_context?: string | null
  pages?: string | null
  json_path?: string | null
  source_file?: string | null
}

export interface CuratedRawRowInput {
  afe_number: string
  parameter_name: string
  sub_parameter?: string | null
  value?: string | null
  unit?: string | null
  validation_status?: string | null
  notes?: string | null
  filename?: string | null
  json_path?: string | null
  reference_context?: string | null
  pages?: string | null
}

/**
 * Inserts or updates one AFE record and its DLQ entries in a single transaction.
 * Shared by index.post.ts (single manual insert) and import.post.ts (bulk CSV import),
 * so the write logic only lives in one place.
 */
export function upsertAfeRecord(record: AfeRecordInput, dlqEntries: DlqEntryInput[] = []) {
  const db = useAfeDb()

  const upsertRecord = db.prepare(`
    INSERT INTO afe_records (
      afe_number, project_type, water_depth, water_depth_unit, topside_weight, jacket_weight,
      piling_weight, number_of_legs, number_of_slots,
      topside_equipment_wellhead, topside_equipment_processing, topside_equipment_utilities,
      impurities_h2s, impurities_co2, impurities_hg, updated_at
    ) VALUES (
      @afe_number, @project_type, @water_depth, @water_depth_unit, @topside_weight, @jacket_weight,
      @piling_weight, @number_of_legs, @number_of_slots,
      @topside_equipment_wellhead, @topside_equipment_processing, @topside_equipment_utilities,
      @impurities_h2s, @impurities_co2, @impurities_hg, datetime('now')
    )
    ON CONFLICT(afe_number) DO UPDATE SET
      project_type = excluded.project_type,
      water_depth = excluded.water_depth,
      water_depth_unit = excluded.water_depth_unit,
      topside_weight = excluded.topside_weight,
      jacket_weight = excluded.jacket_weight,
      piling_weight = excluded.piling_weight,
      number_of_legs = excluded.number_of_legs,
      number_of_slots = excluded.number_of_slots,
      topside_equipment_wellhead = excluded.topside_equipment_wellhead,
      topside_equipment_processing = excluded.topside_equipment_processing,
      topside_equipment_utilities = excluded.topside_equipment_utilities,
      impurities_h2s = excluded.impurities_h2s,
      impurities_co2 = excluded.impurities_co2,
      impurities_hg = excluded.impurities_hg,
      updated_at = datetime('now')
  `)

  const insertDlq = db.prepare(`
    INSERT INTO issue_data (
      afe_number, parameter_name, sub_parameter, unit, notes, validation_status,
      raw_value, normalized_value,
      failed_rule, error_type, severity, failure_action,
      reference_context, pages, json_path, source_file
    )
    VALUES (
      @afe_number, @parameter_name, @sub_parameter, @unit, @notes, 'FAIL',
      @raw_value, @normalized_value,
      @failed_rule, @error_type, @severity, @failure_action,
      @reference_context, @pages, @json_path, @source_file
    )
  `)

  const writeAll = db.transaction((data: AfeRecordInput, dlq: DlqEntryInput[]) => {
    upsertRecord.run({
      afe_number: data.afe_number,
      project_type: data.project_type ?? null,
      water_depth: data.water_depth ?? null,
      water_depth_unit: data.water_depth_unit ?? null,
      topside_weight: data.topside_weight ?? null,
      jacket_weight: data.jacket_weight ?? null,
      piling_weight: data.piling_weight ?? null,
      number_of_legs: data.number_of_legs ?? null,
      number_of_slots: data.number_of_slots ?? null,
      topside_equipment_wellhead: data.topside_equipment_wellhead ?? null,
      topside_equipment_processing: data.topside_equipment_processing ?? null,
      topside_equipment_utilities: data.topside_equipment_utilities ?? null,
      impurities_h2s: data.impurities_h2s ?? null,
      impurities_co2: data.impurities_co2 ?? null,
      impurities_hg: data.impurities_hg ?? null,
    })

    // Merge DLQ entries instead of wiping and reinserting: if an identical
    // issue (same afe + parameter + sub_parameter + failed_rule) already
    // exists, don't insert a duplicate — but if it was previously resolved,
    // reopen it. A fresh ETL run reporting the same failure again means the
    // underlying value (which this same import just overwrote in
    // afe_records) is currently bad again, regardless of past manual review;
    // resolved should reflect current state, not history that a re-import
    // may have just invalidated.
    const findExisting = db.prepare(`
      SELECT id, resolved FROM issue_data
      WHERE afe_number = @afe_number
        AND LOWER(parameter_name) = LOWER(@parameter_name)
        AND LOWER(COALESCE(sub_parameter, '')) = LOWER(COALESCE(@sub_parameter, ''))
        AND LOWER(COALESCE(failed_rule, '')) = LOWER(COALESCE(@failed_rule, ''))
    `)
    const reopenExisting = db.prepare(`UPDATE issue_data SET resolved = 0, resolved_at = NULL WHERE id = @id`)

    for (const entry of dlq) {
      const existing = findExisting.get({
        afe_number: data.afe_number,
        parameter_name: entry.parameter_name,
        sub_parameter: entry.sub_parameter ?? null,
        failed_rule: entry.failed_rule ?? null,
      }) as { id: number; resolved: number } | undefined

      if (existing) {
        if (existing.resolved) reopenExisting.run({ id: existing.id })
        continue
      }

      insertDlq.run({
        afe_number: data.afe_number,
        parameter_name: entry.parameter_name,
        sub_parameter: entry.sub_parameter ?? null,
        unit: entry.unit ?? null,
        notes: entry.notes ?? null,
        raw_value: entry.raw_value ?? null,
        normalized_value: entry.normalized_value ?? null,
        failed_rule: entry.failed_rule ?? null,
        error_type: entry.error_type ?? null,
        severity: entry.severity ?? null,
        failure_action: entry.failure_action ?? null,
        reference_context: entry.reference_context ?? null,
        pages: entry.pages ?? null,
        json_path: entry.json_path ?? null,
        source_file: entry.source_file ?? null,
      })
    }
  })

  writeAll(record, dlqEntries)
}

/**
 * Replaces all raw_data rows for one AFE with a fresh set (used during
 * bulk CSV import, for the Curated Data tab's verbatim long-format view).
 */
export function replaceCuratedRawRows(afeNumber: string, rows: CuratedRawRowInput[]) {
  const db = useAfeDb()

  const insertRow = db.prepare(`
    INSERT INTO raw_data (afe_number, parameter_name, sub_parameter, value, unit, validation_status, notes, filename, json_path, reference_context, pages)
    VALUES (@afe_number, @parameter_name, @sub_parameter, @value, @unit, @validation_status, @notes, @filename, @json_path, @reference_context, @pages)
  `)

  const writeAll = db.transaction((afe: string, rowList: CuratedRawRowInput[]) => {
    db.prepare('DELETE FROM raw_data WHERE afe_number = ?').run(afe)
    for (const row of rowList) {
      insertRow.run({
        afe_number: afe,
        parameter_name: row.parameter_name,
        sub_parameter: row.sub_parameter ?? null,
        value: row.value ?? null,
        unit: row.unit ?? null,
        validation_status: row.validation_status ?? null,
        notes: row.notes ?? null,
        filename: row.filename ?? null,
        json_path: row.json_path ?? null,
        reference_context: row.reference_context ?? null,
        pages: row.pages ?? null,
      })
    }
  })

  writeAll(afeNumber, rows)
}

export interface ExtractionPayloadInput {
  source_filename: string
  afe_number?: string | null
  payload: unknown
}

/**
 * Preserves the raw extraction payload for one document — see the
 * extraction_payloads table comment in afeDb.ts for why. Upserts by
 * source_filename, so re-importing the same file just replaces its row.
 */
export function saveExtractionPayload(input: ExtractionPayloadInput) {
  const db = useAfeDb()

  db.prepare(`
    INSERT INTO extraction_payloads (source_filename, afe_number, payload_json, imported_at)
    VALUES (@source_filename, @afe_number, @payload_json, datetime('now'))
    ON CONFLICT(source_filename) DO UPDATE SET
      afe_number = excluded.afe_number,
      payload_json = excluded.payload_json,
      imported_at = datetime('now')
  `).run({
    source_filename: input.source_filename,
    afe_number: input.afe_number ?? null,
    payload_json: JSON.stringify(input.payload),
  })
}

/**
 * Removes one raw extraction payload by source_filename. This is a separate,
 * lower-stakes action from deleting a real AFE record (server/api/afe/delete.post.ts)
 * — it only cleans up the raw audit copy, never afe_records/raw_data/issue_data.
 */
export function deleteExtractionPayload(sourceFilename: string) {
  const db = useAfeDb()
  const result = db.prepare('DELETE FROM extraction_payloads WHERE source_filename = ?').run(sourceFilename)
  return result.changes > 0
}
