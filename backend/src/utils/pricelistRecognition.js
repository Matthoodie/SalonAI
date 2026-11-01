export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024
export function recognitionError(message, statusCode=422, code='PRICELIST_RECOGNITION_INVALID') {
  return Object.assign(new Error(message), {statusCode,code})
}
export function documentKind(bytes) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_DOCUMENT_BYTES)
    throw recognitionError('Odaberite datoteku do 8 MB.',413)
  if (bytes.subarray(0,5).toString()==='%PDF-') return 'pdf'
  if (bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png'
  if (bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return 'jpeg'
  throw recognitionError('Podržani su JPEG, PNG i PDF. HEIC fotografiju prvo pretvorite u JPEG.')
}
const text = (value, max) => {
  if (typeof value !== 'string' || value.length > max) throw recognitionError('Prepoznati odgovor nije valjan. Nacrt nije promijenjen.')
  return value.replace(/[\u0000-\u001f\u007f]/g,' ').trim()
}
export function normalizeRecognition(value) {
  if (!value || !Array.isArray(value.items) || value.items.length>100 || !Array.isArray(value.warnings) || value.warnings.length>20 || typeof value.truncated!=='boolean')
    throw recognitionError('Prepoznati odgovor nije valjan. Nacrt nije promijenjen.')
  if (value.truncated) throw recognitionError('Cjenik je prevelik za jednu obradu. Pošaljite manji dio dokumenta.')
  return {
    warnings:value.warnings.map(w=>text(w,500)),
    items:value.items.map(item=>{
      const name=text(item.name,150),category=text(item.category,100)||'Ostalo'
      const price=text(item.price_text,60),currency=text(item.currency,20).toUpperCase()
      const note=text(item.warning,500)
      if (!['fixed','from','range','unknown'].includes(item.price_kind) ||
        !(item.duration_minutes===null || Number.isInteger(item.duration_minutes) && item.duration_minutes>0 && item.duration_minutes<=1440) || !name)
        throw recognitionError('Prepoznata stavka nije valjana. Nacrt nije promijenjen.')
      const fixed=item.price_kind==='fixed' && ['EUR','€'].includes(currency) && /^\d{1,7}([.,]\d{1,2})?$/.test(price)
      return {name,category,price_eur:fixed?price.replace('.',','):'',
        default_duration_minutes:item.duration_minutes===null?'':String(item.duration_minutes),
        recognition_note:[note,!fixed?`Provjerite cijenu i valutu: ${price || 'nije navedena'} ${currency || '(nepoznata valuta)'}.`:'',
          item.duration_minutes===null?'Trajanje nije navedeno; dopunite prije spremanja.':''].filter(Boolean).join(' ')}
    }),
  }
}
export const recognitionSchema = {
  type:'object',additionalProperties:false,required:['items','warnings','truncated'],properties:{
    items:{type:'array',maxItems:100,items:{type:'object',additionalProperties:false,
      required:['name','category','price_text','currency','price_kind','duration_minutes','warning'],properties:{
        name:{type:'string',maxLength:150},category:{type:'string',maxLength:100},price_text:{type:'string',maxLength:60},
        currency:{type:'string',maxLength:20},price_kind:{type:'string',enum:['fixed','from','range','unknown']},
        duration_minutes:{type:['integer','null'],minimum:1,maximum:1440},warning:{type:'string',maxLength:500},
      }}},warnings:{type:'array',maxItems:20,items:{type:'string',maxLength:500}},truncated:{type:'boolean'},
  },
}
