import { createHash } from 'node:crypto'
export function creationError(message, code = 'SALON_CREATION_INVALID', statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode })
}
export function creationUserId(value) {
  if (!['string', 'number'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    throw creationError('Potreban je aktivan prijavljeni račun.', 'SALON_CREATION_UNAUTHENTICATED', 401)
  }
  return Number(value)
}
function text(value, max, required = false) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/u.test(value)) throw creationError('Neispravan tekstualni podatak.')
  const result = value.trim()
  if ([...result].length > max || (required && !result)) throw creationError('Provjerite naziv i lokaciju salona.')
  return result
}
export function validateSalonCreation(body) {
  const fields = ['request_id', 'name', 'timezone', 'business_type', 'location']
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== fields.length || fields.some(k => !Object.hasOwn(body, k))) {
    throw creationError('Pošaljite podatke prvog koraka bez dodatnih polja.')
  }
  if (typeof body.request_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.request_id)) {
    throw creationError('Neispravna oznaka zahtjeva.')
  }
  if (!['hair', 'grooming', 'mixed', 'other'].includes(body.business_type)) throw creationError('Odaberite djelatnost salona.')
  const timezone = text(body.timezone, 100, true)
  if (!/^(UTC|[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)+)$/.test(timezone)) throw creationError('Odaberite valjanu vremensku zonu.')
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format() } catch { throw creationError('Vremenska zona nije podržana.') }
  return { request_id: body.request_id.toLowerCase(), name: text(body.name, 150, true), timezone,
    business_type: body.business_type, location: text(body.location, 250) }
}
export function salonCreationHash(draft) {
  return createHash('sha256').update(JSON.stringify({ name: draft.name, timezone: draft.timezone,
    business_type: draft.business_type, location: draft.location })).digest('hex')
}
export function salonCreationPolicy(environment = process.env) {
  // Deliberately no public mode in this package. Unknown/malformed settings fail closed.
  if (environment.SALON_CREATION_MODE !== 'allowlist') return { enabled: false, subjects: [] }
  const subjects = (environment.SALON_CREATION_ALLOWED_SUBJECTS ?? '').split(',').map(v => v.trim())
  if (!subjects.length || subjects.length > 100 || subjects.some(s => !/^user_[A-Za-z0-9]+$/.test(s))) {
    return { enabled: false, subjects: [] }
  }
  return { enabled: true, subjects: [...new Set(subjects)] }
}
