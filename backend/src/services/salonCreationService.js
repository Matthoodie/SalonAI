import pool from '../database/pool.js'
import { creationError, creationUserId, validateSalonCreation, salonCreationHash, salonCreationPolicy } from '../utils/salonCreationValidation.js'
import { lockCreationUser, findCreationReceipt, hasAnyMembership, findReplayAccess,
  supportsTimezone, insertCreatedSalon, findOnboardingStatus } from '../repositories/salonCreationRepository.js'

export function createSalonCreationService({ dbPool = pool, environment = process.env } = {}) {
  async function transaction(run) {
    const db = await dbPool.connect()
    try {
      await db.query('BEGIN')
      const result = await run(db)
      await db.query('COMMIT')
      return result
    } catch (error) {
      try { await db.query('ROLLBACK') } catch { /* Preserve original error. */ }
      throw error
    } finally { db.release() }
  }
  function allowed(user, policy) {
    return user?.active === true && user.auth_provider === 'clerk' && policy.subjects.includes(user.auth_subject)
  }
  return {
    async eligibility(userId) {
      const id = creationUserId(userId), policy = salonCreationPolicy(environment)
      if (!policy.enabled) return { can_create: false, reason: 'disabled' }
      return transaction(async db => {
        const user = await lockCreationUser(db, id)
        if (!allowed(user, policy)) return { can_create: false, reason: 'not_allowed' }
        if (await findCreationReceipt(db, id)) return { can_create: false, reason: 'already_created' }
        if (await hasAnyMembership(db, id)) return { can_create: false, reason: 'existing_membership' }
        return { can_create: true, reason: null }
      })
    },
    async create(userId, body) {
      const id = creationUserId(userId), draft = validateSalonCreation(body), policy = salonCreationPolicy(environment)
      if (!policy.enabled) throw creationError('Otvaranje novih salona trenutačno nije dostupno.', 'SALON_CREATION_DISABLED', 403)
      const hash = salonCreationHash(draft)
      return transaction(async db => {
        // Serialize all creation attempts by this account, including different request IDs.
        // The user row lock also conflicts with FK checks of concurrent membership inserts.
        const user = await lockCreationUser(db, id, true)
        if (!allowed(user, policy)) throw creationError('Račun nije uključen u razvojno testiranje otvaranja salona.', 'SALON_CREATION_FORBIDDEN', 403)
        const receipt = await findCreationReceipt(db, id)
        if (receipt) {
          if (receipt.request_id !== draft.request_id) throw creationError('Ovim računom već je otvoren salon.', 'SALON_CREATION_ALREADY_USED', 409)
          if (receipt.request_hash !== hash) throw creationError('Oznaka zahtjeva već je upotrijebljena s drugim podacima.', 'SALON_CREATION_REQUEST_CONFLICT', 409)
          const access = receipt.salon_id && await findReplayAccess(db, id, receipt.salon_id)
          if (!access || String(access.id) !== String(receipt.response.membership_id)) {
            throw creationError('Ranije kreirani salon više nije dostupan ovom računu.', 'SALON_CREATION_RESULT_UNAVAILABLE', 403)
          }
          return { ...receipt.response, replayed: true }
        }
        if (await hasAnyMembership(db, id)) throw creationError('Račun već ima članstvo. Nastavite putem postojećeg salona ili pozivnice.', 'SALON_CREATION_MEMBERSHIP_EXISTS', 409)
        if (!await supportsTimezone(db, draft.timezone)) throw creationError('Vremenska zona nije podržana u bazi.')
        return { ...await insertCreatedSalon(db, id, draft, hash), replayed: false }
      })
    },
    async status(userId, salonId) {
      const id = creationUserId(userId), sid = creationUserId(salonId)
      return transaction(async db => {
        const result = await findOnboardingStatus(db, id, sid)
        if (!result) throw creationError('Salon nije dostupan ovom računu.', 'SALON_ONBOARDING_FORBIDDEN', 403)
        return result
      })
    },
  }
}
export const salonCreationService = createSalonCreationService()
