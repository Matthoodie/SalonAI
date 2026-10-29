import { salonFetch } from './salonApiContext.js'
import { selectedPayload, isUuid, positiveId, cents, clean } from '../components/ServiceImport/pricelistDraft.js'
const fail = () => { throw new Error('Odgovor uvoza nije moguće potvrditi. Nemojte pokretati novi uvoz istih stavki.') }
function safePayload(payload, confirm) {
  const safe=selectedPayload(payload.items.map(row=>({...row,selected:true})))
  if(payload.currency!=='EUR') throw new Error('Cijene trebaju biti u eurima.')
  if(confirm) {
    if(!isUuid(payload.request_id)) throw new Error('Neispravna oznaka potvrde.')
    safe.request_id=payload.request_id
  }
  // Keep both preview and confirmation below the existing Express JSON limit.
  if(new TextEncoder().encode(JSON.stringify(safe)).length>95*1024) throw new Error('Odabrane stavke sadrže previše teksta. Uvezite manji broj stavki odjednom.')
  return safe
}
export function createServiceImportApi({request=salonFetch}={}) {
  async function post(endpoint,payload,signal) {
    const response=await request('/api/services/import/'+endpoint,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal,
    })
    const body=await response.json()
    if(!response.ok) {
      const error=new Error(body?.error?.message || 'Uvoz trenutno nije dostupan.')
      error.status=response.status;error.code=body?.error?.code
      // Only recognized pre-write rejections prove that this attempt did not commit.
      error.definitive=[400,401,403,409,422].includes(response.status) && [
        'SERVICE_IMPORT_INVALID','SERVICE_IMPORT_REVIEW_REQUIRED','SERVICE_IMPORT_FORBIDDEN',
      ].includes(error.code)
      throw error
    }
    return {data:body?.data,status:response.status}
  }
  return {
    async preview(payload,signal) {
      const safe=safePayload(payload,false)
      const {data,status}=await post('preview',safe,signal)
      if(status!==200 || data?.currency!=='EUR' || !Array.isArray(data.rows) || data.rows.length!==safe.items.length) fail()
      const seen=new Set()
      for(const row of data.rows) {
        const input=safe.items.find(i=>i.row_id===row.row_id)
        if(!input || seen.has(row.row_id) || typeof row.ready!=='boolean' || !Array.isArray(row.issues) ||
          !Array.isArray(row.duplicates) || !Array.isArray(row.duplicate_row_ids) || !Number.isInteger(row.duplicate_count) || row.duplicate_count<0 ||
          row.issues.some(i=>typeof i.message!=='string' || typeof i.code!=='string' || typeof i.field!=='string') ||
          row.ready!==(row.issues.length===0) ||
          row.duplicates.some(d=>!positiveId(d.service_id) || typeof d.name!=='string' || typeof d.category!=='string' || typeof d.active!=='boolean') ||
          row.duplicate_row_ids.some(id=>id===row.row_id || !safe.items.some(i=>i.row_id===id))) fail()
        if(row.ready && (row.name!==clean(input.name) || row.category!==(clean(input.category)||'Ostalo') ||
          row.price_cents!==cents(input.price_eur) || row.default_duration_minutes!==Number(input.default_duration_minutes) ||
          row.allow_duplicate!==input.allow_duplicate ||
          (!row.allow_duplicate && (row.duplicate_count>0 || row.duplicate_row_ids.length>0)))) fail()
        seen.add(row.row_id)
      }
      if(data.ready_count!==data.rows.filter(r=>r.ready).length || data.needs_review_count!==data.rows.filter(r=>!r.ready).length) fail()
      return data
    },
    async confirm(payload,salonId) {
      if(!positiveId(salonId)) throw new Error('Salon nije dostupan.')
      const safe=safePayload(payload,true)
      const {data,status}=await post('confirm',safe)
      if(![200,201].includes(status) || data?.request_id!==safe.request_id || data.currency!=='EUR' ||
        data.replayed!==(status===200) || data.created_count!==safe.items.length ||
        !Array.isArray(data.services) || data.services.length!==safe.items.length ||
        !Array.isArray(data.row_service_ids) || data.row_service_ids.length!==safe.items.length) fail()
      const ids=new Set()
      for(const input of safe.items) {
        const matches=data.row_service_ids.filter(pair=>pair.row_id===input.row_id)
        if(matches.length!==1) fail()
        const service=data.services.find(s=>String(s.id)===String(matches[0].service_id))
        if(!service || !positiveId(service.id) || ids.has(String(service.id)) || String(service.salon_id)!==String(salonId) ||
          service.name!==clean(input.name) || service.category!==(clean(input.category)||'Ostalo') ||
          service.price_cents!==cents(input.price_eur) || service.default_duration_minutes!==Number(input.default_duration_minutes) ||
          service.active!==true) fail()
        ids.add(String(service.id))
      }
      return data
    },
  }
}
export const serviceImportApi=createServiceImportApi()
