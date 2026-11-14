import {bookingMessages} from './bookingMessages.js'
import {overviewText,overviewMoney} from './overviewText.js'
import {flowError} from './flowText.js'
export function bookingText(language,source) {
  if(typeof source!=='string') return ''
  const key=source.trim().replace(/\s+/g,' ')
  if(language==='en'&&Object.hasOwn(bookingMessages,key)) return source.match(/^\s*/)[0]+bookingMessages[key]+source.match(/\s*$/)[0]
  return overviewText(language,source)
}
const codes={
  APPOINTMENT_RECIPIENT_CONFLICT:'Vlasnik ili ljubimac već su promijenjeni. Osvježite termin.',
  APPOINTMENT_PET_REQUIRED:'Odaberite ljubimca za grooming termin.',
  PET_NOT_FOUND:'Ljubimac ne pripada odabranom vlasniku u ovom salonu.',
  PET_INACTIVE:'Arhivirani ljubimac nije dostupan za novi termin.',
  PET_BUSINESS_DISABLED:'Ovaj salon ne podržava grooming termine.',
  APPOINTMENT_CLIENT_CHANGE_NOT_ALLOWED:'Vlasnik i ljubimac mogu se mijenjati samo na aktivnom terminu.',
  APPOINTMENT_RECIPIENT_UPDATE_REQUIRED:'Za ovaj termin vlasnika i ljubimca izmijenite zajedno.',
  CLIENT_INACTIVE:'Klijent nije aktivan.',
  APPOINTMENT_NOT_FOUND:'Termin nije pronađen.',
  APPOINTMENT_CONFLICT:'Zaposlenik već ima termin koji se preklapa s ukupnim trajanjem odabranih usluga.',
  EMPLOYEE_NOT_QUALIFIED:'Zaposlenik ne pruža sve odabrane usluge.',
  EMPLOYEE_UNAVAILABLE:'Zaposlenik nije dostupan u odabranom razdoblju.',
  EMPLOYEE_NOT_WORKING:'Zaposlenik ne radi odabranog dana.',
  APPOINTMENT_OUTSIDE_WORKING_HOURS:'Ukupno trajanje usluga ne stane u radno vrijeme zaposlenika.',
}
export function bookingError(language,error) {
  if(!error) return ''
  if(error.kind) {
    const name=error.name||bookingText(language,'Zaposlenik')
    const hr={dayOff:`${name} ne radi odabranog dana.`,timeOff:`${name} nije dostupan/na zbog evidentirane odsutnosti.`,blocked:`${name} ima blokirano vrijeme koje se preklapa s odabranim terminom.`,outside:`Odabrano vrijeme je izvan radnog vremena zaposlenika ${name}.`,collision:`${name} već ima termin koji se preklapa s ovim vremenom.`,duplicateClient:`Klijent s ovim brojem već postoji: ${name}.`}
    const en={dayOff:`${name} does not work on the selected day.`,timeOff:`${name} is unavailable due to recorded absence.`,blocked:`${name} has blocked time overlapping the selected appointment.`,outside:`The selected time is outside the working hours of ${name}.`,collision:`${name} already has an appointment overlapping this time.`,duplicateClient:`A client with this phone number already exists: ${name}.`}
    if(Object.hasOwn(hr,error.kind)) return (language==='en'?en:hr)[error.kind]
  }
  const source=Object.hasOwn(codes,error.code||'')?codes[error.code]:typeof error==='string'?error:error?.message
  const key=source?.trim().replace(/\s+/g,' ')||''
  if(Object.hasOwn(bookingMessages,key)) return bookingText(language,source)
  const translated=overviewText(language,source)
  if(language==='en'&&translated!==source) return translated
  // Known local UI labels remain readable in HR; arbitrary server errors use a neutral message.
  if(source && overviewText('en',source)!==source) return source
  return flowError(language,error)
}
export const bookingPrice=(language,cents)=>overviewMoney(language,cents)
export const bookingEndTime=(language,text)=>language==='en'?text.replace(/ \(sljedeći dan\)$/,' (next day)'):text
