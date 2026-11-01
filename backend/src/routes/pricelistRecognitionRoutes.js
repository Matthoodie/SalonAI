import express from 'express'
import { createPricelistRecognizer } from '../services/pricelistRecognitionService.js'
import { MAX_DOCUMENT_BYTES, recognitionError } from '../utils/pricelistRecognition.js'
export function createPricelistRecognitionRouter({recognize=createPricelistRecognizer()}={}) {
  const router=express.Router(),active=new Set()
  router.post('/',(req,res,next)=>{
    res.set('Cache-Control','no-store')
    const user=req.currentUser,salon=req.currentSalon,member=req.currentMembership
    if(!Number.isSafeInteger(Number(user?.id)) || Number(user?.id)<1 || !Number.isSafeInteger(Number(salon?.id)) || Number(salon?.id)<1 ||
      user.active!==true || salon.active===false || member?.active!==true || !['owner','admin'].includes(member.role) ||
      String(member.userId)!==String(user.id) || String(member.salonId)!==String(salon.id))
      return next(recognitionError('Nemate ovlast za prepoznavanje cjenika.',403,'PRICELIST_RECOGNITION_FORBIDDEN'))
    if(!req.is('application/octet-stream'))return next(recognitionError('Pošaljite dokument kao datoteku.',415))
    const key=String(salon.id)
    if(active.has(key)||active.size>=4)return next(recognitionError('Obrada je već u tijeku. Pričekajte završetak.',429,'PRICELIST_RECOGNITION_BUSY'))
    active.add(key)
    const cleanup=()=>active.delete(key)
    res.once('finish',cleanup);res.once('close',cleanup)
    next()
  },express.raw({type:'application/octet-stream',limit:MAX_DOCUMENT_BYTES,inflate:false}),async(req,res,next)=>{
    const controller=new AbortController()
    const abort=()=>{if(!res.writableEnded)controller.abort()}
    res.once('close',abort)
    try {
      const data=await recognize(req.body,req.currentSalon.id,controller.signal)
      if(!controller.signal.aborted)res.json({data})
    } catch(error){next(error)}
    finally {res.removeListener('close',abort)}
  })
  // Avoid logging raw request bodies, provider responses, documents or credentials.
  router.use((error,req,res,next)=>{
    if(res.headersSent)return next(error)
    const known=error?.code?.startsWith('PRICELIST_RECOGNITION_')
    const status=error?.type==='entity.too.large'?413:known?error.statusCode:503
    res.status(status).json({error:{code:known?error.code:'PRICELIST_RECOGNITION_UNAVAILABLE',
      message:error?.type==='entity.too.large'?'Datoteka smije imati najviše 8 MB.':known?error.message:'Prepoznavanje trenutno nije dostupno. Provjerite konfiguraciju i migracije poslužitelja.'}})
  })
  return router
}
export default createPricelistRecognitionRouter()
