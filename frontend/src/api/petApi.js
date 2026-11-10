import { salonFetch } from './salonApiContext.js'

export const PET_SPECIES = { dog: 'Pas', cat: 'Mačka', other: 'Druga životinja' }
const fields = ['name', 'species', 'breed', 'notes']
const validId = value => ['string', 'number'].includes(typeof value) && /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value))
const invalid = () => Object.assign(new Error('Podatke ljubimca nije moguće potvrditi. Osvježite popis.'), { code: 'PET_INVALID_RESPONSE' })
export function petDraftErrors(draft) {
  const errors = {}
  for (const [key, limit, required] of [['name', 100, true], ['breed', 150, false], ['notes', 2000, false]]) {
    const value = draft?.[key]
    const controls = key === 'notes' ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u : /[\u0000-\u001f\u007f]/u
    if (typeof value !== 'string' || (required && !value.trim()) || (typeof value === 'string' && ([...value.trim()].length > limit || controls.test(value)))) {
      errors[key] = key === 'name' ? 'Unesite ime ljubimca (najviše 100 znakova).' : `Dopušteno je najviše ${limit} znakova, bez nedopuštenih kontrolnih znakova.`
    }
  }
  if (!Object.hasOwn(PET_SPECIES, draft?.species)) errors.species = 'Odaberite vrstu životinje.'
  return errors
}
export function petPayload(draft, revision) {
  if (Object.keys(petDraftErrors(draft)).length) throw Object.assign(new Error('Provjerite označena polja.'), { code: 'PET_INVALID_INPUT' })
  const result = Object.fromEntries(fields.map(key => [key, draft[key].trim()]))
  if (revision !== undefined) {
    if (!Number.isInteger(revision) || revision < 1 || revision >= 2147483647) throw invalid()
    result.expected_revision = revision
  }
  return result
}
export function validatePetRow(row, salonId, clientId) {
  if (!validId(salonId) || !validId(clientId) || !validId(row?.id) || !validId(row?.salon_id) || !validId(row?.client_id) ||
      String(row.salon_id) !== String(salonId) || String(row.client_id) !== String(clientId) ||
      typeof row.active !== 'boolean' || !Number.isInteger(row.revision) || row.revision < 1 || row.revision > 2147483647 ||
      Object.keys(petDraftErrors(row)).length || fields.some(key => row[key] !== row[key].trim()) ||
      !['created_at', 'updated_at'].every(key => typeof row[key] === 'string' && Number.isFinite(Date.parse(row[key])))) throw invalid()
  return Object.fromEntries(['id', 'salon_id', 'client_id', ...fields, 'active', 'revision', 'created_at', 'updated_at'].map(key => [key, row[key]]))
}
const messages = {
  PET_FORBIDDEN: 'Nemate ovlasti za upravljanje ljubimcima.',
  INSUFFICIENT_SALON_ROLE: 'Nemate ovlasti za upravljanje ljubimcima.',
  PET_CLIENT_ARCHIVED: 'Vlasnik je arhiviran. Najprije ga ponovno aktivirajte na popisu klijenata.',
  PET_VERSION_CONFLICT: 'Profil je u međuvremenu promijenjen. Osvježite popis prije ponovnog uređivanja.',
  PET_NOT_FOUND: 'Ljubimac više nije dostupan za ovog vlasnika.',
  CLIENT_NOT_FOUND: 'Vlasnik više nije dostupan u ovom salonu.',
  PET_BUSINESS_DISABLED: 'Ljubimci su dostupni grooming i mješovitim salonima.',
}
export function createPetApi({ request = salonFetch } = {}) {
  function path(salonId, clientId, petId) {
    if (!validId(salonId) || !validId(clientId) || (petId !== undefined && !validId(petId))) throw invalid()
    return `/api/clients/${clientId}/pets${petId === undefined ? '' : `/${petId}`}`
  }
  async function read(url, options, salonId, clientId, check) {
    const response = await request(url, { ...options, cache: 'no-store' })
    const body = await response.json()
    if (!response.ok) throw Object.assign(new Error(messages[body?.error?.code] || 'Zahtjev nije uspio. Osvježite popis i provjerite podatke.'), { code: body?.error?.code, statusCode: response.status })
    if (!check) {
      if (!Array.isArray(body?.data)) throw invalid()
      const rows = body.data.map(row => validatePetRow(row, salonId, clientId))
      if (new Set(rows.map(row => String(row.id))).size !== rows.length) throw invalid()
      return rows
    }
    const row = validatePetRow(body?.data, salonId, clientId)
    if (!check(row)) throw invalid()
    return row
  }
  const write = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return {
    list(salonId, clientId, signal) { return read(path(salonId, clientId), { signal }, salonId, clientId) },
    create(salonId, clientId, draft) {
      const payload = petPayload(draft)
      return read(path(salonId, clientId), write('POST', payload), salonId, clientId,
        row => row.active && row.revision === 1 && fields.every(key => row[key] === payload[key]))
    },
    update(salonId, clientId, pet, draft) {
      if (!Number.isInteger(pet?.revision)) throw invalid()
      const payload = petPayload(draft, pet.revision)
      return read(path(salonId, clientId, pet.id), write('PUT', payload), salonId, clientId,
        row => String(row.id) === String(pet.id) && row.revision === pet.revision + 1 && row.active === pet.active && fields.every(key => row[key] === payload[key]))
    },
    setActive(salonId, clientId, pet, active) {
      if (typeof active !== 'boolean' || !Number.isInteger(pet.revision) || pet.revision < 1 || pet.revision >= 2147483647) throw invalid()
      return read(path(salonId, clientId, pet.id) + '/active', write('PATCH', { active, expected_revision: pet.revision }), salonId, clientId,
        row => String(row.id) === String(pet.id) && row.active === active && row.revision === pet.revision + (pet.active === active ? 0 : 1) && fields.every(key => row[key] === pet[key]))
    },
  }
}
export const petApi = createPetApi()
