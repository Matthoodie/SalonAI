import * as repository from '../repositories/supportDeliveryRepository.js'
import {deliveryRequest,contactMatches} from '../utils/supportDelivery.js'
import {replyNotificationPreview} from '../utils/supportNotification.js'

// Internal service only. S3D-B3 supplies real Clerk verification and a guarded CLI.
// No default DB pool, credentials, HTTP route, scheduler or enabled transport.
export function createSupportDeliveryService({dbPool,enabled=false,resolveVerifiedContact,send,repo=repository}={}) {
 if(typeof enabled!=='boolean')throw Error('Delivery enabled must be boolean.')
 async function transaction(fn) {
  const db=await dbPool.connect()
  try{await db.query('BEGIN');const result=await fn(db);await db.query('COMMIT');return result}
  catch(error){try{await db.query('ROLLBACK')}catch{}throw error}
  finally{db.release()}
 }
 async function identity(selection) {
  const row=await repo.readDeliveryIdentity(dbPool,selection.eventId,selection.authorId)
  if(!row?.active||row.auth_provider!=='clerk')return null
  const contact=await resolveVerifiedContact(row.auth_subject)
  return contactMatches(contact,row.auth_subject,selection.allowedRecipient)?{subject:row.auth_subject,email:contact.email}:null
 }
 function dependencies() {
  if(!dbPool||typeof resolveVerifiedContact!=='function')throw Error('Delivery dependencies are required.')
 }
 return {
  async prepare(input) {
   if(!enabled)return {state:'disabled'}
   dependencies()
   const selection=deliveryRequest(input),contact=await identity(selection)
   if(!contact)return {state:'blocked',reason:'contact_not_verified'}
   return transaction(async db=>{
    const row=await repo.lockDeliveryEvent(db,selection.eventId,selection.authorId)
    if(!row?.account_active||row.auth_provider!=='clerk'||row.auth_subject!==contact.subject)return {state:'blocked',reason:'account_unavailable'}
    const preview=replyNotificationPreview(row.ticket_id,row.language)
    return repo.prepareDelivery(db,row,{recipient:contact.email,...preview,activationAfter:selection.activationAfter})
   })
  },
  async runOne(input) {
   if(!enabled)return {state:'disabled'}
   dependencies();if(typeof send!=='function')throw Error('Delivery transport is required.')
   const selection=deliveryRequest(input),contact=await identity(selection)
   if(!contact)return {state:'blocked',reason:'contact_not_verified'}
   const claim=await transaction(async db=>{
    const row=await repo.lockDeliveryEvent(db,selection.eventId,selection.authorId)
    if(!row?.account_active||row.auth_provider!=='clerk'||row.auth_subject!==contact.subject)return {state:'blocked',reason:'account_unavailable'}
    // Every invocation must keep the selected activation boundary.
    if(new Date(row.created_at)<new Date(selection.activationAfter))return {state:row.state,reason:'before_activation'}
    return repo.claimDelivery(db,row,contact.email)
   })
   if(!claim.token)return claim
   // The durable claim has committed before external I/O; no automatic retry.
   let result
   try{result=await send(claim.payload)}catch{result={outcome:'unknown'}}
   return transaction(db=>repo.finishDelivery(db,selection.eventId,claim.token,result))
  },
 }
}
