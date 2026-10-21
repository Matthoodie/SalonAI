import './Header.css'

function Header({ currentUser }) {
  const userLabel =
    currentUser?.display_name?.trim() ||
    currentUser?.email ||
    'Korisnik'

  return (
    <header className="header">
      <div className="user">
        {userLabel}
      </div>
    </header>
  )
}

export default Header