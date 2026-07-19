interface DeletePayloadBody {
  source_filename: string
}

/**
 * Deletes one row from extraction_payloads — the raw-audit table, not the
 * repository. Separate from server/api/afe/delete.post.ts, which deletes a
 * real AFE record (afe_records, cascading to raw_data/issue_data). Removing
 * a file from the Extraction queue calls this endpoint; it never touches
 * the repository tables.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<DeletePayloadBody>(event)

  if (!body?.source_filename) {
    throw createError({ statusCode: 400, statusMessage: 'source_filename is required' })
  }

  const deleted = deleteExtractionPayload(body.source_filename)

  return { source_filename: body.source_filename, status: deleted ? 'deleted' : 'not_found' }
})
