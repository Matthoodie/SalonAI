import { useEffect, useRef, useState } from 'react'

import {
  fetchInvitations,
  revokeInvitation,
} from '../../api/invitationApi'

const statusLabels = {
  pending: 'Na čekanju',
  expired: 'Istekla',
  accepted: 'Prihvaćena',
  revoked: 'Opozvana',
}

function formatDate(value) {
  return value
    ? new Date(value).toLocaleString('hr-HR')
    : '—'
}

function isCancelled(error) {
  return (
    error?.name === 'AbortError' ||
    error?.code === 'STALE_SALON_CONTEXT'
  )
}

function InvitationList({
  refreshToken = 0,
  onChanged,
}) {
  const [invitations, setInvitations] = useState([])
  const [nextBeforeId, setNextBeforeId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [revokingId, setRevokingId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const mountedRef = useRef(false)
  const generationRef = useRef(0)
  const loadingRef = useRef(false)
  const revokingRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      generationRef.current += 1
    }
  }, [])

  useEffect(() => {
    const generation = ++generationRef.current
    const controller = new AbortController()

    loadingRef.current = true
    setIsLoading(true)
    setError('')
    setInvitations([])
    setNextBeforeId(null)

    async function load() {
      try {
        const result = await fetchInvitations({
          signal: controller.signal,
        })

        if (
          !mountedRef.current ||
          generationRef.current !== generation
        ) {
          return
        }

        setInvitations(result.invitations)
        setNextBeforeId(result.next_before_id)
      } catch (requestError) {
        if (
          mountedRef.current &&
          generationRef.current === generation &&
          !isCancelled(requestError)
        ) {
          setError(requestError.message)
        }
      } finally {
        if (
          mountedRef.current &&
          generationRef.current === generation
        ) {
          loadingRef.current = false
          setIsLoading(false)
        }
      }
    }

    load()

    return () => {
      controller.abort()

      if (generationRef.current === generation) {
        generationRef.current += 1
      }
    }
  }, [refreshToken, reloadToken])

  async function loadMore() {
    if (
      loadingRef.current ||
      revokingRef.current ||
      !nextBeforeId
    ) {
      return
    }

    const generation = generationRef.current

    loadingRef.current = true
    setIsLoading(true)
    setError('')

    try {
      const result = await fetchInvitations({
        beforeId: nextBeforeId,
      })

      if (
        !mountedRef.current ||
        generationRef.current !== generation
      ) {
        return
      }

      setInvitations((current) => {
        const byId = new Map(
          current.map((item) => [String(item.id), item])
        )

        for (const item of result.invitations) {
          byId.set(String(item.id), item)
        }

        return [...byId.values()]
      })

      setNextBeforeId(result.next_before_id)
    } catch (requestError) {
      if (
        mountedRef.current &&
        generationRef.current === generation &&
        !isCancelled(requestError)
      ) {
        setError(requestError.message)
      }
    } finally {
      if (
        mountedRef.current &&
        generationRef.current === generation
      ) {
        loadingRef.current = false
        setIsLoading(false)
      }
    }
  }

  async function revoke(invitation) {
    if (revokingRef.current || loadingRef.current) {
      return
    }

    if (!window.confirm(
      `Opozvati pozivnicu za ${invitation.email_normalized}?`
    )) {
      return
    }

    revokingRef.current = true
    setRevokingId(invitation.id)
    setError('')
    setNotice('')

    try {
      await revokeInvitation(invitation.id)

      if (!mountedRef.current) {
        return
      }

      setNotice('Pozivnica je opozvana.')

      if (onChanged) {
        onChanged()
      } else {
        setReloadToken((value) => value + 1)
      }
    } catch (requestError) {
      if (
        mountedRef.current &&
        !isCancelled(requestError)
      ) {
        setError(requestError.message)
      }
    } finally {
      revokingRef.current = false

      if (mountedRef.current) {
        setRevokingId(null)
      }
    }
  }

  return (
    <section
      aria-labelledby="invitation-list-title"
      style={{ marginBottom: '28px' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <h2 id="invitation-list-title">Pozivnice</h2>

        <button
          type="button"
          disabled={isLoading || revokingId !== null}
          onClick={() => {
            setNotice('')
            setReloadToken((value) => value + 1)
          }}
        >
          Osvježi popis
        </button>
      </div>

      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}

      {isLoading && <p role="status">Učitavanje pozivnica…</p>}

      {!isLoading && !error && invitations.length === 0 && (
        <p>U ovom salonu još nema pozivnica.</p>
      )}

      {invitations.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr>
                {[
                  'Primatelj',
                  'Uloga / profil',
                  'Status',
                  'Kreirana',
                  'Vrijedi do',
                  'Radnja',
                ].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #d1d5db',
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {invitations.map((invitation) => {
                const canRevoke =
                  invitation.status === 'pending' ||
                  invitation.status === 'expired'

                return (
                  <tr key={invitation.id}>
                    <td style={{ padding: '12px' }}>
                      {invitation.email_normalized}
                    </td>

                    <td style={{ padding: '12px' }}>
                      <div>
                        {invitation.role === 'admin'
                          ? 'Administrator'
                          : 'Zaposlenik'}
                      </div>

                      <small>
                        {invitation.employee_name ||
                          'Bez profila zaposlenika'}
                      </small>
                    </td>

                    <td style={{ padding: '12px' }}>
                      <div>
                        {statusLabels[invitation.status] ||
                          invitation.status}
                      </div>

                      {invitation.accepted_at && (
                        <small>
                          {formatDate(invitation.accepted_at)}
                        </small>
                      )}

                      {invitation.revoked_at && (
                        <small>
                          {formatDate(invitation.revoked_at)}
                        </small>
                      )}
                    </td>

                    <td style={{ padding: '12px' }}>
                      {formatDate(invitation.created_at)}
                    </td>

                    <td style={{ padding: '12px' }}>
                      {formatDate(invitation.expires_at)}
                    </td>

                    <td style={{ padding: '12px' }}>
                      {canRevoke ? (
                        <button
                          type="button"
                          disabled={
                            isLoading ||
                            revokingId !== null
                          }
                          onClick={() => revoke(invitation)}
                        >
                          {String(revokingId) ===
                          String(invitation.id)
                            ? 'Opozivanje…'
                            : 'Opozovi'}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {nextBeforeId && (
        <button
          type="button"
          onClick={loadMore}
          disabled={isLoading || revokingId !== null}
          style={{ marginTop: '16px' }}
        >
          Učitaj starije pozivnice
        </button>
      )}

      <p>
        Ako je kod izgubljen ili je pozivnica istekla,
        opozovite je i kreirajte novu. Opozivanje pozivnice
        ne uklanja već prihvaćeno članstvo.
      </p>
    </section>
  )
}

export default InvitationList