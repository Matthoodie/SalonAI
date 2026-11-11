import { petError } from './petValidation.js'
export const MAX_PET_PHOTO_BYTES = 8 * 1024 * 1024
export const MAX_SAVED_PHOTO_BYTES = 512 * 1024
export function photoError(message, code = 'PET_PHOTO_INVALID', statusCode = 400) {
  return petError(message, code, statusCode)
}
export function photoRevision(value) {
  if (typeof value !== 'string' || !/^"[1-9]\d*"$/.test(value)) throw photoError('Osvježite profil prije promjene fotografije.', 'PET_PHOTO_REVISION_REQUIRED', 400)
  const n = Number(value.slice(1, -1))
  if (!Number.isInteger(n) || n >= 2147483647) throw photoError('Neispravna verzija profila.')
  return n
}
export function photoVersion(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isInteger(Number(value)) || Number(value) > 2147483647) throw photoError('Neispravna verzija fotografije.')
  return Number(value)
}
export function photoKind(bytes) {
  if (!Buffer.isBuffer(bytes) || !bytes.length) throw photoError('Odaberite fotografiju.')
  if (bytes.length > MAX_PET_PHOTO_BYTES) throw photoError('Fotografija smije imati najviše 8 MB.', 'PET_PHOTO_TOO_LARGE', 413)
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    // libpng may decode only the first APNG frame; reject the animation chunk explicitly.
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = bytes.readUInt32BE(offset)
      if (bytes.toString('ascii', offset + 4, offset + 8) === 'acTL') throw photoError('Animirane fotografije nisu podržane.')
      if (length > bytes.length - offset - 12) break
      offset += length + 12
    }
    return 'png'
  }
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpeg'
  throw photoError('Odaberite JPEG ili PNG fotografiju. SVG, GIF, HEIC i PDF nisu podržani.', 'PET_PHOTO_FORMAT', 415)
}
