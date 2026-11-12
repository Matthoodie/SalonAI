export function petError(message, code = 'PET_INVALID_INPUT', statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode })
}
export function petId(value) {
  if (!['string','number'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    throw petError('Neispravan identifikator.')
  }
  return Number(value)
}
function exactFields(body, fields, optional = []) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !fields.includes(key) && !optional.includes(key)) || fields.some(key => !Object.hasOwn(body,key))) {
    throw petError('Pošaljite sva očekivana polja, bez dodatnih podataka.')
  }
}
function revision(value) {
  if (!Number.isInteger(value) || value < 1 || value >= 2147483647) throw petError('Neispravna verzija profila.')
  return value
}
function text(value, max, required = false, multiline = false) {
  const invalid = multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u : /[\u0000-\u001f\u007f]/u
  if (typeof value !== 'string' || invalid.test(value)) throw petError('Neispravan tekst profila ljubimca.')
  const clean = value.trim()
  if ([...clean].length > max || (required && !clean)) throw petError('Provjerite obavezna polja i duljinu teksta.')
  return clean
}
export function validatePet(body, editing = false) {
  exactFields(body, ['name','species','breed','notes', ...(editing ? ['expected_revision'] : [])], ['size_category','weight_grams'])
  const measurements = {}
  if (Object.hasOwn(body, 'size_category')) {
    if (body.size_category !== null && !['small','medium','large','giant'].includes(body.size_category)) throw petError('Odaberite valjanu veličinu ljubimca.')
    measurements.size_category = body.size_category
  }
  if (Object.hasOwn(body, 'weight_grams')) {
    if (body.weight_grams !== null && (!Number.isInteger(body.weight_grams) || body.weight_grams < 1 || body.weight_grams > 200000)) throw petError('Težina mora biti od 0,001 do 200 kg ili prazna.')
    measurements.weight_grams = body.weight_grams
  }
  if (!['dog','cat','other'].includes(body.species)) throw petError('Odaberite vrstu životinje.')
  return { ...measurements, name: text(body.name,100,true), species: body.species,
    breed: text(body.breed,150), notes: text(body.notes,2000,false,true),
    ...(editing ? { expected_revision: revision(body.expected_revision) } : {}) }
}
export function validatePetActive(body) {
  exactFields(body,['active','expected_revision'])
  if (typeof body.active !== 'boolean') throw petError('Status mora biti true ili false.')
  return { active: body.active, expected_revision: revision(body.expected_revision) }
}
export function petContext(req) {
  const member = req.currentMembership
  try {
    const salonId = petId(req.currentSalon?.id), userId = petId(req.currentUser?.id)
    if (req.currentUser.active !== true || req.currentSalon.active === false || member?.active !== true ||
        !['owner','admin'].includes(member.role) || String(member.userId) !== String(userId) || String(member.salonId) !== String(salonId)) throw Error()
    return { salonId, userId }
  } catch { throw petError('Upravljanje ljubimcima dostupno je aktivnom vlasniku i administratoru.', 'PET_FORBIDDEN', 403) }
}
