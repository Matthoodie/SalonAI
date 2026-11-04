export function focusProblem(id) {
  requestAnimationFrame(() => {
    const element = document.getElementById(id)
    if (!element) return
    element.focus({preventScroll: true})
    element.scrollIntoView({block: 'center', behavior: 'instant'})
  })
}
export function creationErrors(draft) {
  const errors = {}
  if (!draft.name.trim()) errors.name = 'Upišite naziv salona.'
  if (!['hair','grooming','mixed','other'].includes(draft.business_type)) errors.business_type = 'Odaberite djelatnost.'
  if (!draft.timezone.trim()) errors.timezone = 'Upišite vremensku zonu, primjerice Europe/Zagreb.'
  else { try { new Intl.DateTimeFormat('hr', {timeZone: draft.timezone.trim()}).format() }
    catch { errors.timezone = 'Vremenska zona nije prepoznata. Za Hrvatsku upišite Europe/Zagreb.' } }
  return errors
}
export function stepErrors(draft, employees, services, nextIndex) {
  const errors = {}
  if (!draft.business_type) errors.business_type = 'Odaberite djelatnost.'
  if (nextIndex > 1) {
    if (!draft.team_mode) errors.team_mode = 'Odaberite radite li samostalno ili s timom.'
    if (typeof draft.owner_provides_services !== 'boolean') errors.owner_provides_services = 'Odaberite pružate li i vi usluge.'
    if (draft.team_mode === 'solo' && draft.owner_provides_services === false) errors.owner_provides_services = 'Za samostalni rad odaberite Da. Ako samo upravljate salonom, odaberite Radimo kao tim.'
    const active = employees.filter(e => e.active !== false).length
    if (!active) errors.profiles = 'Dodajte i spremite barem jedan aktivan profil osobe koja pruža usluge.'
    else if (draft.team_mode === 'solo' && active !== 1) errors.profiles = 'Samostalni rad znači jedan aktivan profil. Za više osoba odaberite Radimo kao tim.'
  }
  if (nextIndex > 2 && !services.some(s => s.active !== false)) errors.services = 'Dodajte i spremite barem jednu aktivnu uslugu s cijenom i trajanjem.'
  return errors
}
export function serviceExamples(businessType) {
  if (businessType === 'grooming') return {name: 'npr. Kupanje i sušenje psa', category: 'npr. Njega pasa', summary: 'Primjeri: kupanje i sušenje psa, šišanje psa ili skraćivanje noktiju.'}
  if (businessType === 'hair') return {name: 'npr. Muško šišanje', category: 'npr. Šišanje', summary: 'Primjeri: šišanje, pranje i feniranje ili bojanje kose.'}
  return {name: 'npr. Osnovni tretman', category: 'npr. Njega', summary: 'Unesite usluge koje stvarno pružate, uz njihove cijene i trajanja.'}
}
