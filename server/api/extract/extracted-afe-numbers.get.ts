export default defineEventHandler(() => {
  const db = useAfeDb()
  const rows = db.prepare(
    'SELECT DISTINCT afe_number FROM extraction_payloads WHERE afe_number IS NOT NULL'
  ).all() as { afe_number: string }[]
  return { afe_numbers: rows.map(r => r.afe_number) }
})
