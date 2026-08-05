import { Link } from 'react-router-dom'
import './Sidebar.css'

function Sidebar() {
  return (
    <aside className="app-sidebar">
      <h1>SalonAI</h1>

      <nav>
        <ul>
          <li>
            <Link to="/">
              Dashboard
            </Link>
          </li>

          <li>
            <Link to="/clients">
              Klijenti
            </Link>
          </li>

          <li>
            <Link to="/appointments">
              Termini
            </Link>
          </li>
<li>
  <Link to="/calendar">
    Kalendar
  </Link>
</li>

        </ul>
      </nav>
    </aside>
  )
}

export default Sidebar