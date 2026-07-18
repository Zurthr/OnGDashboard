export default defineEventHandler(() => {
  const db = useAfeDb()
  return db.prepare('SELECT * FROM curated_raw_rows ORDER BY afe_number, id').all()
})
