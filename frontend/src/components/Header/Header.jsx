import ProfileIdentity from '../Profile/ProfileIdentity'
import './Header.css'

export default function Header({ currentUser, role, workspaceControl }) {
  return (
    <header className="header">
      <ProfileIdentity currentUser={currentUser} role={role} />
      {workspaceControl}
    </header>
  )
}
