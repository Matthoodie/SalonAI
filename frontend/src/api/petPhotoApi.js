import { salonFetch } from './salonApiContext.js'
import { validatePetRow } from './petApi.js'
const maxBytes = 8 * 1024 * 1024
const validId = v => ['string', 'number'].includes(typeof v) && /^[1-9]\d*$/.test(String(v)) && Number.isSafeInteger(Number(v))
const invalid = () => Object.assign(new Error('Fotografiju nije moguće potvrditi. Osvježite popis ljubimaca.'), { code: 'PET_PHOTO_INVALID_RESPONSE' })
export function photoFileError(file) {
  if (!file || !Number.isInteger(file.size) || file.size < 1) return 'Odaberite fotografiju.'
  if (file.size > maxBytes) return 'Fotografija smije imati najviše 8 MB.'
  if (!['image/jpeg', 'image/png'].includes(file.type)) return 'Odaberite JPEG ili PNG fotografiju.'
  return ''
}
const messages = {
  PET_VERSION_CONFLICT: 'Profil se promijenio. Osvježite popis prije ponovnog spremanja.',
  PET_PHOTO_CHANGED: 'Fotografija se promijenila. Osvježite popis.',
  PET_PHOTO_NOT_FOUND: 'Fotografija više nije dostupna. Osvježite popis.',
  PET_PHOTO_INVALID: 'Fotografiju nije moguće obraditi. Koristite JPEG/PNG do 24 megapiksela, bez animacije.',
  PET_PHOTO_TOO_LARGE: 'Fotografija smije imati najviše 8 MB.',
  PET_PHOTO_FORMAT: 'Odaberite JPEG ili PNG fotografiju.',
  PET_PHOTO_BUSY: 'Obrada fotografije je zauzeta. Pokušajte kasnije.',
  PET_PHOTO_ARCHIVED: 'Najprije ponovno aktivirajte ljubimca.',
  PET_CLIENT_ARCHIVED: 'Najprije ponovno aktivirajte vlasnika.',
  PET_FORBIDDEN: 'Nemate pristup fotografiji ovog ljubimca.',
  PET_NOT_FOUND: 'Ljubimac više nije dostupan za ovog vlasnika.',
  CLIENT_NOT_FOUND: 'Vlasnik više nije dostupan u ovom salonu.',
}
export function createPetPhotoApi({ request = salonFetch } = {}) {
  function path(salonId, clientId, pet) {
    if (![salonId, clientId, pet?.id].every(validId) || !Number.isInteger(pet?.revision) || pet.revision < 1 || pet.revision > 2147483647 ||
      !Number.isInteger(pet?.photo_version) || pet.photo_version < 0 || pet.photo_version > 2147483647 || typeof pet.has_photo !== 'boolean') throw invalid()
    return `/api/clients/${clientId}/pets/${pet.id}/photo`
  }
  async function check(response) {
    if (response.ok) return
    const body = await response.json()
    throw Object.assign(new Error(messages[body?.error?.code] || 'Zahtjev za fotografiju nije uspio. Osvježite popis.'), { code: body?.error?.code, statusCode: response.status })
  }
  async function write(salonId, clientId, pet, file) {
    const url = path(salonId, clientId, pet)
    if (pet.revision >= 2147483647 || pet.photo_version >= 2147483647) throw invalid()
    const uploading = file !== undefined
    if (uploading && photoFileError(file)) throw Object.assign(new Error(photoFileError(file)), { statusCode: 400 })
    const response = await request(url, { method: uploading ? 'PUT' : 'DELETE', cache: 'no-store',
      headers: { 'If-Match': `"${pet.revision}"`, ...(uploading ? { 'Content-Type': 'application/octet-stream' } : {}) },
      ...(uploading ? { body: file } : {}),
    })
    await check(response)
    const raw = (await response.json())?.data
    if (typeof raw?.has_photo !== 'boolean' || !Number.isInteger(raw?.photo_version)) throw invalid()
    let row
    try { row = validatePetRow(raw, salonId, clientId) } catch { throw invalid() }
    const changed = uploading || pet.has_photo ? 1 : 0
    if (String(row.id) !== String(pet.id) || row.has_photo !== uploading || row.photo_version !== pet.photo_version + changed || row.revision !== pet.revision + changed) throw invalid()
    return row
  }
  return {
    upload: (salonId, clientId, pet, file) => write(salonId, clientId, pet, file),
    remove: (salonId, clientId, pet) => write(salonId, clientId, pet),
    async load(salonId, clientId, pet, signal) {
      const url = path(salonId, clientId, pet)
      if (!pet.has_photo || pet.photo_version < 1) throw invalid()
      const response = await request(`${url}?version=${pet.photo_version}`, { signal, responseType: 'blob', cache: 'no-store' })
      await check(response)
      for (const [key, value] of [['X-Salon-Id', salonId], ['X-Client-Id', clientId], ['X-Pet-Id', pet.id], ['X-Pet-Photo-Version', pet.photo_version]]) {
        if (response.headers.get(key) !== String(value)) throw invalid()
      }
      const blob = await response.blob()
      if (blob.type !== 'image/jpeg' || blob.size < 4 || blob.size > 524288) throw invalid()
      const signature = new Uint8Array(await blob.slice(0, 3).arrayBuffer())
      // Re-check context after the asynchronous signature read.
      await response.blob()
      if (signature[0] !== 255 || signature[1] !== 216 || signature[2] !== 255) throw invalid()
      return blob
    },
  }
}
export const petPhotoApi = createPetPhotoApi()
