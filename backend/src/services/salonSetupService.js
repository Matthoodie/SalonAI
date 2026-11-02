import pool from '../database/pool.js'
import { setupError, setupId, validateSalonSetup } from '../utils/salonSetupValidation.js'
import { findSetupOwner, findSalonSetup, saveSalonSetup } from '../repositories/salonSetupRepository.js'

async function withSetupOwner(context, run) {
  const ids = { salonId: setupId(context.salonId), userId: setupId(context.userId) }
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const salon = await findSetupOwner(db, ids)
    if (!salon) throw setupError('Postavljanje salona dostupno je aktivnom vlasniku.', 'SALON_SETUP_FORBIDDEN', 403)
    const result = await run(db, ids, salon)
    await db.query('COMMIT')
    return result
  } catch (error) {
    try { await db.query('ROLLBACK') } catch { /* Keep original failure. */ }
    throw error
  } finally { db.release() }
}
function response(salon, setup) {
  return {
    salon: { id: salon.id, name: salon.name, timezone: salon.timezone },
    setup: setup ?? {
      salon_id: salon.id, business_type: null, location: '', team_mode: null,
      owner_provides_services: null, last_step: 'business', revision: 0,
      updated_by_user_id: null, updated_at: null,
    },
    // A cursor is not proof of completed setup. Later wizard stages must check
    // real employee/service/schedule data before reporting readiness.
    started: setup !== null,
  }
}
export async function getSalonSetup(context) {
  return withSetupOwner(context, async (db, ids, salon) => response(salon, await findSalonSetup(db, ids.salonId)))
}
export async function updateSalonSetup({ body, ...context }) {
  const draft = validateSalonSetup(body)
  return withSetupOwner(context, async (db, ids, salon) => {
    const setup = await saveSalonSetup(db, ids, draft)
    if (!setup) throw setupError('Nacrt je promijenjen u drugom prozoru. Ponovno učitajte postavljanje prije spremanja.', 'SALON_SETUP_VERSION_CONFLICT', 409)
    return response(salon, setup)
  })
}
