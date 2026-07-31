import Header from '../Header/Header'
import Sidebar from '../Sidebar/Sidebar'
import './Layout.css'

function Layout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />

      <main className="app-main">
        <Header />

        <div className="app-page-content">
          {children}
        </div>
      </main>
    </div>
  )
}

export default Layout