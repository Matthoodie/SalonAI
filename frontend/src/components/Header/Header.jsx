import {useState} from 'react'
import {useClerk} from '@clerk/react-router'
import ProfileIdentity from '../Profile/ProfileIdentity'
import './Header.css'

export default function Header({ currentUser, role, workspaceControl }) {
  const clerk=useClerk()
  const [signingOut,setSigningOut]=useState(false)
  const [signOutError,setSignOutError]=useState('')
  async function signOut(){
    if(signingOut||!window.confirm('Nespremljeni unosi neće biti sačuvani. Odjaviti se?'))return
    setSigningOut(true);setSignOutError('')
    try{await clerk.signOut({redirectUrl:'/'})}catch{setSigningOut(false);setSignOutError('Odjava nije uspjela. Pokušajte ponovno.')}
  }
  return (
    <header className="header">
      <ProfileIdentity currentUser={currentUser} role={role} />
      {workspaceControl}
      <div><button type="button" className="header-signout" disabled={signingOut} onClick={signOut}>{signingOut?'Odjava…':'Odjavi se'}</button>{signOutError&&<p role="alert">{signOutError}</p>}</div>
    </header>
  )
}
