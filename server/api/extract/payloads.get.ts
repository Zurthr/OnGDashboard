interface PayloadRow {
  source_filename: string
  afe_number: string | null
  payload_json: string
  imported_at: string
}

/**
 * Returns every row in extraction_payloads, with payload_json parsed back
 * into an object, plus whether that AFE has already been imported. Used to
 * hydrate the Extraction queue UI on load, so previously-extracted documents
 * that were never imported (or were extracted in an earlier session /
 * different browser) are still visible — otherwise the queue only ever
 * reflects localStorage, even though the data has been safely sitting in
 * the database the whole time.
 */
export default defineEventHandler(() => {
  const db = useAfeDb()
  const rows = db.prepare(
    'SELECT source_filename, afe_number, payload_json, imported_at FROM extraction_payloads'
  ).all() as PayloadRow[]

  const importedAfeNumbers = new Set(
    (db.prepare('SELECT afe_number FROM afe_records').all() as { afe_number: string }[]).map(r => r.afe_number)
  )

  return rows.map(r => ({
    source_filename: r.source_filename,
    afe_number: r.afe_number,
    payload: JSON.parse(r.payload_json),
    saved_at: r.imported_at,
    imported: r.afe_number != null && importedAfeNumbers.has(r.afe_number),
  }))
})
