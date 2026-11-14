import {overviewMessages} from './overviewMessages.js'
import {teamText} from './teamText.js'
import {flowError} from './flowText.js'
import {formatDate, formatMoney, appointmentCount} from '../../pages/Dashboard/dashboardView.js'
export function overviewText(language,source) {
  if(typeof source!=='string') return ''
  const key=source.trim().replace(/\s+/g,' ')
  if(language==='en' && Object.hasOwn(overviewMessages,key)) return source.match(/^\s*/)[0]+overviewMessages[key]+source.match(/\s*$/)[0]
  return teamText(language,source)
}
export function overviewError(language,error) {
  const source=typeof error==='string'?error:error?.message
  return Object.hasOwn(overviewMessages,source?.trim()||'')?overviewText(language,source):flowError(language,error)
}
export const overviewLocale=language=>language==='en'?'en-GB':'hr-HR'
export function overviewCount(language,count) {
  return language==='en'?`${count} ${count===1?'appointment':'appointments'}`:appointmentCount(count)
}
export function overviewMoney(language,cents) {
  return language==='en'?new Intl.NumberFormat('en-GB',{style:'currency',currency:'EUR'}).format(cents/100):formatMoney(cents)
}
export function overviewDate(language,date) {
  return language==='en'?new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',day:'numeric',month:'numeric',year:'numeric'}).format(new Date(`${date}T00:00:00Z`)):formatDate(date)
}
export function overviewStatus(language,appointment) {
  const labels={pending:'Na čekanju',confirmed:'Zakazano',completed:'Završen',cancelled:'Otkazano',no_show:'Nedolazak'}
  const source=Object.hasOwn(labels,appointment.statusCode||'')?labels[appointment.statusCode]:appointment.status
  return overviewText(language,source||'—')
}
export function overviewRecipient(language,a) {
  const f=source=>overviewText(language,source)
  const species={dog:'Pas',cat:'Mačka',other:'Druga životinja'}
  if(a.recipientType==='pet' && a.petId!=null) {
    const type=Object.hasOwn(species,a.petSpecies||'')?species[a.petSpecies]:'Ljubimac'
    return `${a.petName||f('Ljubimac')} · ${f(type)}${a.petBreed?' · '+a.petBreed:''} — ${language==='en'?'owner':'vlasnik'}: ${a.clientName||f('Nepoznat vlasnik')}`
  }
  return a.clientName||f('Nepoznat klijent')
}
export function overviewMissingPrices(language,count) {
  return language==='en'
    ? `${count} completed ${count===1?'appointment is':'appointments are'} missing a valid price. The displayed value is incomplete.`
    : `Za ${count} završenih termina nedostaje valjana cijena. Prikazana vrijednost nije potpuna.`
}
