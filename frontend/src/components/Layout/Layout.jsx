import SupportLauncher from '../Support/SupportLauncher.jsx'
import Brand from '../Brand/Brand.jsx'
import {useLanguage} from '../Language/LanguageProvider'
import {shellText} from '../Language/shellText.js'
import {LanguageProvider} from '../Language/LanguageProvider'
import {ThemeProvider,useTheme} from '../Theme/ThemeProvider'
import '../Theme/theme.css'
import { useState } from 'react'
import Header from '../Header/Header'
import Sidebar from '../Sidebar/Sidebar'
import './Layout.css'

function LayoutContent({
  children,
  currentUser,
  currentSalon,
  role,
  workspaceControl,
  canAccessFullCrm = false,
}) {
 const {language} = useLanguage()
 const f = source => shellText(language,source)

  const {resolved}=useTheme()
  const [isMobileMenuOpen, setIsMobileMenuOpen] =
    useState(false)
  return (
  <div className="app-layout" data-theme={resolved}>
    <Sidebar
      canAccessFullCrm={canAccessFullCrm}
      isMobileMenuOpen={isMobileMenuOpen}
      onCloseMobileMenu={() =>
        setIsMobileMenuOpen(false)
      }
    />

    {isMobileMenuOpen && (
      <button
        type="button"
        className="mobile-menu-backdrop"
        aria-label={f("Zatvori navigaciju")}
        onClick={() =>
          setIsMobileMenuOpen(false)
        }
      />
    )}

    <main className="app-main">
      <div className="mobile-topbar">
        <strong><Brand compact /></strong>

        <button
          type="button"
          className="mobile-menu-button"
          aria-label={f("Otvori navigaciju")}
          aria-expanded={isMobileMenuOpen}
          onClick={() =>
            setIsMobileMenuOpen(true)
          }
        >
          ☰
        </button>
      </div>

      <Header currentUser={currentUser} role={role} workspaceControl={workspaceControl} />

      <div className="app-page-content">
        <div className="support-toolbar"><SupportLauncher user={currentUser} salon={currentSalon} /></div>
        {children}
      </div>
    </main>
  </div>
 )
}

export default function Layout(props) {
  return <LanguageProvider userId={props.currentUser?.id}><ThemeProvider key={String(props.currentUser?.id || "guest")} userId={props.currentUser?.id}><LayoutContent {...props}/></ThemeProvider></LanguageProvider>
}
