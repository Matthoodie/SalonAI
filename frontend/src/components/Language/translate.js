import { messages } from './messages.js'
import { normalizeLanguage } from './languagePreference.js'
export function translate(language, key) {
  const chosen = messages[normalizeLanguage(language)]
  return Object.hasOwn(chosen, key) ? chosen[key] : Object.hasOwn(messages.hr, key) ? messages.hr[key] : key
}
