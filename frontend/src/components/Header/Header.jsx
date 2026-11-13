import {useLanguage} from '../Language/LanguageProvider'
import {shellText,shellError} from '../Language/shellText.js'
import {useState} from 'react'
import {useClerk} from '@clerk/react-router'
import ProfileIdentity from '../Profile/ProfileIdentity'
import './Header.css'

export default function Header({ currentUser, role, workspaceControl }) {
 const {language} = useLanguage()
 const f = source => shellText(language,source)

  const clerk=useClerk()
  const [signingOut,setSigningOut]=useState(false)
  const [signOutError,setSignOutError]=useState('')
  async function signOut(){
    if(signingOut||!window.confirm(f('Nespremljeni unosi neće biti sačuvani. Odjaviti se?')))return
    setSigningOut(true);setSignOutError('')
    try{await clerk.signOut({redirectUrl:'/'})}catch{setSigningOut(false);setSignOutError('Odjava nije uspjela. Pokušajte ponovno.')}
  }
  return (
    <header className="header">
      <ProfileIdentity currentUser={currentUser} role={role} />
      {workspaceControl}
      <div><button type="button" className="header-signout" disabled={signingOut} onClick={signOut}>{signingOut?f('Odjava…'):f('Odjavi se')}</button>{signOutError&&<p role="alert">{shellError(language,signOutError)}</p>}</div>
    </header>
  )
}
