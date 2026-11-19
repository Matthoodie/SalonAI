const validId = value => ['string','number'].includes(typeof value) && /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value))
export const supportClientError = code => Object.assign(new Error('Support request failed.'), {code})
export const supportCategories = ['help','bug','idea']
export const supportPages = ['welcome','onboarding','dashboard','clients','services','employees','appointments','calendar','settings','time_off_requests','blocked_time_requests','other']
export function supportPayload(body) {
  const fail = field => {throw Object.assign(supportClientError('SUPPORT_VALIDATION_ERROR'),{field})}
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k=>!['request_id','category','subject','description','language','salon_id','context'].includes(k))) fail('body')
  if(typeof body.request_id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.request_id))fail('request_id')
  if(!supportCategories.includes(body.category))fail('category')
  if(!['hr','en'].includes(body.language))fail('language')
  const text=(value,min,max,field,multi=false)=>{
    if(typeof value!=='string'||value.length>max*2+100)fail(field)
    const s=value.replace(/\r\n/g,'\n').trim()
    if([...s].length<min||[...s].length>max||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(s)||(!multi&&/[\n\t]/.test(s))||/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s))fail(field)
    return s
  }
  if(body.salon_id!=null&&!validId(body.salon_id))fail('salon_id')
  const context=body.context??{}
  if(typeof context!=='object'||Array.isArray(context)||Object.keys(context).some(k=>!['page','app_version'].includes(k)))fail('context')
  const page=context.page??'other',version=context.app_version??null
  if(!supportPages.includes(page)||(version!==null&&(typeof version!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._+-]{0,39}$/.test(version))))fail('context')
  return {request_id:body.request_id.toLowerCase(),category:body.category,subject:text(body.subject,5,160,'subject'),description:text(body.description,20,5000,'description',true),language:body.language,salon_id:body.salon_id==null?null:String(body.salon_id),context:{page,app_version:version}}
}
export function supportPage(pathname) {
  return ({'/':'dashboard','/clients':'clients','/services':'services','/employees':'employees','/appointments':'appointments','/calendar':'calendar','/settings':'settings','/time-off-requests':'time_off_requests','/blocked-time-requests':'blocked_time_requests'})[pathname]??'other'
}
function ticket(row,detail=false) {
  const bad=()=>{throw supportClientError('SUPPORT_INVALID_RESPONSE')}
  if(!row||!validId(row.id)||(row.salon_id!==null&&!validId(row.salon_id))||!supportCategories.includes(row.category)||!['open','pending','resolved','closed'].includes(row.status)||!['hr','en'].includes(row.language)||typeof row.subject!=='string'||[...row.subject].length>160||[...row.subject].length<5)bad()
  for(const k of ['created_at','updated_at'])if(typeof row[k]!=='string'||!Number.isFinite(Date.parse(row[k])))bad()
  const result={id:String(row.id),salon_id:row.salon_id===null?null:String(row.salon_id),category:row.category,subject:row.subject,language:row.language,status:row.status,created_at:row.created_at,updated_at:row.updated_at}
  if(detail){
    if(typeof row.description!=='string'||[...row.description].length<20||[...row.description].length>5000||!supportPages.includes(row.context?.page))bad()
    result.description=row.description;result.context={page:row.context.page}
  }
  return result
}
export function createSupportApi(request=(...args)=>globalThis.fetch(...args)) {
  async function call(suffix,options={}) {
    const response=await request('/api/support/tickets'+suffix,{...options,credentials:'same-origin',cache:'no-store',redirect:'error'})
    let body
    try{body=await response.json()}catch{throw supportClientError('SUPPORT_INVALID_RESPONSE')}
    if(options.signal?.aborted)throw Object.assign(supportClientError('SUPPORT_ABORTED'),{name:'AbortError'})
    if(!response.ok)throw Object.assign(supportClientError(typeof body?.error?.code==='string'?body.error.code:'SUPPORT_UNAVAILABLE'),{statusCode:response.status,field:body?.error?.field})
    return body
  }
  return {
    async create(input,signal){
      const payload=supportPayload(input),body=await call('',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal})
      if(typeof body?.replayed!=='boolean')throw supportClientError('SUPPORT_INVALID_RESPONSE')
      const row=ticket(body.data,true)
      if(['category','subject','description','language'].some(k=>row[k]!==payload[k])||(row.salon_id!==null&&row.salon_id!==payload.salon_id))throw supportClientError('SUPPORT_INVALID_RESPONSE')
      return {ticket:row,replayed:body.replayed}
    },
    async list(before=null,signal){
      if(before!==null&&!validId(before))throw supportClientError('SUPPORT_VALIDATION_ERROR')
      const body=await call(before===null?'':'?before='+encodeURIComponent(String(before)),{signal}),data=body?.data
      if(!Array.isArray(data?.tickets)||data.tickets.length>20)throw supportClientError('SUPPORT_INVALID_RESPONSE')
      const rows=data.tickets.map(r=>ticket(r))
      if(rows.some((r,i)=>(before!==null&&Number(r.id)>=Number(before))||(i>0&&Number(r.id)>=Number(rows[i-1].id))))throw supportClientError('SUPPORT_INVALID_RESPONSE')
      if(data.next_before!==null&&(!validId(data.next_before)||rows.length!==20||String(data.next_before)!==rows.at(-1).id))throw supportClientError('SUPPORT_INVALID_RESPONSE')
      return {tickets:rows,next_before:data.next_before===null?null:String(data.next_before)}
    },
    async detail(id,signal){
      if(!validId(id))throw supportClientError('SUPPORT_VALIDATION_ERROR')
      const row=ticket((await call('/'+encodeURIComponent(String(id)),{signal}))?.data,true)
      if(row.id!==String(id))throw supportClientError('SUPPORT_INVALID_RESPONSE')
      return row
    },
  }
}
export const supportApi=createSupportApi()
