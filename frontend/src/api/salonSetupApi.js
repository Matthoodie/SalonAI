import { salonFetch } from './salonApiContext.js'

export const SETUP_STEPS = ['business', 'salon', 'team', 'services', 'schedule', 'review']
const fields = ['business_type', 'location', 'team_mode', 'owner_provides_services', 'last_step']
function validId(id) {
  return ['string', 'number'].includes(typeof id) && /^[1-9]\d*$/.test(String(id)) && Number.isSafeInteger(Number(id))
}
function invalid() { return new Error('Podatke postavljanja nije moguće potvrditi.') }
export function setupPayload(draft, revision) {
  if (!Number.isInteger(revision) || revision < 0 || revision >= 2147483647 ||
      ![null, 'hair', 'grooming', 'mixed', 'other'].includes(draft?.business_type) ||
      ![null, 'solo', 'team'].includes(draft?.team_mode) ||
      ![null, true, false].includes(draft?.owner_provides_services) ||
      !SETUP_STEPS.includes(draft?.last_step) || typeof draft?.location !== 'string' ||
      /[\u0000-\u001f\u007f]/u.test(draft.location) || [...draft.location.trim()].length > 250) throw invalid()
  return { expected_revision: revision, ...Object.fromEntries(fields.map(key => [key, key === 'location' ? draft[key].trim() : draft[key]])) }
}
export function validateSetupResponse(data, salonId) {
  const s = data?.setup
  if (!validId(salonId) || !validId(data?.salon?.id) || String(data.salon.id) !== String(salonId) ||
      !validId(s?.salon_id) || String(s.salon_id) !== String(salonId) ||
      typeof data.salon.name !== 'string' || !data.salon.name.trim() ||
      typeof data.salon.timezone !== 'string' || !data.salon.timezone ||
      typeof data.started !== 'boolean' || !Number.isInteger(s.revision) || s.revision < 0 || s.revision > 2147483647) throw invalid()
  // The final allowed revision is readable, but cannot be incremented again.
  const draft = setupPayload(s, Math.min(s.revision, 2147483646))
  delete draft.expected_revision
  if (data.started !== (s.revision > 0) || (data.started && (!validId(s.updated_by_user_id) && s.updated_by_user_id !== null)) ||
      (data.started && (typeof s.updated_at !== 'string' || !Number.isFinite(Date.parse(s.updated_at))))) throw invalid()
  return { salon: { id: data.salon.id, name: data.salon.name, timezone: data.salon.timezone },
    setup: { ...draft, revision: s.revision }, started: data.started }
}
export function createSalonSetupApi({ request = salonFetch } = {}) {
  async function read(response, salonId) {
    const body = await response.json()
    if (!response.ok) {
      const code = body?.error?.code
      const message = response.status === 409 ? 'Postavljanje je promijenjeno u drugom prozoru. Učitajte spremljene podatke prije nastavka.' :
        response.status === 403 ? 'Postavljanje je dostupno samo aktivnom vlasniku odabranog salona.' : 'Postavljanje trenutačno nije dostupno.'
      throw Object.assign(new Error(message), { code, statusCode: response.status })
    }
    return validateSetupResponse(body?.data, salonId)
  }
  return {
    async load(salonId, signal) {
      if (!validId(salonId)) throw invalid()
      return read(await request('/api/salon-setup', { signal }), salonId)
    },
    async save(salonId, draft, revision, signal) {
      if (!validId(salonId)) throw invalid()
      const payload = setupPayload(draft, revision)
      const result = await read(await request('/api/salon-setup', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal,
      }), salonId)
      if (!result.started || result.setup.revision !== revision + 1 || fields.some(key => result.setup[key] !== payload[key])) throw invalid()
      return result
    },
  }
}
export const salonSetupApi = createSalonSetupApi()
