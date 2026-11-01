import { salonFetch } from './salonApiContext.js'
export const MAX_RECOGNITION_BYTES=8*1024*1024
export function validateRecognitionResponse(data,salonId) {
  if(!data || String(data.salon_id)!==String(salonId) || !Array.isArray(data.items) || data.items.length>100 ||
    !Array.isArray(data.warnings) || data.warnings.length>20 || data.warnings.some(w=>typeof w!=='string'||w.length>500))
    throw new Error('Odgovor prepoznavanja nije moguće potvrditi. Nacrt nije promijenjen.')
  const fields={name:150,category:100,price_eur:20,default_duration_minutes:20,recognition_note:800}
  const items=data.items.map(row=>{
    const safe={}
    for(const [field,max] of Object.entries(fields)) {
      if(typeof row?.[field]!=='string'||row[field].length>max)throw new Error('Prepoznata stavka nije valjana.')
      safe[field]=row[field]
    }
    if(!safe.name.trim() || (safe.price_eur && !/^\d{1,7}(,\d{1,2})?$/.test(safe.price_eur)) ||
      (safe.default_duration_minutes && (!/^\d+$/.test(safe.default_duration_minutes)||Number(safe.default_duration_minutes)<1||Number(safe.default_duration_minutes)>1440)))
      throw new Error('Prepoznata stavka nije valjana.')
    return safe
  })
  return {items,warnings:[...data.warnings]}
}
export function createPricelistRecognitionApi({request=salonFetch}={}) {
  return async(file,salonId,signal)=>{
    if(!file || !Number.isInteger(file.size) || file.size<1 || file.size>MAX_RECOGNITION_BYTES)
      throw new Error('Odaberite JPEG, PNG ili PDF do 8 MB.')
    const response=await request('/api/services/import/recognize',{
      method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file,signal,
    })
    const body=await response.json()
    if(!response.ok)throw new Error(body?.error?.message || 'Prepoznavanje nije uspjelo. Zahtjev nije automatski ponovljen.')
    return validateRecognitionResponse(body?.data,salonId)
  }
}
export const recognizePricelist=createPricelistRecognitionApi()
