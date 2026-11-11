import { petId, petError } from './petValidation.js'
export const PET_HISTORY_PAGE_SIZE = 20
const invalid = () => petError('Neispravan nastavak povijesti. Osvježite pregled.', 'PET_HISTORY_INVALID_CURSOR')
export function historyCursor(query, context) {
  if (!query || Object.keys(query).some(key => key !== 'cursor')) throw invalid()
  if (query.cursor === undefined) return null
  if (typeof query.cursor !== 'string' || !/^[A-Za-z0-9_-]{1,600}$/.test(query.cursor)) throw invalid()
  try {
    const raw = Buffer.from(query.cursor, 'base64url').toString('utf8')
    if (Buffer.from(raw).toString('base64url') !== query.cursor) throw invalid()
    const value = JSON.parse(raw)
    if (Object.keys(value).sort().join(',') !== 'clientId,id,petId,salonId,start' ||
        ['salonId','clientId','petId'].some(key => petId(value[key]) !== petId(context[key])) ||
        typeof value.start !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value.start)) throw invalid()
    const canonical = value.start.slice(0,23) + 'Z'
    if (new Date(canonical).toISOString() !== canonical) throw invalid()
    return { id: petId(value.id), start: value.start }
  } catch { throw invalid() }
}
export function nextHistoryCursor(row, context) {
  return Buffer.from(JSON.stringify({ salonId: petId(context.salonId), clientId: petId(context.clientId),
    petId: petId(context.petId), id: petId(row.id), start: row.cursor_start })).toString('base64url')
}
