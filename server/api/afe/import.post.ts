interface ImportBody {
  confirmOverwrite?: boolean
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<ImportBody>(event).catch(() => undefined)) ?? {}

  // TEMPORARY: your friend's ETL API isn't a live endpoint yet, so this reads
  // integration_output.json from the project root wholesale and imports
  // everything as placeholder data. Once the ETL exposes a real API, replace
  // getAllEtlData() with an $fetch(...) call to it that returns the same
  // { curated_records, dlq_records } shape — nothing else here needs to change.
  const { afe_records, curated_raw_rows, dlq_entries_by_afe } = getAllEtlData()

  if (afe_records.length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: 'No records found in integration_output.json',
    })
  }

  // AFE already exists in the database — not a hard error, ask the user to
  // confirm before overwriting, since an analyst may have manually corrected
  // values already sitting in the DB.
  const db = useAfeDb()
  const existingCheck = db.prepare('SELECT afe_number, updated_at FROM afe_records WHERE afe_number = ?')
  const resolvedDlqCheck = db.prepare('SELECT COUNT(*) as count FROM dlq_entries WHERE afe_number = ? AND resolved = 1')

  if (!body.confirmOverwrite) {
    const overwriteConflicts = []
    for (const record of afe_records) {
      const existing = existingCheck.get(record.afe_number) as { afe_number: string; updated_at: string } | undefined
      if (existing) {
        const resolvedCount = (resolvedDlqCheck.get(record.afe_number) as { count: number }).count
        overwriteConflicts.push({
          afe_number: existing.afe_number,
          last_updated: existing.updated_at,
          resolved_dlq_count: resolvedCount,
        })
      }
    }

    if (overwriteConflicts.length > 0) {
      return {
        status: 'needs_confirmation',
        overwrite_conflicts: overwriteConflicts,
        new_afe_count: afe_records.length - overwriteConflicts.length,
      }
    }
  }

  // Group raw rows by AFE so each AFE's raw rows can be replaced independently
  const rawRowsByAfe: Record<string, typeof curated_raw_rows> = {}
  for (const row of curated_raw_rows) {
    if (!rawRowsByAfe[row.afe_number]) rawRowsByAfe[row.afe_number] = []
    rawRowsByAfe[row.afe_number].push(row)
  }

  for (const record of afe_records) {
    upsertAfeRecord(record, dlq_entries_by_afe[record.afe_number] ?? [])
    replaceCuratedRawRows(record.afe_number, rawRowsByAfe[record.afe_number] ?? [])
  }

  return {
    status: 'imported',
    afe_count: afe_records.length,
    afe_numbers: afe_records.map(r => r.afe_number),
  }
})
