import Sidebar from './Sidebar'
import Header from './Header'

function Layout({ children }) {

  return (
    <div className="layout">

      <Sidebar />

      <main className="main">

        <Header />

        {children}

      </main>

    </div>
  )
}

export default Layout