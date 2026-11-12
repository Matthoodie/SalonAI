export const LANGUAGES = Object.freeze(['hr', 'en'])
export const normalizeLanguage = value => LANGUAGES.includes(value) ? value : 'hr'
export const languageKey = userId => userId === null || userId === undefined || String(userId) === '' ? null : 'salonai:language:v1:' + String(userId)
export function readLanguage(storage, userId) {
  try { const key = languageKey(userId); return key ? normalizeLanguage(storage.getItem(key)) : 'hr' }
  catch { return 'hr' }
}
export function saveLanguage(storage, userId, language) {
  const key = languageKey(userId)
  if (!key || !LANGUAGES.includes(language)) return false
  try { storage.setItem(key, language); return true } catch { return false }
}
