import { useState } from 'react'
import Header from '../Header/Header'
import Sidebar from '../Sidebar/Sidebar'
import './Layout.css'

function Layout({ children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] =
    useState(false)
  return (
  <div className="app-layout">
    <Sidebar
      isMobileMenuOpen={isMobileMenuOpen}
      onCloseMobileMenu={() =>
        setIsMobileMenuOpen(false)
      }
    />

    {isMobileMenuOpen && (
      <button
        type="button"
        className="mobile-menu-backdrop"
        aria-label="Zatvori navigaciju"
        onClick={() =>
          setIsMobileMenuOpen(false)
        }
      />
    )}

    <main className="app-main">
      <div className="mobile-topbar">
        <strong>SalonAI</strong>

        <button
          type="button"
          className="mobile-menu-button"
          aria-label="Otvori navigaciju"
          aria-expanded={isMobileMenuOpen}
          onClick={() =>
            setIsMobileMenuOpen(true)
          }
        >
          ☰
        </button>
      </div>

      <Header />

      <div className="app-page-content">
        {children}
      </div>
    </main>
  </div>
 )
}

export default Layout