export interface AfeRecordInput {
  afe_number: string
  project_type?: string | null
  water_depth?: number | null
  water_depth_unit?: string | null
  weight_topside?: number | null
  weight_jacket?: number | null
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
      afe_number, project_type, water_depth, water_depth_unit, weight_topside, weight_jacket,
      piling_weight, number_of_legs, number_of_slots,
      topside_equipment_wellhead, topside_equipment_processing, topside_equipment_utilities,
      impurities_h2s, impurities_co2, impurities_hg, updated_at
    ) VALUES (
      @afe_number, @project_type, @water_depth, @water_depth_unit, @weight_topside, @weight_jacket,
      @piling_weight, @number_of_legs, @number_of_slots,
      @topside_equipment_wellhead, @topside_equipment_processing, @topside_equipment_utilities,
      @impurities_h2s, @impurities_co2, @impurities_hg, datetime('now')
    )
    ON CONFLICT(afe_number) DO UPDATE SET
      project_type = excluded.project_type,
      water_depth = excluded.water_depth,
      water_depth_unit = excluded.water_depth_unit,
      weight_topside = excluded.weight_topside,
      weight_jacket = excluded.weight_jacket,
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
    INSERT INTO dlq_entries (
      afe_number, parameter_name, sub_parameter, raw_value, normalized_value,
      failed_rule, error_type, severity, failure_action,
      reference_context, pages, json_path, source_file
    )
    VALUES (
      @afe_number, @parameter_name, @sub_parameter, @raw_value, @normalized_value,
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
      weight_topside: data.weight_topside ?? null,
      weight_jacket: data.weight_jacket ?? null,
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
    // exists, leave it untouched so its resolved/resolved_at status survives
    // re-importing the same ETL output. Only genuinely new issues get inserted.
    const findExisting = db.prepare(`
      SELECT id FROM dlq_entries
      WHERE afe_number = @afe_number
        AND LOWER(parameter_name) = LOWER(@parameter_name)
        AND LOWER(COALESCE(sub_parameter, '')) = LOWER(COALESCE(@sub_parameter, ''))
        AND LOWER(COALESCE(failed_rule, '')) = LOWER(COALESCE(@failed_rule, ''))
    `)

    for (const entry of dlq) {
      const existing = findExisting.get({
        afe_number: data.afe_number,
        parameter_name: entry.parameter_name,
        sub_parameter: entry.sub_parameter ?? null,
        failed_rule: entry.failed_rule ?? null,
      })
      if (existing) continue

      insertDlq.run({
        afe_number: data.afe_number,
        parameter_name: entry.parameter_name,
        sub_parameter: entry.sub_parameter ?? null,
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
 * Replaces all curated_raw_rows for one AFE with a fresh set (used during
 * bulk CSV import, for the Curated Data tab's verbatim long-format view).
 */
export function replaceCuratedRawRows(afeNumber: string, rows: CuratedRawRowInput[]) {
  const db = useAfeDb()

  const insertRow = db.prepare(`
    INSERT INTO curated_raw_rows (afe_number, parameter_name, sub_parameter, value, unit, validation_status, notes, filename, json_path, reference_context, pages)
    VALUES (@afe_number, @parameter_name, @sub_parameter, @value, @unit, @validation_status, @notes, @filename, @json_path, @reference_context, @pages)
  `)

  const writeAll = db.transaction((afe: string, rowList: CuratedRawRowInput[]) => {
    db.prepare('DELETE FROM curated_raw_rows WHERE afe_number = ?').run(afe)
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
