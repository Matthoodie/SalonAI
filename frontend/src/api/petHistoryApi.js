import { salonFetch } from './salonApiContext.js'
const id = value => ['string','number'].includes(typeof value) && /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value))
const same = (a,b) => id(a) && id(b) && String(a) === String(b)
const invalid = () => Object.assign(new Error('Povijest nije moguće potvrditi. Osvježite pregled.'), { code: 'PET_HISTORY_INVALID_RESPONSE' })
const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*Z$/.test(value) && Number.isFinite(Date.parse(value))
const integer = value => Number.isInteger(value) && value >= 0 && value <= 2147483647
const text = (value, max, required = false) => typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0)
export const HISTORY_STATUSES = { pending: 'Na čekanju', confirmed: 'Zakazano', completed: 'Završeno', cancelled: 'Otkazano', no_show: 'Nedolazak' }
export function validateHistory(data, context) {
  if (!data || !same(data.salon_id, context.salonId) || !same(data.client_id, context.clientId) || !same(data.pet_id, context.petId) ||
      typeof data.timezone !== 'string' || !data.timezone || !Array.isArray(data.appointments) || data.appointments.length > 20 ||
      !(data.next_cursor === null || (typeof data.next_cursor === 'string' && /^[A-Za-z0-9_-]{1,600}$/.test(data.next_cursor))) ||
      (data.next_cursor !== null && (data.appointments.length !== 20 || data.next_cursor === context.cursor))) throw invalid()
  try { new Intl.DateTimeFormat('hr-HR', { timeZone: data.timezone }).format() } catch { throw invalid() }
  const appointments = data.appointments.map(row => {
    if (!id(row?.id) || !same(row.salon_id, context.salonId) || !same(row.client_id, context.clientId) || !same(row.pet_id, context.petId) ||
        !text(row.pet_name,200,true) || !['dog','cat','other'].includes(row.pet_species) || !text(row.pet_breed,300) ||
        !timestamp(row.starts_at) || !timestamp(row.ends_at) || Date.parse(row.ends_at) <= Date.parse(row.starts_at) ||
        !Object.hasOwn(HISTORY_STATUSES,row.status) || !integer(row.duration_minutes) || row.duration_minutes < 1 || !integer(row.price_cents) ||
        !(row.employee_name === null || text(row.employee_name,500,true)) || !Array.isArray(row.items) || row.items.length > 20) throw invalid()
    const items = row.items.map((item,index) => {
      if (!id(item?.service_id) || item.position !== index + 1 || !text(item.name,1000,true) || !integer(item.price_cents) ||
          !integer(item.duration_minutes) || item.duration_minutes < 1) throw invalid()
      return { service_id: item.service_id, position: item.position, name: item.name, price_cents: item.price_cents, duration_minutes: item.duration_minutes }
    })
    if (new Set(items.map(item=>String(item.service_id))).size !== items.length ||
        (items.length && (items.reduce((sum,item)=>sum+item.price_cents,0) !== row.price_cents || items.reduce((sum,item)=>sum+item.duration_minutes,0) !== row.duration_minutes))) throw invalid()
    return { ...Object.fromEntries(['id','pet_name','pet_species','pet_breed','starts_at','ends_at','status','duration_minutes','price_cents','employee_name'].map(key=>[key,row[key]])), items }
  })
  if (new Set(appointments.map(row=>String(row.id))).size !== appointments.length || appointments.some((row,index)=>index > 0 && Date.parse(row.starts_at) > Date.parse(appointments[index-1].starts_at))) throw invalid()
  return { timezone: data.timezone, appointments, next_cursor: data.next_cursor }
}
export function createPetHistoryApi({ request = salonFetch } = {}) {
  return { async list(salonId, clientId, petId, { cursor = null, signal } = {}) {
    if (![salonId,clientId,petId].every(id) || !(cursor === null || (typeof cursor === 'string' && /^[A-Za-z0-9_-]{1,600}$/.test(cursor)))) throw invalid()
    const response = await request(`/api/clients/${clientId}/pets/${petId}/appointments${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { method: 'GET', cache: 'no-store', signal })
    const body = await response.json()
    if (!response.ok) throw Object.assign(new Error(response.status === 403 ? 'Više nemate pristup povijesti ljubimca.' : response.status === 404 ? 'Ljubimac više nije dostupan za ovog vlasnika.' : 'Povijest nije učitana. Osvježite pregled.'), { statusCode: response.status, code: body?.error?.code })
    return validateHistory(body?.data,{salonId,clientId,petId,cursor})
  } }
}
export const petHistoryApi = createPetHistoryApi()
