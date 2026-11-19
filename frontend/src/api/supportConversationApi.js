import {supportCategories,supportPages,supportClientError} from './supportApi.js'
export const supportStatuses=Object.freeze(['open','pending','resolved','closed'])
export function conversationId(value){
 if(!['string','number'].includes(typeof value)||!(/^[1-9]\d*$/).test(String(value))||!Number.isSafeInteger(Number(value)))throw supportClientError('SUPPORT_VALIDATION_ERROR')
 return String(value)
}
const invalid=()=>{throw supportClientError('SUPPORT_INVALID_RESPONSE')}
export function operatorPayload(input){
 const fail=()=>{throw supportClientError('SUPPORT_VALIDATION_ERROR')}
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['request_id','expected_revision','kind','body','status'].includes(k)))fail()
 if(typeof input.request_id!=='string'||!(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i).test(input.request_id))fail()
 if(!Number.isInteger(input.expected_revision)||input.expected_revision<1||input.expected_revision>=2147483647||!['reply','status'].includes(input.kind))fail()
 if(input.status!==undefined&&!supportStatuses.includes(input.status))fail()
 const result={request_id:input.request_id.toLowerCase(),expected_revision:input.expected_revision,kind:input.kind}
 if(input.kind==='reply'){
  if(typeof input.body!=='string'||input.body.length>10100)fail()
  const body=input.body.replace(/\r\n/g,'\n').trim()
  if([...body].length<1||[...body].length>5000||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(body)||/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(body))fail()
  result.body=body
 }else if(input.body!==undefined||input.status===undefined)fail()
 if(input.status!==undefined)result.status=input.status
 return result
}
function parseTicket(row,detail=false){
 try{
  const id=conversationId(row?.id),salon=row.salon_id===null?null:conversationId(row.salon_id)
  if(!supportCategories.includes(row.category)||!supportStatuses.includes(row.status)||!['hr','en'].includes(row.language)||typeof row.subject!=='string'||[...row.subject].length<5||[...row.subject].length>160||!Number.isInteger(row.revision)||row.revision<1)invalid()
  for(const key of ['created_at','updated_at'])if(typeof row[key]!=='string'||!Number.isFinite(Date.parse(row[key])))invalid()
  const result={id,salon_id:salon,category:row.category,subject:row.subject,language:row.language,status:row.status,revision:row.revision,created_at:row.created_at,updated_at:row.updated_at}
  if(detail){if(typeof row.description!=='string'||[...row.description].length<20||[...row.description].length>5000||!supportPages.includes(row.context?.page))invalid();result.description=row.description;result.context={page:row.context.page}}
  return result
 }catch{invalid()}
}
export function createSupportConversationApi(request=(...args)=>globalThis.fetch(...args)){
 async function call(path,options={}){
  const response=await request(path,{...options,credentials:'same-origin',cache:'no-store',redirect:'error'})
  let body;try{body=await response.json()}catch{invalid()}
  if(options.signal?.aborted)throw Object.assign(supportClientError('SUPPORT_ABORTED'),{name:'AbortError'})
  if(!response.ok)throw Object.assign(supportClientError(typeof body?.error?.code==='string'?body.error.code:'SUPPORT_UNAVAILABLE'),{statusCode:response.status})
  return body?.data
 }
 return {
  async access(signal){const data=await call('/api/support/operations/access',{signal});if(data?.allowed!==true)invalid();return true},
  async list({before=null,status=null}={},signal){
   const query=new URLSearchParams()
   if(before!==null)query.set('before',conversationId(before))
   if(status!==null){if(!supportStatuses.includes(status))throw supportClientError('SUPPORT_VALIDATION_ERROR');query.set('status',status)}
   const data=await call('/api/support/operations/tickets'+(query.size?'?'+query:''),{signal})
   if(!Array.isArray(data?.tickets)||data.tickets.length>20)invalid()
   const tickets=data.tickets.map(r=>parseTicket(r))
   if(tickets.some((r,i)=>(before!==null&&Number(r.id)>=Number(before))||(i>0&&Number(r.id)>=Number(tickets[i-1].id))||(status!==null&&r.status!==status)))invalid()
   if(data.next_before!==null&&(!tickets.length||tickets.length!==20||String(data.next_before)!==tickets.at(-1).id))invalid()
   return {tickets,next_before:data.next_before===null?null:conversationId(data.next_before)}
  },
  async messages(id,{after=null,operator=false}={},signal){
   const tid=conversationId(id);if(typeof operator!=='boolean')throw supportClientError('SUPPORT_VALIDATION_ERROR')
   const root=operator?'/api/support/operations/tickets':'/api/support/tickets'
   const data=await call(root+'/'+tid+'/messages'+(after===null?'':'?after='+conversationId(after)),{signal})
   const ticket=parseTicket(data?.ticket,true);if(ticket.id!==tid||!Array.isArray(data?.messages)||data.messages.length>50)invalid()
   const messages=data.messages.map(row=>{
    let mid;try{mid=conversationId(row?.id)}catch{invalid()}
    if(typeof row.body!=='string'||[...row.body].length<1||[...row.body].length>5000||typeof row.created_at!=='string'||!Number.isFinite(Date.parse(row.created_at)))invalid()
    return {id:mid,body:row.body,created_at:row.created_at}
   })
   if(messages.some((r,i)=>(after!==null&&Number(r.id)<=Number(after))||(i>0&&Number(r.id)<=Number(messages[i-1].id))))invalid()
   if(data.next_after!==null&&(messages.length!==50||String(data.next_after)!==messages.at(-1).id))invalid()
   return {ticket,messages,next_after:data.next_after===null?null:conversationId(data.next_after)}
  },
  async apply(id,input,signal){
   const tid=conversationId(id),payload=operatorPayload(input)
   const data=await call('/api/support/operations/tickets/'+tid+'/operations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal})
   if(!data||String(data.ticket_id)!==tid||data.revision!==payload.expected_revision+1||!supportStatuses.includes(data.status)||typeof data.replayed!=='boolean'||(payload.status!==undefined&&data.status!==payload.status))invalid()
   let messageId=null
   if(payload.kind==='reply'){try{messageId=conversationId(data.message_id)}catch{invalid()}}else if(data.message_id!==null)invalid()
   return {ticket_id:tid,revision:data.revision,status:data.status,message_id:messageId,replayed:data.replayed}
  }
 }
}
export const supportConversationApi=createSupportConversationApi()
