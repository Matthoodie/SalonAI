import pool from '../database/pool.js'
import { findSetupOwner } from '../repositories/salonSetupRepository.js'
import { readinessState } from '../repositories/onboardingReadinessRepository.js'
import { creationError, creationUserId } from '../utils/salonCreationValidation.js'
import { completionRevision, evaluateReadiness } from '../utils/onboardingReadiness.js'
export function createOnboardingReadinessService({ dbPool=pool }={}) {
  async function run(userId, salonId, revision) {
    const ids={userId:creationUserId(userId),salonId:creationUserId(salonId)}
    const db=await dbPool.connect()
    try {
      await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ')
      if (!await findSetupOwner(db,ids)) throw creationError('Postavljanje može završiti samo aktivni vlasnik salona.','SALON_ONBOARDING_FORBIDDEN',403)
      const state=await readinessState(db,ids.salonId)
      const readiness=evaluateReadiness(state.setup,state.counts)
      if (revision !== undefined && state.status === 'in_progress') {
        if (state.setup?.revision !== revision) throw creationError('Postavljanje je promijenjeno. Ponovno učitajte pregled.','SALON_SETUP_VERSION_CONFLICT',409)
        if (!readiness.ready) throw creationError('Salon još nije spreman. Ponovno učitajte pregled i dopunite označene korake.','SALON_ONBOARDING_NOT_READY',409)
        await db.query("UPDATE salon_onboarding SET status='completed',completed_at=clock_timestamp() WHERE salon_id=$1 AND status='in_progress'",[ids.salonId])
        state.status='completed'
      }
      const result={salon_id:String(ids.salonId),status:state.status,revision:state.setup?.revision??0,counts:state.counts,...readiness}
      await db.query('COMMIT')
      return result
    } catch(error) {
      try {await db.query('ROLLBACK')} catch { /* Preserve error. */ }
      throw error
    } finally {db.release()}
  }
  return {read:(userId,salonId)=>run(userId,salonId),complete:(userId,salonId,body)=>run(userId,salonId,completionRevision(body))}
}
export const onboardingReadinessService=createOnboardingReadinessService()
