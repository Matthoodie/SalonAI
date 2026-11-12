import { useId } from 'react'
import { useLanguage } from './LanguageProvider'
import './Language.css'
export default function LanguageSelector({ showProgress = false }) {
  const id = useId()
  const { language, select, t, notice } = useLanguage()
  return <div className="language-control">
    <label htmlFor={id}>{t('language.label')}</label>
    <select id={id} value={language} onChange={event => select(event.target.value)}>
      <option value="hr" lang="hr">Hrvatski</option>
      <option value="en" lang="en">English</option>
    </select>
    <p className="language-notice" role="status">{notice ? t(notice) : ''}</p>
    {showProgress && language === 'en' && <p className="language-progress">{t('language.partial')}</p>}
  </div>
}
