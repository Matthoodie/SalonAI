import ProfileIdentity from '../Profile/ProfileIdentity'
import InvitationAcceptance from '../Invitations/InvitationAcceptance'

export default function AccountSettings({ authContext, onAccepted, onExport }) {
  const { user, current_salon: salon, membership } = authContext
  return (
    <>
      <div className="settings-page-heading">
        <p className="settings-eyebrow">VAŠ RAČUN I SALON</p>
        <h1>Postavke</h1>
        <p>Uredite svoj profil i pristup salonima.</p>
      </div>
      <section className="settings-panel" aria-labelledby="personal-profile-heading">
        <h2 id="personal-profile-heading">Moj profil</h2>
        <ProfileIdentity currentUser={user} role={membership.role} showEdit />
      </section>
      <section className="settings-panel" aria-labelledby="salon-membership-heading">
        <h2 id="salon-membership-heading">Saloni i članstva</h2>
        <p>Trenutačni salon: <strong>{salon.name}</strong></p>
        <p>Za pristup drugom salonu upotrijebite pozivnicu koju ste dobili od njegove ovlaštene osobe.</p>
        <InvitationAcceptance currentUser={user} onAccepted={onAccepted} />
      </section>
      {onExport && (
        <section className="settings-panel" aria-labelledby="salon-export-heading">
          <h2 id="salon-export-heading">Izvoz podataka</h2>
          <p>Preuzmite JSON datoteku trenutačno učitanih klijenata, usluga, zaposlenika i termina. Ovaj izvoz nije potpuna sigurnosna kopija salona i ne uključuje sve podatke aplikacije.</p>
          <button type="button" onClick={onExport}>Preuzmi podatke (JSON)</button>
        </section>
      )}
    </>
  )
}
