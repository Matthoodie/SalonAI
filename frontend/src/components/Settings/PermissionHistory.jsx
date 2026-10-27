import { useEffect, useRef, useState } from 'react'

import {
  fetchPermissionHistory,
} from '../../api/permissionSettingsApi'

const permissionLabels = {
  'appointment.create': 'Kreiranje termina',
  'appointment.reschedule': 'Pomicanje termina',
  'appointment.change_status': 'Promjena statusa i otkazivanje',
  'appointment.change_client': 'Promjena klijenta na terminu',
}

const roleLabels = {
  owner: 'Vlasnik',
  admin: 'Administrator',
}


function wasCancelled(error) {
  return (
    error?.name === 'AbortError' ||
    error?.code === 'STALE_SALON_CONTEXT'
  )
}

function personLabel(name, email, id) {
  if (name && email) {
    return `${name} (${email})`
  }

  return name || email || `Korisnik #${id}`
}

function valueLabel(value, action) {
  if (action === 'admin_delegation') {
    return value === 'enabled'
      ? 'Delegirano'
      : value === 'disabled'
        ? 'Nije delegirano'
        : 'Nepoznata vrijednost'
  }

  if (value === null) {
    return 'Naslijedi pravilo uloge'
  }

  return {
    deny: 'Zabranjeno',
    self: 'Vlastiti termini',
  }[value] || 'Nepoznata vrijednost'
}

function PermissionHistory({
  refreshToken = 0,
  salonTimezone = 'Europe/Zagreb',
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [changes, setChanges] = useState([])
  const [nextBeforeId, setNextBeforeId] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const generationRef = useRef(0)
  const moreControllerRef = useRef(null)
  const moreBusyRef = useRef(false)

  useEffect(() => {
    const generation = ++generationRef.current
    const controller = new AbortController()
    let cancelled = false

    moreControllerRef.current?.abort()
    moreControllerRef.current = null
    moreBusyRef.current = false

    setChanges([])
    setNextBeforeId(null)
    setError('')
    setIsLoadingMore(false)
    setIsLoading(isOpen)

    if (isOpen) {
      async function load() {
        try {
          const result = await fetchPermissionHistory({
            signal: controller.signal,
          })

          if (
            !cancelled &&
            generation === generationRef.current
          ) {
            setChanges(result.changes)
            setNextBeforeId(result.next_before_id)
          }
        } catch (requestError) {
          if (
            !cancelled &&
            generation === generationRef.current &&
            !wasCancelled(requestError)
          ) {
            setError(requestError.message)
          }
        } finally {
          if (
            !cancelled &&
            generation === generationRef.current
          ) {
            setIsLoading(false)
          }
        }
      }

      load()
    }

    return () => {
      cancelled = true
      controller.abort()
      moreControllerRef.current?.abort()
      generationRef.current += 1
    }
  }, [isOpen, refreshToken, reloadToken])

  async function loadMore() {
    if (
      !isOpen ||
      isLoading ||
      moreBusyRef.current ||
      nextBeforeId === null
    ) {
      return
    }

    const generation = generationRef.current
    const controller = new AbortController()

    moreControllerRef.current = controller
    moreBusyRef.current = true
    setIsLoadingMore(true)
    setError('')

    try {
      const result = await fetchPermissionHistory({
        beforeId: nextBeforeId,
        signal: controller.signal,
      })

      if (
        controller.signal.aborted ||
        generation !== generationRef.current
      ) {
        return
      }

      setChanges((current) => {
        const seen = new Set(
          current.map((change) => String(change.id))
        )

        const additional = result.changes.filter((change) => {
          const id = String(change.id)

          if (seen.has(id)) {
            return false
          }

          seen.add(id)
          return true
        })

        return [...current, ...additional]
      })

      setNextBeforeId(result.next_before_id)
    } catch (requestError) {
      if (
        !controller.signal.aborted &&
        generation === generationRef.current &&
        !wasCancelled(requestError)
      ) {
        setError(requestError.message)
      }
    } finally {
      if (
        generation === generationRef.current &&
        moreControllerRef.current === controller
      ) {
        moreControllerRef.current = null
        moreBusyRef.current = false
        setIsLoadingMore(false)
      }
    }
  }

  return (
    <details
      open={isOpen}
      onToggle={(event) => {
        setIsOpen(event.currentTarget.open)
      }}
      className="settings-panel permission-history"
    >
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
        Povijest promjena ovlasti i delegacija
      </summary>

      {isOpen && (
        <div style={{ marginTop: '16px' }}>
          <p>
            Promjene svih zaposlenika u odabranom salonu.
            Najnoviji zapisi prikazani su prvi.
          </p>

          <button
            type="button"
            disabled={isLoading || isLoadingMore}
            onClick={() => {
              setReloadToken((value) => value + 1)
            }}
          >
            Osvježi povijest
          </button>

          {error && <p role="alert">{error}</p>}

          {isLoading ? (
            <p role="status">Učitavanje povijesti…</p>
          ) : changes.length === 0 ? (
            !error && <p>Još nema zabilježenih promjena ovlasti.</p>
          ) : (
            <>
              <ol className="history-list">
                {changes.map((change) => (
                  <li className="history-card" key={change.id}>
                    <div className="history-heading">
                      <strong>{permissionLabels[change.permission_key] || change.permission_key}</strong>
                      <time dateTime={change.created_at}>
                        {new Date(change.created_at).toLocaleString('hr-HR', { timeZone: salonTimezone })}
                      </time>
                    </div>
                    <p className="history-kind">{change.action === 'admin_delegation' ? 'Delegacija administratorima' : 'Ovlast zaposlenika'}</p>
                    <dl className="history-details">
                      <div><dt>Odnosi se na</dt><dd>{change.action === 'admin_delegation'
                        ? 'Administratori ovog salona'
                        : personLabel(change.target_display_name, change.target_email, change.target_user_id)}</dd></div>
                      <div><dt>Promijenio/la</dt><dd>{personLabel(change.actor_display_name, change.actor_email, change.actor_user_id)}
                        <small>Uloga pri promjeni: {roleLabels[change.actor_role] || change.actor_role}</small></dd></div>
                    </dl>
                    <dl className="history-transition">
                      <div><dt>Prije</dt><dd>{valueLabel(change.previous_value, change.action)}</dd></div>
                      <div><dt>Poslije</dt><dd>{valueLabel(change.next_value, change.action)}</dd></div>
                    </dl>
                  </li>
                ))}
              </ol>

              {nextBeforeId !== null && (
                <button
                  type="button"
                  disabled={isLoadingMore}
                  onClick={loadMore}
                  style={{ marginTop: '12px' }}
                >
                  {isLoadingMore
                    ? 'Učitavanje…'
                    : 'Učitaj starije promjene'}
                </button>
              )}
            </>
          )}

          <p>
            Vrijeme je prikazano za {salonTimezone}.
            Imena i e-mail adrese prikazuju aktualne podatke računa.
            Uloga izvršitelja i vrijednosti postavke zabilježene
            su u trenutku promjene.
          </p>

          <p>
            „Naslijedi pravilo uloge” označava uklonjenu pojedinačnu
            postavku. Ovaj zapis ne prikazuje povijesnu vrijednost
            zajedničkog pravila uloge.
          </p>
        </div>
      )}
    </details>
  )
}

export default PermissionHistory
