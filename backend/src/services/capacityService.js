import pool from '../database/pool.js'
import { capacityId, capacityDays, capacityRange, capacityError, buildCapacityReport } from '../utils/capacityCalendar.js'
import { readCapacityAccess, readCapacitySnapshot } from '../repositories/capacityRepository.js'

export function createCapacityService({database=pool,clock=()=>new Date(),readAccess=readCapacityAccess,readSnapshot=readCapacitySnapshot}={}) {
  return async function getCapacity(context,query={}) {
    const salonId=capacityId(context.salonId),userId=capacityId(context.userId),days=capacityDays(query)
    const db=await database.connect()
    try {
      await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
      await db.query("SET LOCAL statement_timeout='5000ms'")
      const access=await readAccess(db,{salonId,userId})
      if(!access)throw capacityError('CAPACITY_FORBIDDEN',403)
      const asOf=clock().toISOString(),{dates,range}=capacityRange(access.timezone,asOf,days)
      const snapshot=await readSnapshot(db,salonId,access.timezone,dates,range)
      const result=buildCapacityReport(snapshot,days,asOf)
      await db.query('COMMIT')
      return result
    }catch(error){
      try{await db.query('ROLLBACK')}catch{/* Preserve the original failure. */}
      if(error.code==='57014')throw capacityError('CAPACITY_TIMEOUT',503)
      throw error
    }finally{db.release()}
  }
}
export const getCapacity=createCapacityService()
