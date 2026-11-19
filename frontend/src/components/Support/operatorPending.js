import {conversationId,operatorPayload} from '../../api/supportConversationApi.js'
import {supportClientError} from '../../api/supportApi.js'
const key=(userId,ticketId)=>'zrihtan:support:operation:v1:'+conversationId(userId)+':'+conversationId(ticketId)
export function operatorStorage(){try{return window.sessionStorage}catch{return null}}
export function readOperatorPending(storage,userId,ticketId){
 try{
  const raw=storage.getItem(key(userId,ticketId));if(raw===null)return null
  if(raw.length>40000)throw Error()
  const record=JSON.parse(raw)
  if(record.user_id!==String(userId)||record.ticket_id!==String(ticketId))throw Error()
  return operatorPayload(record.payload)
 }catch{throw supportClientError('SUPPORT_STORAGE_ERROR')}
}
export function saveOperatorPending(storage,userId,ticketId,payload){
 const body=operatorPayload(payload)
 try{storage.setItem(key(userId,ticketId),JSON.stringify({user_id:String(userId),ticket_id:String(ticketId),payload:body}))}catch{throw supportClientError('SUPPORT_STORAGE_ERROR')}
 return body
}
export function clearOperatorPending(storage,userId,ticketId){
 try{storage.removeItem(key(userId,ticketId))}catch{throw supportClientError('SUPPORT_STORAGE_ERROR')}
}
export function newOperatorPayload({kind,body,status},revision,uuid=()=>globalThis.crypto.randomUUID()){
 let request_id;try{request_id=uuid()}catch{throw supportClientError('SUPPORT_BROWSER_ERROR')}
 return operatorPayload({request_id,expected_revision:revision,kind,...(kind==='reply'?{body}:{}),status})
}
