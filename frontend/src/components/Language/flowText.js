import {flowMessages} from './flowMessages.js'
const fallback = 'Radnju nije moguće potvrditi. Provjerite vezu i osvježite podatke prije ponovnog pokušaja.'
export function flowText(language, source) {
  if (typeof source !== 'string') return ''
  const key = source.trim().replace(/\s+/g, ' ')
  if (!Object.hasOwn(flowMessages, key)) return source
  const translated = flowMessages[key][language === 'en' ? 'en' : 'hr']
  return source.match(/^\s*/)[0] + translated + source.match(/\s*$/)[0]
}
// Store errors, not translated strings, so language changes refresh an open alert.
// Unknown server messages use a neutral local message; never imply a failed write rolled back.
export function flowError(language, failure) {
  if (Array.isArray(failure)) return failure.map(item => flowError(language, item)).join(' ')
  const message = typeof failure === 'string' ? failure : failure?.message
  return flowText(language, Object.hasOwn(flowMessages, message?.trim() || '') ? message : fallback)
}
export function flowStepTitle(language, label, index, total) {
  return language === 'en' ? `${flowText(language, label)} — step ${index} of ${total}` : `${flowText(language, label)} — korak ${index} od ${total}`
}
