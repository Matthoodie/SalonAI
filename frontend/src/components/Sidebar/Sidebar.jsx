import { Link } from 'react-router-dom'
import './Sidebar.css'

function Sidebar({
  isMobileMenuOpen,
  onCloseMobileMenu,
}) {
  return (
     <aside
  className={
    isMobileMenuOpen
      ? 'app-sidebar app-sidebar-mobile-open'
      : 'app-sidebar'
  }
>

  <button
  type="button"
  className="sidebar-mobile-close"
  aria-label="Zatvori navigaciju"
  onClick={onCloseMobileMenu}
>
  ×
</button>
      <h1>SalonAI</h1>

      <nav>
        <ul>
          <li>
            <Link to="/">
              Dashboard
            </Link>
          </li>

<li>
<Link
  to="/clients"
  onClick={onCloseMobileMenu}
>
  Klijenti
</Link>
</li>

<li>
  <Link 
  to="/services"
  onClick={onCloseMobileMenu}
  >
    Usluge
  </Link>
</li>

<li>
  <Link
    to="/employees"
    onClick={onCloseMobileMenu}
  >
    Zaposlenici
  </Link>
</li>
          <li>
            <Link to="/appointments"
            onClick={onCloseMobileMenu}>
              Termini
            </Link>
          </li>
<li>
  <Link to="/calendar"
  onClick={onCloseMobileMenu}>
    Kalendar
  </Link>
</li>

        </ul>
      </nav>
    </aside>
  )
}

export default Sidebar