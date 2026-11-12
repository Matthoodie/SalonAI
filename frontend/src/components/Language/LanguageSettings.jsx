import { useLanguage } from './LanguageProvider'
import LanguageSelector from './LanguageSelector'
export default function LanguageSettings() {
  const { t } = useLanguage()
  return <section className="settings-panel" aria-labelledby="language-settings-title">
    <h2 id="language-settings-title">{t('language.title')}</h2>
    <p>{t('language.description')}</p>
    <LanguageSelector showProgress />
  </section>
}
