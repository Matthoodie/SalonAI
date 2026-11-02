export const SETUP_STEPS = ['business', 'salon', 'team', 'services', 'schedule', 'review']
export function setupError(message, code = 'SALON_SETUP_INVALID', statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode })
}
export function setupId(value) {
  if (!['string', 'number'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    throw setupError('Neispravan salonski ili korisnički kontekst.', 'SALON_SETUP_FORBIDDEN', 403)
  }
  return Number(value)
}
export function validateSalonSetup(body) {
  const fields = ['expected_revision', 'business_type', 'location', 'team_mode', 'owner_provides_services', 'last_step']
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== fields.length || fields.some(key => !Object.hasOwn(body, key))) {
    throw setupError('Pošaljite cijeli nacrt postavljanja, bez dodatnih polja.')
  }
  if (!Number.isInteger(body.expected_revision) || body.expected_revision < 0 || body.expected_revision >= 2147483647) {
    throw setupError('Neispravna verzija nacrta.')
  }
  if (![null, 'hair', 'grooming', 'mixed', 'other'].includes(body.business_type) ||
      ![null, 'solo', 'team'].includes(body.team_mode) ||
      ![null, true, false].includes(body.owner_provides_services) ||
      !SETUP_STEPS.includes(body.last_step)) {
    throw setupError('Neispravna djelatnost, način rada ili korak postavljanja.')
  }
  if (typeof body.location !== 'string' || /[\u0000-\u001f\u007f]/u.test(body.location) || [...body.location.trim()].length > 250) {
    throw setupError('Lokacija mora biti tekst do 250 znakova bez kontrolnih znakova.')
  }
  return { ...body, location: body.location.trim() }
}
export function assertSalonSetupContext(req) {
  const salonId = setupId(req.currentSalon?.id)
  const userId = setupId(req.currentUser?.id)
  const member = req.currentMembership
  if (req.currentUser.active !== true || req.currentSalon.active === false ||
      member?.active !== true || member.role !== 'owner' ||
      String(member.userId) !== String(userId) || String(member.salonId) !== String(salonId)) {
    throw setupError('Postavljanje salona dostupno je aktivnom vlasniku.', 'SALON_SETUP_FORBIDDEN', 403)
  }
  return { salonId, userId }
}
