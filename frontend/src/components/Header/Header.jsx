import { useLocation } from 'react-router-dom'
import './Header.css'

function Header() {
  const location = useLocation()

  const pageTitles = {
    '/': 'Dashboard',
    '/clients': 'Klijenti',
    '/services': 'Usluge',
    '/appointments': 'Termini',
    '/calendar': 'Kalendar',
  }

  const pageTitle =
    pageTitles[location.pathname] ||
    'SalonAI'

  return (
    <header className="header">
      <h2>{pageTitle}</h2>

      <div className="user">
        Matej
      </div>
    </header>
  )
}

export default Header