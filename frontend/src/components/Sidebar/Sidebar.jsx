import { NavLink } from 'react-router-dom'
import './Sidebar.css'

function Sidebar({
  isMobileMenuOpen,
  onCloseMobileMenu,
  canAccessFullCrm = false,
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
            <NavLink to="/" end onClick={onCloseMobileMenu}>
              Pregled poslovanja
            </NavLink>
          </li>

          {canAccessFullCrm && (
            <li>
              <NavLink
                to="/clients"
                onClick={onCloseMobileMenu}
              >
                Klijenti
              </NavLink>
            </li>
          )}

<li>
  <NavLink
  to="/services"
  onClick={onCloseMobileMenu}
  >
    Usluge
  </NavLink>
</li>

<li>
  <NavLink
    to="/employees"
    onClick={onCloseMobileMenu}
  >
    Zaposlenici
  </NavLink>
</li>
          <li>
            <NavLink to="/appointments"
            onClick={onCloseMobileMenu}>
              Termini
            </NavLink>
          </li>
<li>
  <NavLink to="/calendar"
  onClick={onCloseMobileMenu}>
    Kalendar
  </NavLink>
</li>
          <li>
            <NavLink to="/time-off-requests" onClick={onCloseMobileMenu}>
              Zahtjevi za odsutnost
            </NavLink>
          </li>
          <li>
            <NavLink to="/blocked-time-requests" onClick={onCloseMobileMenu}>
              Zahtjevi za blokirano vrijeme
            </NavLink>
          </li>
          <li>
              <NavLink
                to="/settings"
                onClick={onCloseMobileMenu}
              >
                Postavke
              </NavLink>
            </li>

        </ul>
      </nav>
    </aside>
  )
}

export default Sidebar
