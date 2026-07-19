export default defineEventHandler(async (event) => {
  const { afe_number } = await readBody<{ afe_number: string }>(event)

  if (!afe_number) {
    throw createError({ statusCode: 400, statusMessage: 'afe_number is required' })
  }

  const db = useAfeDb()

  const record = db.prepare('SELECT * FROM afe_records WHERE afe_number = ?').get(afe_number)
  if (!record) {
    throw createError({ statusCode: 404, statusMessage: `AFE ${afe_number} not found` })
  }

  const dlq = db.prepare('SELECT * FROM issue_data WHERE afe_number = ?').all(afe_number)

  return { ...record, dlq_entries: dlq }
})
