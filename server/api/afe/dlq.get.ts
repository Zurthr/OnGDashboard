export default defineEventHandler(() => {
  const db = useAfeDb()
  return db.prepare('SELECT * FROM issue_data ORDER BY afe_number').all()
})
