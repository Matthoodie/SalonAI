import { useLanguage } from '../Language/LanguageProvider'
import LanguageSettings from '../Language/LanguageSettings'
import AppearanceSettings from '../Theme/AppearanceSettings'
import ProfileIdentity from '../Profile/ProfileIdentity'
import InvitationAcceptance from '../Invitations/InvitationAcceptance'

export default function AccountSettings({ authContext, onAccepted }) {
  const { t } = useLanguage()
  const { user, current_salon: salon, membership } = authContext
  return (
    <>
      <div className="settings-page-heading">
        <p className="settings-eyebrow">{t('settings.eyebrow')}</p>
        <h1>{t('settings.title')}</h1>
        <p>{t('settings.description')}</p>
      </div>
      <section className="settings-panel" aria-labelledby="personal-profile-heading">
        <h2 id="personal-profile-heading">{t('settings.profile')}</h2>
        <ProfileIdentity currentUser={user} role={membership.role} showEdit />
      </section>
      <section className="settings-panel" aria-labelledby="salon-membership-heading">
        <h2 id="salon-membership-heading">{t('settings.memberships')}</h2>
        <p>{t('settings.current')} <strong>{salon.name}</strong></p>
        <p>{t('settings.invitation')}</p>
        <InvitationAcceptance currentUser={user} onAccepted={onAccepted} />
      </section>
      <LanguageSettings />
      <AppearanceSettings />
    </>
  )
}
