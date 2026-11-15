import { clientMessages } from './clientMessages.js'
import { bookingText, bookingError } from './bookingText.js'
import { overviewLocale, overviewCount } from './overviewText.js'
export function clientText(language, source) {
  if (typeof source !== 'string') return source
  const key=source.trim()
  return language==='en' && Object.hasOwn(clientMessages,key)
    ? source.replace(key,()=>clientMessages[key]) : bookingText(language,source)
}
export function clientError(language,error) {
  const source=typeof error==='string'?error:error?.message
  return Object.hasOwn(clientMessages,source?.trim()||'') ? clientText(language,source) : bookingError(language,error)
}
export function clientDynamic(language,kind,name) {
  const en=language==='en'
  switch(kind) {
    case 'archiveClient': return en?`Archive client "${name}"?`:`Arhivirati klijenta "${name}"?`
    case 'editPet': return en?`Edit pet: ${name}`:`Uredi ljubimca: ${name}`
    case 'archivePet': return en?`Archive pet ${name}? The profile will be retained.`:`Arhivirati ljubimca ${name}? Profil će ostati sačuvan.`
    case 'reactivatePet': return en?`Reactivate pet ${name}?`:`Ponovno aktivirati ljubimca ${name}?`
    case 'photoAlt': return en?`Photo of pet ${name}`:`Fotografija ljubimca ${name}`
    case 'previewAlt': return en?`Preview of selected photo for ${name}`:`Pregled odabrane fotografije za ${name}`
    case 'removePhoto': return en?`Remove the photo of pet ${name}? The profile and appointments will be retained.`:`Ukloniti fotografiju ljubimca ${name}? Profil i termini ostaju sačuvani.`
    default: return ''
  }
}
export function clientMoney(language,value) {
  if(value==null || !Number.isFinite(Number(value))) return '—'
  return new Intl.NumberFormat(overviewLocale(language),{style:'currency',currency:'EUR'}).format(Number(value))
}
export function clientWeight(language,grams) {
  if(grams==null || !Number.isInteger(grams)) return '—'
  return new Intl.NumberFormat(overviewLocale(language),{maximumFractionDigits:3,useGrouping:false}).format(grams/1000)
}
export function clientCount(language,count,kind) {
  if(kind==='appointments') return overviewCount(language,count)
  return language==='en'?`${count} ${count===1?'visit':'visits'}`:`${count} ${count%10===1 && count%100!==11?'posjet':'posjeta'}`
}
