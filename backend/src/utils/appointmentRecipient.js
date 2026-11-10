export function recipientError(code, message, statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode })
}
export function recipientId(value) {
  if (!['string','number'].includes(typeof value) || !/^[1-9][0-9]*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    throw recipientError('INVALID_RECIPIENT_ID','Identifikator mora biti pozitivan cijeli broj.')
  }
  return Number(value)
}
// Transitional 3A contract: omitted fields preserve old clients. 3B will supply
// an explicit type and make a pet mandatory in the grooming booking UI.
export function parseRecipient(body, { allowLegacy = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw recipientError('INVALID_RECIPIENT','Neispravan primatelj usluge.')
  const type = body.recipient_type
  if (type === undefined && body.pet_id === undefined && allowLegacy) return { recipient_type: null, pet_id: null }
  if (!['person','pet'].includes(type)) throw recipientError('INVALID_RECIPIENT','Odaberite osobu ili ljubimca.')
  if (type === 'person') {
    if (body.pet_id != null) throw recipientError('INVALID_RECIPIENT','Termin za osobu ne može imati ljubimca.')
    return { recipient_type: type, pet_id: null }
  }
  return { recipient_type: type, pet_id: recipientId(body.pet_id) }
}
export function parseRecipientChange(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw recipientError('INVALID_RECIPIENT','Neispravan zahtjev.')
  const allowed = ['client_id','recipient_type','pet_id','expected_recipient_revision']
  if (Object.keys(body).some(k => !allowed.includes(k))) throw recipientError('INVALID_RECIPIENT','Zahtjev sadrži nedopuštena polja.')
  const revision = body.expected_recipient_revision
  if (!Number.isInteger(revision) || revision < 1 || revision >= 2147483647) throw recipientError('INVALID_RECIPIENT_REVISION','Ponovno učitajte termin prije izmjene.')
  return { ...parseRecipient(body), client_id: recipientId(body.client_id), expected_recipient_revision: revision }
}
export function validateRecipientBusiness(type, business) {
  if (type === 'pet' && !['grooming','mixed'].includes(business)) throw recipientError('PET_BUSINESS_DISABLED','Ovaj salon ne podržava grooming termine.',403)
  if (type === 'person' && business === 'grooming') throw recipientError('APPOINTMENT_PET_REQUIRED','Odaberite ljubimca za grooming termin.')
}
export function recipientView(row) {
  return {
    recipient_type: row.recipient_type,
    recipient_revision: row.recipient_revision,
    pet_id: row.pet_id,
    pet_name: row.pet_name,
    pet_species: row.pet_species,
    pet_breed: row.pet_breed,
  }
}
