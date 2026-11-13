import {useLanguage} from '../Language/LanguageProvider'
import {shellText} from '../Language/shellText.js'
import { NavLink } from 'react-router-dom'
import './Sidebar.css'

function Sidebar({
  isMobileMenuOpen,
  onCloseMobileMenu,
  canAccessFullCrm = false,
}) {
 const {language} = useLanguage()
 const f = source => shellText(language,source)

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
  aria-label={f("Zatvori navigaciju")}
  onClick={onCloseMobileMenu}
>
  ×
</button>
      <h1>SalonAI</h1>

      <nav>
        <ul>
          <li>
            <NavLink to="/" end onClick={onCloseMobileMenu}>{f("Pregled poslovanja")} </NavLink>
          </li>

          {canAccessFullCrm && (
            <li>
              <NavLink
                to="/clients"
                onClick={onCloseMobileMenu}
              >{f("Klijenti")} </NavLink>
            </li>
          )}

<li>
  <NavLink
  to="/services"
  onClick={onCloseMobileMenu}
  >{f("Usluge")} </NavLink>
</li>

<li>
  <NavLink
    to="/employees"
    onClick={onCloseMobileMenu}
  >{f("Zaposlenici")} </NavLink>
</li>
          <li>
            <NavLink to="/appointments"
            onClick={onCloseMobileMenu}>{f("Termini")} </NavLink>
          </li>
<li>
  <NavLink to="/calendar"
  onClick={onCloseMobileMenu}>{f("Kalendar")} </NavLink>
</li>
          <li>
            <NavLink to="/time-off-requests" onClick={onCloseMobileMenu}>{f("Zahtjevi za odsutnost")} </NavLink>
          </li>
          <li>
            <NavLink to="/blocked-time-requests" onClick={onCloseMobileMenu}>{f("Zahtjevi za blokirano vrijeme")} </NavLink>
          </li>
          <li>
              <NavLink
                to="/settings"
                onClick={onCloseMobileMenu}
              >{f("Postavke")} </NavLink>
            </li>

        </ul>
      </nav>
    </aside>
  )
}

export default Sidebar
