export default defineEventHandler(async (event) => {
  const { afe_number } = await readBody<{ afe_number: string }>(event)

  if (!afe_number) {
    throw createError({ statusCode: 400, statusMessage: 'afe_number is required' })
  }

  const db = useAfeDb()
  const result = db.prepare('DELETE FROM afe_records WHERE afe_number = ?').run(afe_number)

  if (result.changes === 0) {
    throw createError({ statusCode: 404, statusMessage: `AFE ${afe_number} not found` })
  }

  return { afe_number, status: 'deleted' }
})
