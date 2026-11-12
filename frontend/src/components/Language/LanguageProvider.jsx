import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { languageKey, LANGUAGES, normalizeLanguage, readLanguage, saveLanguage } from './languagePreference.js'
import { translate } from './translate.js'
const LanguageContext = createContext({ language: 'hr', t: key => translate('hr', key), select: () => {}, notice: '' })
export const useLanguage = () => useContext(LanguageContext)
function storage() { try { return window.localStorage } catch { return null } }
function AccountLanguage({ userId, children }) {
  const [language, setLanguage] = useState(() => readLanguage(storage(), userId))
  const [notice, setNotice] = useState('')
  useEffect(() => {
    const onStorage = event => {
      if ((event.key === languageKey(userId) || event.key === null) && event.storageArea === storage()) {
        setLanguage(event.key === null ? readLanguage(storage(), userId) : normalizeLanguage(event.newValue))
        setNotice('')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [userId])
  useLayoutEffect(() => {
    const html = document.documentElement
    const previous = html.getAttribute('lang')
    html.setAttribute('lang', language)
    return () => previous === null ? html.removeAttribute('lang') : html.setAttribute('lang', previous)
  }, [language])
  const select = useCallback(value => {
    if (!LANGUAGES.includes(value)) return
    setLanguage(value)
    setNotice(saveLanguage(storage(), userId, value) ? 'language.saved' : 'language.unsaved')
  }, [userId])
  const value = useMemo(() => ({ language, select, notice, t: key => translate(language, key) }), [language, select, notice])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
export function LanguageProvider({ userId, children }) {
  // Account changes reset personal preference; language changes never remount forms.
  return <AccountLanguage key={languageKey(userId) || 'guest'} userId={userId}>{children}</AccountLanguage>
}
