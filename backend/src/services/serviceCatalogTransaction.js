import pool from '../database/pool.js'
import { importError } from '../utils/serviceImportValidation.js'

// Every application write to the service catalogue uses the same salon lock.
// This makes duplicate rechecks atomic with both imports and regular edits.
export async function withServiceCatalogTransaction(salonId, run) {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const salon = await db.query('SELECT id FROM salons WHERE id = $1 FOR NO KEY UPDATE', [salonId])
    if (!salon.rows.length) throw importError('Salon nije pronađen.', 'SALON_NOT_FOUND', 404)
    const result = await run(db)
    await db.query('COMMIT')
    return result
  } catch (error) {
    try { await db.query('ROLLBACK') } catch { /* Preserve the original failure. */ }
    throw error
  } finally { db.release() }
}
