import { Link } from 'react-router-dom'


function Sidebar() {

  return (

    <aside className="sidebar">

      <h1>
        SalonAI
      </h1>


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

          <Link to="/appointments">
              Termini
            </Link>


        </ul>

      </nav>

    </aside>

  )

}


export default Sidebar