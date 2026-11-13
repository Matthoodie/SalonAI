import { useState } from 'react'
import { LanguageProvider, useLanguage } from '../Language/LanguageProvider'
import LanguageSelector from '../Language/LanguageSelector'
import { useClerk } from '@clerk/react-router'
import InvitationAcceptance from '../Invitations/InvitationAcceptance'
import './WelcomeScreen.css'
import CreateSalon from '../Onboarding/CreateSalon'
import '../Onboarding/OnboardingWizard.css'

function WelcomeScreenContent({ user, workspaces, busy, error, onRetry, onSelect, onAccepted }) {
  const { t, language } = useLanguage()
  const clerk = useClerk()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState(false)

  async function signOut() {
    if (signingOut) return
    setSigningOut(true)
    setSignOutError(false)
    try { await clerk.signOut({ redirectUrl: '/' }) }
    catch { setSignOutError(true); setSigningOut(false) }
  }

  return (
    <div className="salon-welcome">
      <header className="salon-welcome-header">
        <span className="salon-welcome-brand">SalonAI</span>
        {user && <LanguageSelector />}
        <button type="button" className="salon-welcome-secondary" onClick={signOut} disabled={signingOut}>
          {signingOut ? t('welcome.signingOut') : t('welcome.signOut')}
        </button>
      </header>
      <main className="salon-welcome-main" aria-busy={busy}>
        {user && language === 'en' && <p className="language-progress-note">{t('language.partial')}</p>}
        <p className="salon-welcome-eyebrow">{t('welcome.eyebrow')}</p>
        <h1>{workspaces.length ? t('welcome.choose') : t('welcome.title')}</h1>
        {user && <p className="salon-welcome-account">{t('welcome.account')} <strong>{user.email || user.display_name}</strong></p>}
        {signOutError && <p role="alert" className="salon-welcome-error">{t('welcome.signOutError')}</p>}
        {busy ? <div className="salon-welcome-panel" role="status">{t('welcome.loading')}</div> : error ? (
          <div className="salon-welcome-panel">
            <p role="alert" className="salon-welcome-error">{error}</p>
            <button type="button" className="salon-welcome-primary" onClick={onRetry}>{t('welcome.retry')}</button>
          </div>
        ) : user ? (
          <>
            {workspaces.length > 0 ? (
              <section className="salon-welcome-panel" aria-label={t('welcome.available')}>
                <p>{t('welcome.pick')}</p>
                <ul className="salon-welcome-workspaces">
                  {workspaces.map(({ salon, membership }) => (
                    <li key={salon.id}>
                      <button type="button" onClick={() => onSelect(salon.id)}>
                        <span><strong>{salon.name}</strong><small>{(['owner','admin','employee'].includes(membership.role) ? t('role.' + membership.role) : '')}</small></span>
                        <span aria-hidden="true">→</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <div className="salon-welcome-panel salon-welcome-intro">
                <h2>{t('welcome.join')}</h2>
                <p>{t('welcome.invitation')}</p>
                <p className="salon-welcome-note">{t('welcome.controlled')}</p>
              </div>
            )}
            {workspaces.length === 0 && <CreateSalon key={`create:${user.id}`} user={user} onCreated={onAccepted} />}
            <InvitationAcceptance key={`invitation:${user.id}`} currentUser={user} onAccepted={onAccepted} initiallyOpen={workspaces.length === 0} />
            <button type="button" className="salon-welcome-refresh" onClick={onRetry}>{t('welcome.refresh')}</button>
          </>
        ) : (
          <div className="salon-welcome-panel"><p>{t('welcome.unconfirmed')}</p><button type="button" className="salon-welcome-primary" onClick={onRetry}>{t('welcome.tryAgain')}</button></div>
        )}
      </main>
    </div>
  )
}

export default function WelcomeScreen(props) {
  return <LanguageProvider userId={props.user?.id}><WelcomeScreenContent {...props} /></LanguageProvider>
}
