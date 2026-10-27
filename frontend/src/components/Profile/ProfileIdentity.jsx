import { useState } from 'react'
import { useClerk, useUser } from '@clerk/react-router'
import { profileView, roleLabel } from './profileView.js'

export default function ProfileIdentity({ currentUser, role, showEdit = false }) {
  const { user, isLoaded } = useUser()
  const clerk = useClerk()
  const [failedImage, setFailedImage] = useState(null)
  const [error, setError] = useState('')
  const profile = profileView(user, currentUser)
  async function openProfile() {
    setError('')
    try { await clerk.openUserProfile() }
    catch { setError('Profil trenutačno nije moguće otvoriti. Pokušajte ponovno.') }
  }
  return (
    <div className="profile-identity">
      <button className="profile-avatar" type="button" onClick={openProfile}
        disabled={!isLoaded || !user} aria-label="Uredi korisnički profil i fotografiju" title="Uredi profil">
        {profile.imageUrl && failedImage !== profile.imageUrl
          ? <img src={profile.imageUrl} alt="" onError={() => setFailedImage(profile.imageUrl)} />
          : <span aria-hidden="true">{profile.initials}</span>}
      </button>
      <div className="profile-copy">
        <strong>{profile.name}</strong>
        {profile.email && profile.email !== profile.name && <span>{profile.email}</span>}
        {roleLabel(role) && <span className="profile-role">{roleLabel(role)}</span>}
        {showEdit && <button className="profile-edit" type="button" onClick={openProfile} disabled={!isLoaded || !user}>Uredi ime i fotografiju</button>}
        {error && <p role="alert">{error}</p>}
      </div>
    </div>
  )
}
