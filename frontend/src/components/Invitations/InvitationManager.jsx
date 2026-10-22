import { useEffect, useRef, useState } from 'react'

import {
  createInvitation,
  revokeInvitation,
} from '../../api/invitationApi'

function InvitationManager({ employeeList = [] }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('employee')
  const [employeeId, setEmployeeId] = useState('')
  const [created, setCreated] = useState(null)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const mountedRef = useRef(false)
  const busyRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  const activeEmployees = employeeList.filter(
    (employee) => employee.active !== false
  )

  function requestWasCancelled(requestError) {
    return (
      requestError?.name === 'AbortError' ||
      requestError?.code === 'STALE_SALON_CONTEXT'
    )
  }

  async function handleCreate(event) {
    event.preventDefault()

    if (busyRef.current || created) {
      return
    }

    if (role === 'employee' && !employeeId) {
      setError('Odaberite profil zaposlenika.')
      return
    }

    if (
      role === 'admin' &&
      !window.confirm(
        'Pozvana osoba dobit će administratorske ovlasti u ovom salonu. Nastaviti?'
      )
    ) {
      return
    }

    busyRef.current = true
    setIsBusy(true)
    setError('')
    setNotice('')

    try {
      const result = await createInvitation({
        email: email.trim(),
        role,
        employee_id: employeeId || null,
      })

      if (!mountedRef.current) {
        return
      }

      setCreated(result)
    } catch (requestError) {
      if (
        mountedRef.current &&
        !requestWasCancelled(requestError)
      ) {
        setError(requestError.message)
      }
    } finally {
      busyRef.current = false

      if (mountedRef.current) {
        setIsBusy(false)
      }
    }
  }

  async function handleRevoke() {
    if (busyRef.current || !created) {
      return
    }

    if (!window.confirm('Opozvati ovu pozivnicu?')) {
      return
    }

    busyRef.current = true
    setIsBusy(true)
    setError('')
    setNotice('')

    try {
      await revokeInvitation(created.invitation.id)

      if (!mountedRef.current) {
        return
      }

      setCreated(null)
      setNotice(
        'Pozivnica je opozvana. Prethodni kod više se ne može koristiti.'
      )
    } catch (requestError) {
      if (
        mountedRef.current &&
        !requestWasCancelled(requestError)
      ) {
        setError(requestError.message)
      }
    } finally {
      busyRef.current = false

      if (mountedRef.current) {
        setIsBusy(false)
      }
    }
  }

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(created.token)

      if (mountedRef.current) {
        setNotice('Kod je kopiran.')
      }
    } catch {
      if (mountedRef.current) {
        setNotice(
          'Automatsko kopiranje nije dostupno. Označite kod u polju i pritisnite Ctrl+C.'
        )
      }
    }
  }

  function startAnother() {
    if (
      !window.confirm(
        'Kod trenutačne pozivnice više neće biti prikazan. Pozivnica ostaje važeća. Jeste li kopirali kod?'
      )
    ) {
      return
    }

    setCreated(null)
    setEmail('')
    setRole('employee')
    setEmployeeId('')
    setError('')
    setNotice('')
  }

  return (
    <details style={{ marginBottom: '24px' }}>
      <summary style={{ cursor: 'pointer' }}>
        Pozovi korisnika u salon
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
        <h2>Pozivnica za pristup salonu</h2>

        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}

        {created ? (
          <div style={{ display: 'grid', gap: '12px' }}>
            <p>
              Pozivnica je kreirana za{' '}
              <strong>{created.invitation.email_normalized}</strong>.
            </p>

            <p>
              Uloga:{' '}
              <strong>
                {created.invitation.role === 'admin'
                  ? 'Administrator'
                  : 'Zaposlenik'}
              </strong>
            </p>

            <p>
              Vrijedi do:{' '}
              {new Date(
                created.invitation.expires_at
              ).toLocaleString('hr-HR')}
            </p>

            <label htmlFor="created-invitation-token">
              Kod za primatelja
            </label>

            <textarea
              id="created-invitation-token"
              value={created.token}
              readOnly
              rows={3}
              spellCheck={false}
              onFocus={(event) => event.target.select()}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />

            <p>
              E-mail nije automatski poslan. Kopirajte kod i
              dostavite ga primatelju. Kod se prikazuje samo
              dok je ovaj obrazac otvoren; osvježavanje stranice
              ili promjena salona uklonit će ga iz prikaza.
            </p>

            <button
              type="button"
              onClick={copyToken}
              disabled={isBusy}
            >
              Kopiraj kod
            </button>

            <button
              type="button"
              onClick={handleRevoke}
              disabled={isBusy}
            >
              {isBusy ? 'Opozivanje…' : 'Opozovi pozivnicu'}
            </button>

            <button
              type="button"
              onClick={startAnother}
              disabled={isBusy}
            >
              Pripremi drugu pozivnicu
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleCreate}
            style={{ display: 'grid', gap: '12px' }}
          >
            <label htmlFor="invitation-email">
              E-mail primatelja
            </label>

            <input
              id="invitation-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={320}
              required
              disabled={isBusy}
            />

            <label htmlFor="invitation-role">
              Uloga
            </label>

            <select
              id="invitation-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              disabled={isBusy}
            >
              <option value="employee">Zaposlenik</option>
              <option value="admin">Administrator</option>
            </select>

            <label htmlFor="invitation-employee">
              Profil zaposlenika
              {role === 'admin' ? ' — neobavezno' : ''}
            </label>

            <select
              id="invitation-employee"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              required={role === 'employee'}
              disabled={isBusy}
            >
              <option value="">
                {role === 'admin'
                  ? 'Bez profila zaposlenika'
                  : 'Odaberite zaposlenika'}
              </option>

              {activeEmployees.map((employee) => (
                <option
                  key={employee.id}
                  value={String(employee.id)}
                >
                  {employee.name}
                </option>
              ))}
            </select>

            <p>
              Za zaposlenika najprije mora postojati profil.
              Profil koji je već povezan s računom nije moguće
              dodijeliti drugoj osobi.
            </p>

            <button type="submit" disabled={isBusy}>
              {isBusy ? 'Kreiranje…' : 'Kreiraj pozivnicu'}
            </button>
          </form>
        )}
      </div>
    </details>
  )
}

export default InvitationManager