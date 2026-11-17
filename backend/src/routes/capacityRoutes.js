import { Router } from 'express'
import { getCapacity } from '../services/capacityService.js'
import { capacityDays,capacityId,capacityError } from '../utils/capacityCalendar.js'
export function createCapacityRouter({service=getCapacity}={}) {
  const router=Router()
  router.get('/',async(req,res,next)=>{
    res.set('Cache-Control','private, no-store')
    try{
      const m=req.currentMembership,u=req.currentUser,s=req.currentSalon
      if(!u||!s||!m||u.active!==true||s.active===false||m.active!==true||
        !['owner','admin'].includes(m.role)||String(m.userId)!==String(u.id)||String(m.salonId)!==String(s.id))throw capacityError('CAPACITY_FORBIDDEN',403)
      const salonId=capacityId(s.id),userId=capacityId(u.id)
      capacityDays(req.query)
      res.json({data:await service({salonId,userId},req.query)})
    }catch(error){next(error)}
  })
  return router
}
export default createCapacityRouter()
