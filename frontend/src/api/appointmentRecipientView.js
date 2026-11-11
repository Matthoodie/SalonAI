export const speciesLabel = { dog: 'Pas', cat: 'Mačka', other: 'Druga životinja' }
export function recipientSummary(row) {
  return { recipientType: row.recipient_type ?? null, recipientRevision: row.recipient_revision ?? null,
    petId: row.pet_id ?? null, petName: row.pet_name ?? '', petSpecies: row.pet_species ?? '', petBreed: row.pet_breed ?? '' }
}
export function recipientLabel(a) {
  return a.recipientType === 'pet' && a.petId != null
    ? `${a.petName || 'Ljubimac'} · ${speciesLabel[a.petSpecies] || 'Ljubimac'}${a.petBreed ? ' · ' + a.petBreed : ''} — vlasnik: ${a.clientName || 'Nepoznat vlasnik'}`
    : a.clientName || 'Nepoznat klijent'
}
export function recipientChanged(a,b) {
  return String(a.clientId) !== String(b.clientId) || (a.recipientType??null)!==(b.recipientType??null) || String(a.petId??'')!==String(b.petId??'')
}
export function validRecipientId(v) { return ['string','number'].includes(typeof v) && /^[1-9][0-9]*$/.test(String(v)) && Number.isSafeInteger(Number(v)) }
export function recipientPayload(type,petId) {
  if(type==='person' && petId==null) return {recipient_type:'person',pet_id:null}
  if(type==='pet' && validRecipientId(petId)) return {recipient_type:'pet',pet_id:Number(petId)}
  throw new Error('Odaberite valjanog ljubimca ili termin za osobu.')
}

export function recipientUpdate(row,current,clients=[]) {
  const sameOwner=String(row.client_id)===String(current.clientId)
  return {...recipientSummary(row),clientId:row.client_id,
    clientName:row.client_name ?? (sameOwner?current.clientName:clients.find(c=>String(c.id)===String(row.client_id))?.name) ?? 'Nepoznat klijent'}
}
