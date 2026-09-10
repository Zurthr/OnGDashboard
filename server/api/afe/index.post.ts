interface AfeInsertBody extends AfeRecordInput {
  dlq_entries?: DlqEntryInput[]
}

export default defineEventHandler(async (event) => {
  const body = await readBody<AfeInsertBody>(event)

  if (!body.afe_number) {
    throw createError({ statusCode: 400, statusMessage: 'afe_number is required' })
  }

  upsertAfeRecord(body, body.dlq_entries ?? [])

  setResponseStatus(event, 201)
  return { afe_number: body.afe_number, status: 'saved' }
})
