interface UpdateBody {
  afe_number: string
  [key: string]: string | number | null | undefined
}

// Reverse of etlOutput.ts's toColumnName(): maps a DB column back to the
// (parameter_name, sub_parameter) pair the DLQ uses, so that editing a field
// can auto-resolve any DLQ entries flagging that exact field. Uses the ETL's
// naming (e.g. "topside_weight", not "Weight_Topside").
const columnToParam: Record<string, { parameter_name: string; sub_parameter?: string }> = {
  project_type: { parameter_name: 'project_type' },
  water_depth: { parameter_name: 'water_depth' },
  weight_topside: { parameter_name: 'topside_weight' },
  weight_jacket: { parameter_name: 'jacket_weight' },
  piling_weight: { parameter_name: 'piling_weight' },
  number_of_legs: { parameter_name: 'number_of_legs' },
  number_of_slots: { parameter_name: 'number_of_slots' },
  topside_equipment_wellhead: { parameter_name: 'topside_equipment', sub_parameter: 'Wellhead' },
  topside_equipment_processing: { parameter_name: 'topside_equipment', sub_parameter: 'Processing' },
  topside_equipment_utilities: { parameter_name: 'topside_equipment', sub_parameter: 'Utilities' },
  impurities_h2s: { parameter_name: 'impurities', sub_parameter: 'H2S' },
  impurities_co2: { parameter_name: 'impurities', sub_parameter: 'CO2' },
  impurities_hg: { parameter_name: 'impurities', sub_parameter: 'Hg' },
}

export default defineEventHandler(async (event) => {
  const body = await readBody<UpdateBody>(event)

  if (!body.afe_number) {
    throw createError({ statusCode: 400, statusMessage: 'afe_number is required' })
  }

  const allowedColumns = [
    'project_type', 'water_depth', 'water_depth_unit', 'weight_topside', 'weight_jacket', 'piling_weight',
    'number_of_legs', 'number_of_slots', 'topside_equipment_wellhead',
    'topside_equipment_processing', 'topside_equipment_utilities',
    'impurities_h2s', 'impurities_co2', 'impurities_hg',
  ]

  const fields = Object.keys(body).filter(k => allowedColumns.includes(k))
  if (fields.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No valid fields to update' })
  }

  const db = useAfeDb()
  const setClause = fields.map(f => `${f} = @${f}`).join(', ')

  const resolveDlq = db.prepare(`
    UPDATE dlq_entries SET resolved = 1, resolved_at = datetime('now')
    WHERE afe_number = @afe_number
      AND LOWER(parameter_name) = LOWER(@parameter_name)
      AND LOWER(COALESCE(sub_parameter, '')) = LOWER(COALESCE(@sub_parameter, ''))
      AND resolved = 0
  `)

  const runUpdate = db.transaction(() => {
    const result = db.prepare(`
      UPDATE afe_records SET ${setClause}, updated_at = datetime('now')
      WHERE afe_number = @afe_number
    `).run(body)

    if (result.changes === 0) {
      throw createError({ statusCode: 404, statusMessage: `AFE ${body.afe_number} not found` })
    }

    // Auto-resolve any DLQ flags for the specific fields that were just edited
    for (const field of fields) {
      const param = columnToParam[field]
      if (!param) continue
      resolveDlq.run({
        afe_number: body.afe_number,
        parameter_name: param.parameter_name,
        sub_parameter: param.sub_parameter ?? null,
      })
    }
  })

  runUpdate()

  return { afe_number: body.afe_number, status: 'updated' }
})
