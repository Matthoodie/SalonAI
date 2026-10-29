export async function findImportReceipt(db, salonId, requestId) {
  const result = await db.query(
    'SELECT requested_by_user_id, request_hash, response FROM service_import_receipts WHERE salon_id = $1 AND request_id = $2',
    [salonId, requestId]
  )
  return result.rows[0] ?? null
}
export async function insertImportReceipt(db, { salonId, userId, requestId, hash, response }) {
  await db.query(
    'INSERT INTO service_import_receipts (salon_id, request_id, requested_by_user_id, request_hash, response) VALUES ($1,$2,$3,$4,$5::jsonb)',
    [salonId, requestId, userId, hash, JSON.stringify(response)]
  )
}
