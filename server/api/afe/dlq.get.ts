export default defineEventHandler(() => {
  const db = useAfeDb()
  return db.prepare('SELECT * FROM dlq_entries ORDER BY afe_number').all()
})
