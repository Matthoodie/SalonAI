import { useEffect, useRef, useState } from 'react'

import {
  acceptInvitation,
} from '../../api/invitationApi'

function InvitationAcceptance({
  currentUser,
  onAccepted,
}) {
  const [token, setToken] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [acceptedMembership, setAcceptedMembership] = useState(null)

  const mountedRef = useRef(false)
  const savingRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()

    if (savingRef.current || acceptedMembership) {
      return
    }

    const cleanToken = token.trim()

    if (!/^[0-9a-f]{64}$/.test(cleanToken)) {
      setError(
        'Zalijepite cijeli kod pozivnice od 64 znaka.'
      )
      return
    }

    savingRef.current = true
    setIsSaving(true)
    setError('')

    try {
      const result = await acceptInvitation(cleanToken)

      if (!mountedRef.current) {
        return
      }

      setToken('')
      setAcceptedMembership(result.membership)
    } catch (requestError) {
      if (!mountedRef.current) {
        return
      }

      setError(
        requestError.message ||
          'Pozivnicu nije moguće prihvatiti.'
      )
    } finally {
      savingRef.current = false

      if (mountedRef.current) {
        setIsSaving(false)
      }
    }
  }

  return (
    <details style={{ marginBottom: '24px' }}>
      <summary style={{ cursor: 'pointer' }}>
        Imam kod pozivnice
      </summary>

      <div
        style={{
          padding: '16px',
          border: '1px solid #d1d5db',
          borderRadius: '12px',
          marginTop: '12px',
          maxWidth: '640px',
        }}
      >
        <h2>Pridruživanje salonu</h2>

        <p>
          Prijavljeni račun: <strong>{currentUser.email}</strong>
        </p>

        {acceptedMembership ? (
          <div>
            <p role="status">
              Pozivnica je prihvaćena. Možete otvoriti salon.
            </p>

            <button
              type="button"
              onClick={() =>
                onAccepted(acceptedMembership.salon_id)
              }
            >
              Otvori salon
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: 'grid', gap: '12px' }}
          >
            <p>
              Unesite kod koji vam je dostavio administrator.
              Primarna potvrđena e-mail adresa vašeg računa
              mora odgovarati adresi na pozivnici.
            </p>

            <label htmlFor="invitation-accept-token">
              Kod pozivnice
            </label>

            <input
              id="invitation-accept-token"
              type="text"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={isSaving}
              required
              style={{ width: '100%', boxSizing: 'border-box' }}
            />

            {error && <p role="alert">{error}</p>}

            <button type="submit" disabled={isSaving}>
              {isSaving ? 'Prihvaćanje…' : 'Prihvati pozivnicu'}
            </button>
          </form>
        )}
      </div>
    </details>
  )
}

export default InvitationAcceptance