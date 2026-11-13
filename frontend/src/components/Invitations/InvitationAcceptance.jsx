import {useLanguage} from '../Language/LanguageProvider'
import {flowText,flowError} from '../Language/flowText.js'
import { useEffect, useRef, useState } from 'react'
import './InvitationAcceptance.css'

import {
  acceptInvitation,
} from '../../api/invitationApi'

function InvitationAcceptance({
  currentUser,
  onAccepted,
  initiallyOpen = false,
}) {
 const {language} = useLanguage()
 const f = source => flowText(language,source)
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
        requestError
      )
    } finally {
      savingRef.current = false

      if (mountedRef.current) {
        setIsSaving(false)
      }
    }
  }

  return (
    <details className="invitation-acceptance" open={initiallyOpen || undefined}>
      <summary>{f("Pridruži se salonu kodom pozivnice")} </summary>

      <div className="invitation-acceptance-body">
        <h2>{f("Pridruživanje salonu")}</h2>

        <p>{f("Prijavljeni račun:")} <strong>{currentUser.email}</strong>
        </p>

        {acceptedMembership ? (
          <div>
            <p role="status">{f("Pozivnica je prihvaćena. Možete otvoriti salon.")} </p>

            <button
              type="button"
              onClick={() =>
                onAccepted(acceptedMembership.salon_id)
              }
            >{f("Otvori salon")} </button>
          </div>
        ) : (
          <form
            noValidate
            onSubmit={handleSubmit}
            style={{ display: 'grid', gap: '12px' }}
          >
            <p>{f("Unesite kod koji vam je dostavio administrator. Primarna potvrđena e-mail adresa vašeg računa mora odgovarati adresi na pozivnici.")} </p>

            <label htmlFor="invitation-accept-token">{f("Kod pozivnice")} </label>

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
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'invitation-accept-error' : undefined}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />

            {error && <p id="invitation-accept-error" role="alert">{flowError(language,error)}</p>}

            <button type="submit" disabled={isSaving}>
              {isSaving ? f('Prihvaćanje…') : f('Prihvati pozivnicu')}
            </button>
          </form>
        )}
      </div>
    </details>
  )
}

export default InvitationAcceptance
