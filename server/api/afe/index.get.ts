export default defineEventHandler(() => {
  const db = useAfeDb()
  return db.prepare('SELECT * FROM afe_records ORDER BY afe_number').all()
})
