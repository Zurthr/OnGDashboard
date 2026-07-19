interface ImportBody {
  confirmOverwrite?: boolean
  documents?: EtlDocumentInput[]
}

interface ExcludedDocument {
  source_filename: string
  reason: string
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<ImportBody>(event).catch(() => undefined)) ?? {}

  if (!body.documents || body.documents.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No documents provided. Extract at least one file before importing to the repository.',
    })
  }

  // A document with no AFE Number can't be reliably tracked once it's in the
  // repository — nothing to key its records on, and multiple such documents
  // become indistinguishable from each other downstream. The Extraction page
  // already marks these as failed before they'd normally reach here (see
  // extractStore.ts's pollStatus), but this endpoint shouldn't rely solely
  // on the frontend enforcing that — anything missing an AFE Number is
  // excluded here too, before it ever reaches the ETL API.
  const excludedDocuments: ExcludedDocument[] = []
  const validDocuments = body.documents.filter((doc) => {
    const afeNumber = (doc.payload as any)?.AFE_Extraction?.AFE_Number?.value
    const hasAfeNumber = typeof afeNumber === 'string' && afeNumber.trim() !== ''
    if (!hasAfeNumber) {
      excludedDocuments.push({
        source_filename: doc.source_filename,
        reason: 'No AFE Number found in the extracted document.',
      })
    }
    return hasAfeNumber
  })

  // Calls the live ETL API once per document (its contract processes one
  // document per request) and combines every response into the same shape
  // the old batch integration_output.json file used to provide — see
  // etlApiClient.ts. A failure on one document doesn't abort the others;
  // those are reported back as `etl_errors` instead.
  const { afe_records, curated_raw_rows, dlq_entries_by_afe, errors: etlErrors } = await fetchEtlDataFromApi(validDocuments)

  if (afe_records.length === 0) {
    throw createError({
      statusCode: 502,
      statusMessage: etlErrors.length > 0
        ? `The ETL API failed to process every submitted document. First error: ${etlErrors[0].message}`
        : excludedDocuments.length > 0
          ? 'Every submitted document was missing an AFE Number and could not be imported.'
          : 'The ETL API returned no curated records for any submitted document.',
    })
  }

  // AFE already exists in the database — not a hard error, ask the user to
  // confirm before overwriting, since an analyst may have manually corrected
  // values already sitting in the DB.
  const db = useAfeDb()
  const existingCheck = db.prepare('SELECT afe_number, updated_at FROM afe_records WHERE afe_number = ?')
  const resolvedDlqCheck = db.prepare('SELECT COUNT(*) as count FROM issue_data WHERE afe_number = ? AND resolved = 1')

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
        etl_errors: etlErrors,
        excluded_documents: excludedDocuments,
      }
    }
  }

  // Preserve every submitted document's raw extraction payload, regardless
  // of whether the ETL call for it succeeded — even a document whose
  // AFE_Number extraction failed entirely (so it's not in afe_records at
  // all) still gets its payload saved, keyed by source_filename. This is
  // what makes it possible to debug or reprocess a failure later without
  // needing to re-run the AI extraction from the original PDF.
  //
  // afe_number here should be the ETL's normalized value (e.g. "04-3810"),
  // not the raw AI extraction (e.g. "AFE 04-3810" — the literal text on the
  // source document, prefix and all). Using the raw value would silently
  // break the "already imported" check everywhere else, since that check is
  // a straight string match against afe_records, which only ever stores the
  // normalized form. curated_raw_rows already carries the ETL's authoritative
  // afe_number alongside the source filename for every row it processed, so
  // build a lookup from that instead of trusting the unprocessed payload.
  const normalizedAfeByFilename = new Map<string, string>()
  for (const row of curated_raw_rows) {
    if (row.filename && !normalizedAfeByFilename.has(row.filename)) {
      normalizedAfeByFilename.set(row.filename, row.afe_number)
    }
  }

  for (const doc of body.documents) {
    const rawAfeNumber = (doc.payload as any)?.AFE_Extraction?.AFE_Number?.value
    const afeNumber = normalizedAfeByFilename.get(doc.source_filename)
      ?? (typeof rawAfeNumber === 'string' && rawAfeNumber.trim() !== '' ? rawAfeNumber : null)
    saveExtractionPayload({
      source_filename: doc.source_filename,
      afe_number: afeNumber,
      payload: doc.payload,
    })
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
    etl_errors: etlErrors,
    excluded_documents: excludedDocuments,
  }
})
