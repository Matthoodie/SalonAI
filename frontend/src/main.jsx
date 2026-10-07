import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import {
  ClerkProvider,
  Show,
  SignIn,
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
          <SignIn routing="hash" />
        </main>
      }
    >
      <App />
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
  </StrictMode>,
)