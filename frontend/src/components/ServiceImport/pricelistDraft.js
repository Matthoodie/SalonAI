export const MAX_ROWS = 100
export function newDraftRow(id = crypto.randomUUID()) {
  return { row_id: id, selected: true, name: '', category: '', price_eur: '', default_duration_minutes: '', allow_duplicate: false }
}
export function selectedPayload(rows) {
  const selected = rows.filter(row => row.selected)
  if (!selected.length || selected.length > MAX_ROWS) throw new Error('Odaberite od 1 do 100 stavki.')
  const ids = new Set()
  const items = selected.map(row => {
    if (typeof row.row_id !== 'string' || !/^[\w-]{1,64}$/.test(row.row_id) || ids.has(row.row_id)) throw new Error('Neispravne oznake stavki.')
    ids.add(row.row_id)
    for (const key of ['name','category','price_eur','default_duration_minutes']) {
      if (typeof row[key] !== 'string') throw new Error('Neispravni podaci stavke.')
    }
    return {row_id:row.row_id,name:row.name,category:row.category,price_eur:row.price_eur,
      default_duration_minutes:row.default_duration_minutes,allow_duplicate:row.allow_duplicate === true}
  })
  return {currency:'EUR',items}
}
export function fingerprint(payload) { return JSON.stringify(payload) }
export function editDraftRow(rows, id, field, value) {
  if (!['name','category','price_eur','default_duration_minutes','selected','allow_duplicate'].includes(field)) return rows
  return rows.map(row => row.row_id !== id ? row : {
    ...row,[field]:value,
    // A duplicate acknowledgement belongs to the reviewed identity, not a later name/category.
    ...(['name','category'].includes(field) ? {allow_duplicate:false} : {}),
  })
}
export function applyDuration(rows, duration, onlyMissing = true) {
  if (!/^[1-9]\d*$/.test(duration.trim()) || Number(duration) > 2147483647) throw new Error('Unesite trajanje u cijelim minutama, najmanje 1.')
  return rows.map(row => row.selected && (!onlyMissing || !row.default_duration_minutes.trim())
    ? {...row,default_duration_minutes:String(Number(duration))} : row)
}
export function reviewIsCurrent(review, payload) {
  return Boolean(review && review.fingerprint === fingerprint(payload) && review.data.rows.length && review.data.rows.every(row=>row.ready))
}
export function isUuid(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) }
export function positiveId(value) { return ['string','number'].includes(typeof value) && /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value)) }
export function cents(value) {
  const match = typeof value === 'string' && /^(\d{1,10})(?:[.,](\d{1,2}))?$/.exec(value.trim())
  if (!match) return null
  const result = Number(match[1])*100+Number((match[2]??'').padEnd(2,'0'))
  return result<=2147483647 ? result : null
}
export function clean(value) { return value.normalize('NFC').trim().replace(/\s+/gu,' ') }
export function pendingRows(payload) {
  return payload.items.map(row=>({...row,selected:true}))
}
// Only an in-flight/uncertain confirmation is retained across reloads. Ordinary drafts stay in memory.
export function createPendingStore(storage, userId, salonId) {
  if (!positiveId(userId) || !positiveId(salonId)) throw new Error('Korisnik i salon nisu dostupni.')
  const key = `salonai:pricelist-pending:v1:${userId}:${salonId}`
  function validate(value) {
    if (!value || value.userId !== String(userId) || value.salonId !== String(salonId) || !isUuid(value.payload?.request_id)) throw new Error('Neispravan zapis prethodne potvrde. Nemojte ponovno uvoziti iste stavke prije provjere kataloga.')
    const safe=selectedPayload(pendingRows(value.payload))
    if (value.payload.currency !== 'EUR' || fingerprint({...safe,request_id:value.payload.request_id}) !== fingerprint(value.payload)) throw new Error('Prethodna potvrda nije čitljiva. Provjerite katalog prije novog uvoza.')
    return value.payload
  }
  return {
    read() { const raw=storage.getItem(key);return raw === null ? null : validate(JSON.parse(raw)) },
    write(payload) {
      const value={userId:String(userId),salonId:String(salonId),payload}
      validate(value)
      storage.setItem(key,JSON.stringify(value))
      if (storage.getItem(key)!==JSON.stringify(value)) throw new Error('Preglednik nije sačuvao potvrdu uvoza. Spremanje nije poslano.')
    },
    clear() { storage.removeItem(key) },
  }
}
