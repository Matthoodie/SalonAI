import Brand from './components/Brand/Brand.jsx'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import {
  ClerkProvider,
  Show,
  SignIn,
  useUser,
} from '@clerk/react-router'

import './index.css'
import App from './App.jsx'

const clerkPublishableKey =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!clerkPublishableKey) {
  throw new Error(
    'Missing VITE_CLERK_PUBLISHABLE_KEY'
  )
}

function SignedInSalonApp() {
  const { isLoaded, user } = useUser()

  if (!isLoaded) {
    return (
      <p role="status">
        <span lang="hr">Učitavanje korisničkog računa…</span> / <span lang="en">Loading your account…</span>
      </p>
    )
  }

  if (!user) {
    return null
  }

  return <App key={user.id} />
}

function SalonAIAuthGate() {
  return (
    <Show
      when="signed-in"
      fallback={
        <main
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: '24px',
          }}
        >
          <div style={{ display: 'grid', gap: '24px', justifyItems: 'center', maxWidth: '100%' }}>
            <Brand />
            <SignIn routing="hash" />
          </div>
        </main>
      }
    >
      <SignedInSalonApp />
    </Show>
  )
}

createRoot(
  document.getElementById('root')
).render(
  <StrictMode>
    <BrowserRouter>
      <ClerkProvider
        publishableKey={clerkPublishableKey}
      >
        <SalonAIAuthGate />
      </ClerkProvider>
    </BrowserRouter>
  </StrictMode>
)
