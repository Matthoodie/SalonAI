import {salonFetch} from './salonApiContext.js'
const id=v=>['string','number'].includes(typeof v)&&/^[1-9]\d*$/.test(String(v))&&Number.isSafeInteger(Number(v))
const invalid=()=>new Error('Odgovor postavljanja nije moguće potvrditi. Osvježite podatke.')
export function creationPayload(d) {
  if (!d || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(d.request_id) ||
      !['hair','grooming','mixed','other'].includes(d.business_type)) throw invalid()
  const result={request_id:d.request_id.toLowerCase()}
  for(const [k,max,required] of [['name',150,true],['timezone',100,true],['location',250,false]]) {
    if(typeof d[k]!=='string'||/[\u0000-\u001f\u007f]/u.test(d[k])||[...d[k].trim()].length>max||(required&&!d[k].trim()))throw invalid()
    result[k]=d[k].trim()
  }
  try{new Intl.DateTimeFormat('en',{timeZone:result.timezone}).format()}catch{throw invalid()}
  result.business_type=d.business_type
  return result
}
export function pendingCreation(storage,userId,body) {
  if(!id(userId))throw invalid()
  const key='salonai:create:v1:'+userId
  if(body!==undefined){const payload=creationPayload(body);storage.setItem(key,JSON.stringify(payload));return payload}
  const raw=storage.getItem(key)
  return raw===null?null:creationPayload(JSON.parse(raw))
}
export function clearCreation(storage,userId){storage.removeItem('salonai:create:v1:'+userId)}
export function validateOnboarding(d,salonId,review=false){
  if(!id(salonId)||!id(d?.salon_id)||String(d.salon_id)!==String(salonId)||!['not_required','in_progress','completed'].includes(d.status))throw invalid()
  if(!review){if(d.requires_setup!==(d.status==='in_progress'))throw invalid();return d}
  if(!Number.isInteger(d.revision)||d.revision<0||typeof d.ready!=='boolean'||!Array.isArray(d.issues)||
    d.issues.some(i=>!['salon','team','services','schedule'].includes(i.step)||typeof i.message!=='string'||!i.message)||
    d.ready!==(d.issues.length===0)||['employees','services','uncovered_services'].some(k=>!Number.isInteger(d.counts?.[k])||d.counts[k]<0))throw invalid()
  if(d.ready&&(d.counts.employees<1||d.counts.services<1||d.counts.uncovered_services!==0))throw invalid()
  return d
}
export function createOnboardingApi(request=salonFetch){
  async function call(path,options){const r=await request('/api/salon-onboarding/'+path,options);const b=await r.json();if(!r.ok)throw Object.assign(new Error(b?.error?.message||'Postavljanje trenutačno nije dostupno.'),{statusCode:r.status,code:b?.error?.code});return b?.data}
  return {
    async eligibility(signal){const d=await call('eligibility',{signal});if(typeof d?.can_create!=='boolean'||(d.can_create?d.reason!==null:!['disabled','not_allowed','already_created','existing_membership'].includes(d.reason)))throw invalid();return d},
    async create(body,signal){const d=await call('salons',{signal,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(creationPayload(body))});if(!id(d?.salon_id)||!id(d?.membership_id)||typeof d.replayed!=='boolean')throw invalid();return d},
    async status(salonId,signal){return validateOnboarding(await call('status',{signal}),salonId)},
    async readiness(salonId,signal){return validateOnboarding(await call('readiness',{signal}),salonId,true)},
    async complete(salonId,revision,signal){if(!Number.isInteger(revision)||revision<1)throw invalid();const d=validateOnboarding(await call('complete',{signal,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expected_revision:revision})}),salonId,true);if(!['completed','not_required'].includes(d.status))throw invalid();return d},
  }
}
export const onboardingApi=createOnboardingApi()
