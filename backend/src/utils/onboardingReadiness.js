import { creationError } from './salonCreationValidation.js'
export function completionRevision(body) {
  if (!body || Array.isArray(body) || Object.keys(body).length !== 1 || !Number.isInteger(body.expected_revision) || body.expected_revision < 1 || body.expected_revision > 2147483647) {
    throw creationError('Neispravna verzija postavljanja.', 'SALON_ONBOARDING_INVALID', 400)
  }
  return body.expected_revision
}
export function evaluateReadiness(setup, counts) {
  const issues = []
  if (!setup?.business_type) issues.push({ step: 'salon', message: 'Odaberite djelatnost salona.' })
  if (!['solo','team'].includes(setup?.team_mode) || typeof setup?.owner_provides_services !== 'boolean') issues.push({ step: 'team', message: 'Odaberite način rada i pruža li vlasnik usluge.' })
  if (counts.employees < 1) issues.push({ step: 'team', message: 'Dodajte barem jedan aktivan profil zaposlenika, uključujući sebe ako pružate usluge.' })
  if (setup?.team_mode === 'solo' && (counts.employees !== 1 || setup.owner_provides_services !== true)) issues.push({ step: 'team', message: 'Samostalni rad zahtijeva jedan aktivan profil i vlasnika koji pruža usluge.' })
  if (counts.services < 1) issues.push({ step: 'services', message: 'Dodajte barem jednu aktivnu uslugu s cijenom i trajanjem.' })
  if (counts.uncovered_services > 0) issues.push({ step: 'schedule', message: 'Svaka aktivna usluga mora imati aktivnog osposobljenog zaposlenika s tjednim radnim vremenom.' })
  return { ready: issues.length === 0, issues }
}
