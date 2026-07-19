interface SavePayloadBody {
  source_filename: string
  payload: Record<string, unknown>
}

/**
 * Persists a raw extraction payload the moment extraction finishes — fully
 * independent of "Import to Repository". Import (server/api/afe/import.post.ts)
 * calls the ETL API and can overwrite afe_records/raw_data/issue_data, so it
 * stays a deliberate, explicit action. This endpoint does neither of those
 * things: it only writes to extraction_payloads, so a successful extraction
 * is never lost to the 3-hour localStorage expiry just because the user
 * hasn't clicked Import yet.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<SavePayloadBody>(event)

  if (!body?.source_filename || !body?.payload) {
    throw createError({ statusCode: 400, statusMessage: 'source_filename and payload are required' })
  }

  const afeNumber = (body.payload as any)?.AFE_Extraction?.AFE_Number?.value

  saveExtractionPayload({
    source_filename: body.source_filename,
    afe_number: typeof afeNumber === 'string' && afeNumber.trim() !== '' ? afeNumber : null,
    payload: body.payload,
  })

  setResponseStatus(event, 201)
  return { source_filename: body.source_filename, status: 'saved' }
})
