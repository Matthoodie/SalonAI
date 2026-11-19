import express, {Router} from 'express'
import {requireAuthenticatedUser} from '../middleware/authenticatedUserMiddleware.js'
import {supportOperationsService} from '../services/supportOperationsService.js'
import {supportNoStore,supportErrorHandler} from '../middleware/supportErrorHandler.js'
import {operationError} from '../utils/supportOperations.js'
import {supportId} from '../utils/supportTicketValidation.js'
export function createSupportOperationsRouter({authenticate=requireAuthenticatedUser,service=supportOperationsService}={}) {
  const router=Router()
  router.use(supportNoStore,authenticate)
  router.use((req,res,next)=>{
    if (!req.currentUser) throw operationError('UNAUTHENTICATED',401)
    if (req.currentUser.active!==true) throw operationError('SUPPORT_FORBIDDEN',403)
    req.supportUserId=supportId(req.currentUser.id)
    next()
  })
  const noQuery=(req,res,next)=>{if(Object.keys(req.query).length)throw operationError('SUPPORT_VALIDATION_ERROR');next()}
  router.get('/access',noQuery,async(req,res)=>res.json({data:await service.access(req.supportUserId)}))
  router.get('/tickets',async(req,res)=>res.json({data:await service.list(req.supportUserId,req.query)}))
  router.get('/tickets/:id',noQuery,async(req,res)=>res.json({data:await service.detail(req.supportUserId,req.params.id)}))
  router.get('/tickets/:id/messages',async(req,res)=>res.json({data:await service.messages(req.supportUserId,req.params.id,req.query,true)}))
  router.post('/tickets/:id/operations',noQuery,(req,res,next)=>{
    if(!req.is('application/json'))throw operationError('SUPPORT_CONTENT_TYPE',415)
    next()
  },express.json({limit:'32kb',inflate:false}),async(req,res)=>{
    const result=await service.apply(req.supportUserId,req.params.id,req.body)
    res.status(result.replayed ? 200 : 201).json({data:result})
  })
  router.use((req,res)=>res.status(404).json({error:{code:'SUPPORT_NOT_FOUND',message:'Support resource was not found.'}}))
  router.use(supportErrorHandler)
  return router
}
export default createSupportOperationsRouter()
