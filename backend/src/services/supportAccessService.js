import {accessError,accessId,clerkSubject,accessChange,hasSupportAccess} from '../utils/supportAccess.js'
import * as repository from '../repositories/supportAccessRepository.js'
// Call inside the SAME transaction as a future privileged support action.
// Locks are held through its COMMIT; do not reduce this to a cached middleware flag.
export async function requireSupportAccess(db,userId,repo=repository){
 const id=accessId(userId),user=await repo.lockSupportIdentityById(db,id)
 if(user?.active!==true||user.auth_provider!=='clerk')throw accessError('SUPPORT_OPERATOR_FORBIDDEN',403)
 const grant=await repo.readSupportGrant(db,id)
 if(!hasSupportAccess(user,grant))throw accessError('SUPPORT_OPERATOR_FORBIDDEN',403)
 return {userId:id,revision:grant.revision}
}
// Administrative service is CLI-only. Merely holding a support grant cannot call it over HTTP.
export function createSupportAccessService({dbPool,repo=repository}){
 async function transact(database,run){
  if(typeof database!=='string'||!database)throw accessError('SUPPORT_ACCESS_DATABASE')
  const db=await dbPool.connect()
  try{
   await db.query('BEGIN')
   const identity=await repo.databaseIdentity(db)
   if(identity?.name!==database)throw accessError('SUPPORT_ACCESS_DATABASE')
   const result=await run(db,identity)
   await db.query('COMMIT');return result
  }catch(error){try{await db.query('ROLLBACK')}catch{}throw error}finally{db.release()}
 }
 return {
  async inspect(subject,database){
   const target=clerkSubject(subject)
   return transact(database,async(db,identity)=>{
    const user=await repo.findSupportIdentity(db,target)
    if(!user)throw accessError('SUPPORT_ACCESS_TARGET_NOT_FOUND',404)
    const grant=await repo.readSupportGrant(db,user.id)
    return {database:identity.name,userId:String(user.id),subject:user.auth_subject,accountActive:user.active===true,enabled:hasSupportAccess(user,grant),storedEnabled:grant?.enabled===true,revision:grant?.revision??0}
   })
  },
  async change(input,{database,apply=false}={}){
   const change=accessChange(input)
   if(typeof apply!=='boolean')throw accessError('SUPPORT_ACCESS_INVALID')
   return transact(database,async(db,identity)=>{
    // Same lock order as access checks: users, then grant. This also serializes first grants.
    const user=await repo.findSupportIdentity(db,change.subject,true)
    if(!user)throw accessError('SUPPORT_ACCESS_TARGET_NOT_FOUND',404)
    if(change.action==='grant'&&user.active!==true)throw accessError('SUPPORT_ACCESS_TARGET_INACTIVE',403)
    const previous=await repo.readSupportGrant(db,user.id,true),revision=previous?.revision??0
    if(change.expectedRevision!==revision)throw accessError('SUPPORT_ACCESS_REVISION_CONFLICT',409)
    const desired=change.action==='grant',unchanged=desired?hasSupportAccess(user,previous):previous?.enabled!==true
    const result={database:identity.name,userId:String(user.id),subject:user.auth_subject,action:change.action,previousEnabled:previous?.enabled===true,enabled:desired,revision:unchanged?revision:revision+1,changed:!unchanged,applied:apply&&!unchanged}
    if(unchanged||!apply)return result
    await repo.writeSupportGrant(db,user.id,user.auth_subject,desired,revision+1)
    await repo.appendSupportAccessAudit(db,user.id,change,previous?.enabled===true,revision+1)
    return result
   })
  }
 }
}
