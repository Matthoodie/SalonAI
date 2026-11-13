import {shellMessages} from './shellMessages.js'
import {flowError} from './flowText.js'
export function shellText(language, source) {
  if (Array.isArray(source)) return source.filter(Boolean).map(item => shellText(language,item)).join(' ')
  if (typeof source !== 'string') return ''
  const key = source.trim().replace(/\s+/g,' ')
  if (language !== 'en' || !Object.hasOwn(shellMessages,key)) return source
  return source.match(/^\s*/)[0] + shellMessages[key] + source.match(/\s*$/)[0]
}
export function shellError(language,error) {
  const message = typeof error === 'string' ? error : error?.message
  return Object.hasOwn(shellMessages,message?.trim() || '') ? shellText(language,message) : flowError(language,error)
}
export function permissionQuestion(language,label,choice,name) {
  return language==='en' ? `Save "${shellText(language,label)}: ${shellText(language,choice)}" for ${name}?` : `Spremiti "${label}: ${choice}" za ${name}?`
}
export function delegationQuestion(language,label,enabled) {
  if(language==='en') return enabled ? `Allow administrators of this salon to edit "${shellText(language,label)}" for employees?` : `Revoke administrator editing of "${shellText(language,label)}"? Saved employee permissions will remain unchanged.`
  return enabled ? `Dopustiti administratorima ovog salona uređivanje postavke "${label}" za zaposlenike?` : `Ukinuti administratorima uređivanje postavke "${label}"? Već spremljene ovlasti zaposlenika ostat će nepromijenjene.`
}
export function historyTime(language,value,timeZone) {
  return new Date(value).toLocaleString(language==='en'?'en-GB':'hr-HR',{timeZone})
}
