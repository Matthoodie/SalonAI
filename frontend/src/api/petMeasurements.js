export const PET_SIZES = { small: 'Mala', medium: 'Srednja', large: 'Velika', giant: 'Vrlo velika' }
export function weightToGrams(value) {
  if (typeof value !== 'string') throw new Error('Unesite težinu u kilogramima.')
  const clean = value.trim()
  if (!clean) return null
  if (!/^\d{1,3}(?:[.,]\d{1,3})?$/.test(clean)) throw new Error('Unesite kg s najviše tri decimale, npr. 12,5.')
  const [whole, fraction = ''] = clean.replace(',', '.').split('.')
  const grams = Number(whole) * 1000 + Number(fraction.padEnd(3,'0'))
  if (grams < 1 || grams > 200000) throw new Error('Težina mora biti od 0,001 do 200 kg ili prazna.')
  return grams
}
export function weightInput(grams) {
  if (grams == null) return ''
  return String(Math.floor(grams / 1000)) + (grams % 1000 ? ',' + String(grams % 1000).padStart(3,'0').replace(/0+$/,'') : '')
}
export function measurementErrors(draft) {
  const errors = {}
  if (draft.sizeCategory !== undefined && draft.sizeCategory !== '' && !(typeof draft.sizeCategory === 'string' && Object.hasOwn(PET_SIZES,draft.sizeCategory))) errors.sizeCategory = 'Odaberite veličinu ili ostavite neodabrano.'
  if (draft.weightKg !== undefined) try { weightToGrams(draft.weightKg) } catch (error) { errors.weightKg = error.message }
  return errors
}
export function measurementPayload(draft) {
  return { ...(draft.sizeCategory === undefined ? {} : { size_category: draft.sizeCategory || null }),
    ...(draft.weightKg === undefined ? {} : { weight_grams: weightToGrams(draft.weightKg) }) }
}
export function validMeasurements(row) {
  return (row.size_category == null || (typeof row.size_category === 'string' && Object.hasOwn(PET_SIZES,row.size_category))) &&
    (row.weight_grams == null || (Number.isInteger(row.weight_grams) && row.weight_grams >= 1 && row.weight_grams <= 200000))
}
export function measurementsMatch(row, payload, previous = {}) {
  return ['size_category','weight_grams'].every(key => row[key] === (Object.hasOwn(payload,key) ? payload[key] : previous[key] ?? null))
}
