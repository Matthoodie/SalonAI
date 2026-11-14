import {teamMessages} from './teamMessages.js'
import {flowText,flowError} from './flowText.js'
export function teamText(language,source) {
  if(typeof source!=='string') return ''
  const key=source.trim().replace(/\s+/g,' ')
  if(language==='en' && Object.hasOwn(teamMessages,key)) return source.match(/^\s*/)[0]+teamMessages[key]+source.match(/\s*$/)[0]
  return flowText(language,source)
}
export function teamError(language,error) {
  const source=typeof error==='string'?error:error?.message
  const aliases={'Failed to load employees.':'Podatke nije moguće učitati','Failed to create employee.':'Zaposlenika trenutno nije moguće dodati.','Failed to update employee.':'Zaposlenika trenutno nije moguće urediti.','Failed to update employee status.':'Status zaposlenika trenutno nije moguće promijeniti.'}
  const message=Object.hasOwn(aliases,source||'')?aliases[source]:source
  return Object.hasOwn(teamMessages,message?.trim()||'')?teamText(language,message):flowError(language,error)
}
// These patterns only receive local validation messages, never names or stored notes.
export function teamValidationText(language,source) {
  if(language!=='en') return source
  const day=/^(Ponedjeljak|Utorak|Srijeda|Četvrtak|Petak|Subota|Nedjelja): (.+)$/.exec(source)
  if(day) {
    const reasons={
      'odaberite početak i kraj radnog vremena.':'select the start and end of working hours.',
      'radno vrijeme nije ispravno.':'working hours are invalid.',
      'početak radnog vremena mora biti prije kraja.':'working hours must start before they end.'
    }
    if(Object.hasOwn(reasons,day[2])) return `${teamText(language,day[1])}: ${reasons[day[2]]}`
  }
  const duplicate=/^Za datum (\d{2}\.\d{2}\.\d{4}\.) postoji više posebnih rasporeda\.$/.exec(source)
  if(duplicate) return `More than one special schedule exists for ${duplicate[1]}`
  const invalid=/^(\d{2}\.\d{2}\.\d{4}\.): posebno radno vrijeme nije ispravno\.$/.exec(source)
  if(invalid) return `${invalid[1]}: special working hours are invalid.`
  const order=/^(\d{2}\.\d{2}\.\d{4}\.): početak posebnog radnog vremena mora biti prije kraja\.$/.exec(source)
  if(order) return `${order[1]}: special working hours must start before they end.`
  const overlap=/^Blokirana vremena za (\d{2}\.\d{2}\.\d{4}\.) ne smiju se preklapati\.$/.exec(source)
  if(overlap) return `Blocked periods for ${overlap[1]} must not overlap.`
  return teamText(language,source)
}
export function teamMemberQuestion(language,name,action,nextRole,nextActive) {
  if(language==='en') return action==='role'
    ? nextRole==='admin'
      ? `Grant the administrator role to ${name}? They will receive administrator access to this salon.`
      : `Change ${name} to an employee? They will lose administrator permissions in this salon.`
    : nextActive
      ? `Reactivate membership for ${name}? Their user account and employee profile status will remain unchanged.`
      : `Deactivate membership for ${name}? They will lose access to this salon. Their employee profile and existing appointments will be preserved.`
  return action==='role'
    ? nextRole==='admin'
      ? `Dodijeliti administratorsku ulogu korisniku ${name}? Dobit će administratorski pristup ovom salonu.`
      : `Vratiti korisnika ${name} u ulogu zaposlenika? Izgubit će administratorske ovlasti u ovom salonu.`
    : nextActive
      ? `Ponovno aktivirati članstvo korisnika ${name}? Status njegova korisničkog računa i profila zaposlenika ostaje nepromijenjen.`
      : `Deaktivirati članstvo korisnika ${name}? Izgubit će pristup ovom salonu. Profil zaposlenika i postojeći termini ostaju sačuvani.`
}
export function teamCalendarDate(language,value) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value||'')) return value||''
  const [year,month,day]=value.split('-')
  return language==='en'?`${day}/${month}/${year}`:`${day}.${month}.${year}.`
}
