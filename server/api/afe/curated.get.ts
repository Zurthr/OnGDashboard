export default defineEventHandler(() => {
  const db = useAfeDb()
  return db.prepare('SELECT * FROM raw_data ORDER BY afe_number, id').all()
})
