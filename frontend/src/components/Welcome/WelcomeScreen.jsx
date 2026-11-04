import { useState } from 'react'
import { useClerk } from '@clerk/react-router'
import InvitationAcceptance from '../Invitations/InvitationAcceptance'
import './WelcomeScreen.css'
import CreateSalon from '../Onboarding/CreateSalon'
import '../Onboarding/OnboardingWizard.css'

export default function WelcomeScreen({ user, workspaces, busy, error, onRetry, onSelect, onAccepted }) {
  const clerk = useClerk()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')

  async function signOut() {
    if (signingOut) return
    setSigningOut(true)
    setSignOutError('')
    try { await clerk.signOut({ redirectUrl: '/' }) }
    catch { setSignOutError('Odjava nije uspjela. Pokušajte ponovno.'); setSigningOut(false) }
  }

  return (
    <div className="salon-welcome">
      <header className="salon-welcome-header">
        <span className="salon-welcome-brand">SalonAI</span>
        <button type="button" className="salon-welcome-secondary" onClick={signOut} disabled={signingOut}>
          {signingOut ? 'Odjava…' : 'Odjavi se'}
        </button>
      </header>
      <main className="salon-welcome-main" aria-busy={busy}>
        <p className="salon-welcome-eyebrow">DOBRO DOŠLI</p>
        <h1>{workspaces.length ? 'Odaberite svoj salon' : 'Vaš prostor za rad počinje ovdje'}</h1>
        {user && <p className="salon-welcome-account">Prijavljeni račun: <strong>{user.email || user.display_name}</strong></p>}
        {signOutError && <p role="alert" className="salon-welcome-error">{signOutError}</p>}
        {busy ? <div className="salon-welcome-panel" role="status">Učitavanje dostupnih salona…</div> : error ? (
          <div className="salon-welcome-panel">
            <p role="alert" className="salon-welcome-error">{error}</p>
            <button type="button" className="salon-welcome-primary" onClick={onRetry}>Ponovno učitaj salone</button>
          </div>
        ) : user ? (
          <>
            {workspaces.length > 0 ? (
              <section className="salon-welcome-panel" aria-label="Dostupni saloni">
                <p>Odaberite salon u kojem želite nastaviti raditi.</p>
                <ul className="salon-welcome-workspaces">
                  {workspaces.map(({ salon, membership }) => (
                    <li key={salon.id}>
                      <button type="button" onClick={() => onSelect(salon.id)}>
                        <span><strong>{salon.name}</strong><small>{({ owner: 'Vlasnik', admin: 'Administrator', employee: 'Zaposlenik' })[membership.role]}</small></span>
                        <span aria-hidden="true">→</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <div className="salon-welcome-panel salon-welcome-intro">
                <h2>Pridružite se svom timu</h2>
                <p>Za pristup salonu potrebna vam je pozivnica njegova vlasnika ili administratora. Ako je još nemate, zatražite kod pozivnice.</p>
                <p className="salon-welcome-note">Otvaranje novih salona trenutačno je dostupno samo u kontroliranom testiranju.</p>
              </div>
            )}
            {workspaces.length === 0 && <CreateSalon key={user.id} user={user} onCreated={onAccepted} />}
            <InvitationAcceptance key={user.id} currentUser={user} onAccepted={onAccepted} initiallyOpen={workspaces.length === 0} />
            <button type="button" className="salon-welcome-refresh" onClick={onRetry}>Osvježi dostupne salone</button>
          </>
        ) : (
          <div className="salon-welcome-panel"><p>Nije moguće potvrditi korisnički račun.</p><button type="button" className="salon-welcome-primary" onClick={onRetry}>Pokušaj ponovno</button></div>
        )}
      </main>
    </div>
  )
}
