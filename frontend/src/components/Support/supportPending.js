import {supportClientError,supportPayload} from '../../api/supportApi.js'
function key(userId){
 if(!['string','number'].includes(typeof userId)||!/^[1-9]\d*$/.test(String(userId))||!Number.isSafeInteger(Number(userId)))throw supportClientError('SUPPORT_STORAGE_ERROR')
 return 'zrihtan:support:pending:v1:'+userId
}
export function readSupportPending(storage,userId){
 try{
  const raw=storage.getItem(key(userId));if(raw===null)return null
  if(raw.length>40000)throw Error('size')
  const saved=JSON.parse(raw)
  if(saved.user_id!==String(userId))throw Error('account')
  return supportPayload(saved.payload)
 }catch{throw supportClientError('SUPPORT_STORAGE_ERROR')}
}
export function saveSupportPending(storage,userId,payload){
 const normalized=supportPayload(payload)
 try{storage.setItem(key(userId),JSON.stringify({user_id:String(userId),payload:normalized}))}catch{throw supportClientError('SUPPORT_STORAGE_ERROR')}
 return normalized
}
export function clearSupportPending(storage,userId){
 try{storage.removeItem(key(userId))}catch{throw supportClientError('SUPPORT_STORAGE_ERROR')}
}
export function newSupportRequest(draft,{language,salonId=null,page='other'},uuid=()=>globalThis.crypto.randomUUID()){
 let requestId
 try{requestId=uuid()}catch{throw supportClientError('SUPPORT_BROWSER_ERROR')}
 return supportPayload({request_id:requestId,category:draft.category,subject:draft.subject,description:draft.description,language,salon_id:salonId,context:{page,app_version:null}})
}
