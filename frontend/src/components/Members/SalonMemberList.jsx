import SalonMemberHistory from './SalonMemberHistory'

import { useEffect, useRef, useState } from 'react'

import {
  fetchSalonMembers,
  updateSalonMemberRole,
  updateSalonMemberActive,
} from '../../api/salonMemberApi'

const roleLabels = {
  owner: 'Vlasnik',
  admin: 'Administrator',
  employee: 'Zaposlenik',
}

const cellStyle = {
  padding: '12px',
  borderBottom: '1px solid #e5e7eb',
  verticalAlign: 'top',
}

function wasCancelled(error) {
  return (
    error?.name === 'AbortError' ||
    error?.code === 'STALE_SALON_CONTEXT'
  )
}

function SalonMemberList({
  refreshToken = 0,
  managementContext = null,
}) {
  const [members, setMembers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const mountedRef = useRef(false)
  const busyRef = useRef(false)

  const currentUserId = managementContext?.user?.id
  const currentRole = managementContext?.membership?.role

  const hasActiveContext =
    managementContext?.user?.active === true &&
    managementContext?.membership?.active === true &&
    managementContext?.current_salon?.active === true &&
    currentUserId !== undefined &&
    currentUserId !== null

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    setIsLoading(true)
    setError('')
    setMembers([])

    async function load() {
      try {
        const result = await fetchSalonMembers({
          signal: controller.signal,
        })

        if (!cancelled) {
          setMembers(result)
        }
      } catch (requestError) {
        if (!cancelled && !wasCancelled(requestError)) {
          setError(requestError.message)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [refreshToken, reloadToken])

  function getActions(member) {
    const sameSalon =
      String(member.salon_id) ===
      String(managementContext?.current_salon?.id)

    const isSelf =
      String(member.user_id) === String(currentUserId)

    const protectedMember =
      !hasActiveContext ||
      !sameSalon ||
      isSelf ||
      member.role === 'owner' ||
      !['employee', 'admin'].includes(member.role)

    if (protectedMember) {
      return {
        canChangeRole: false,
        canChangeActive: false,
      }
    }

    return {
      canChangeRole:
        currentRole === 'owner' &&
        (
          member.role === 'employee' ||
          member.employee_id != null
        ),

      canChangeActive:
        currentRole === 'owner' ||
        (
          currentRole === 'admin' &&
          member.role === 'employee'
        ),
    }
  }

  async function changeMember(member, action) {
    if (busyRef.current || isLoading) {
      return
    }

    const permissions = getActions(member)

    if (
      (action === 'role' && !permissions.canChangeRole) ||
      (action === 'active' && !permissions.canChangeActive)
    ) {
      return
    }

    const name = member.display_name || member.email
    const nextRole =
      member.role === 'employee' ? 'admin' : 'employee'
    const nextActive = !member.membership_active

    const question =
      action === 'role'
        ? nextRole === 'admin'
          ? `Dodijeliti administratorsku ulogu korisniku ${name}? Dobit će administratorski pristup ovom salonu.`
          : `Vratiti korisnika ${name} u ulogu zaposlenika? Izgubit će administratorske ovlasti u ovom salonu.`
        : nextActive
          ? `Ponovno aktivirati članstvo korisnika ${name}? Status njegova korisničkog računa i profila zaposlenika ostaje nepromijenjen.`
          : `Deaktivirati članstvo korisnika ${name}? Izgubit će pristup ovom salonu. Profil zaposlenika i postojeći termini ostaju sačuvani.`

    if (!window.confirm(question)) {
      return
    }

    busyRef.current = true
    setBusyId(String(member.id))
    setError('')
    setNotice('')

    try {
      const result =
        action === 'role'
          ? await updateSalonMemberRole(member.id, nextRole)
          : await updateSalonMemberActive(member.id, nextActive)

      if (!mountedRef.current) {
        return
      }

      setNotice(
        result.changed
          ? 'Promjena članstva je spremljena.'
          : 'Članstvo već ima odabrano stanje.'
      )

      setReloadToken((value) => value + 1)
    } catch (requestError) {
      if (
        mountedRef.current &&
        !wasCancelled(requestError)
      ) {
        setError(requestError.message)
      }
    } finally {
      busyRef.current = false

      if (mountedRef.current) {
        setBusyId(null)
      }
    }
  }

  return (
    <section style={{ marginBottom: '24px' }}>
      <h2>Članovi salona</h2>

      <button
        type="button"
        disabled={isLoading || busyId !== null}
        onClick={() => {
          setNotice('')
          setReloadToken((value) => value + 1)
        }}
      >
        Osvježi članove
      </button>

      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}

      {isLoading ? (
        <p role="status">Učitavanje članova…</p>
      ) : members.length === 0 ? (
        !error && <p>Nema članova za prikaz.</p>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: '12px' }}>
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
                  'Korisnički račun',
                  'Uloga',
                  'Profil zaposlenika',
                  'Članstvo',
                  'Korisnički račun — status',
                  'Član od',
                  'Radnje',
                ].map((label) => (
                  <th key={label} scope="col" style={cellStyle}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {members.map((member) => {
                const actions = getActions(member)
                const isBusy = busyId === String(member.id)

                return (
                  <tr key={member.id}>
                    <td style={cellStyle}>
                      {member.display_name && (
                        <div>
                          <strong>{member.display_name}</strong>
                        </div>
                      )}

                      <div>{member.email}</div>
                    </td>

                    <td style={cellStyle}>
                      {roleLabels[member.role] || member.role}
                    </td>

                    <td style={cellStyle}>
                      {member.employee_id == null ? (
                        'Bez profila zaposlenika'
                      ) : (
                        <>
                          <div>{member.employee_name}</div>
                          <small>
                            {member.employee_active
                              ? 'Aktivan profil'
                              : 'Neaktivan profil'}
                          </small>
                        </>
                      )}
                    </td>

                    <td style={cellStyle}>
                      {member.membership_active
                        ? 'Aktivno'
                        : 'Neaktivno'}
                    </td>

                    <td style={cellStyle}>
                      {member.user_active
                        ? 'Aktivan'
                        : 'Neaktivan'}
                    </td>

                    <td style={cellStyle}>
                      {new Date(
                        member.created_at
                      ).toLocaleDateString('hr-HR')}
                    </td>

                    <td style={cellStyle}>
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {actions.canChangeRole && (
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => changeMember(member, 'role')}
                          >
                            {member.role === 'employee'
                              ? 'Dodijeli admin ulogu'
                              : 'Vrati u zaposlenika'}
                          </button>
                        )}

                        {actions.canChangeActive && (
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => changeMember(member, 'active')}
                          >
                            {member.membership_active
                              ? 'Deaktiviraj članstvo'
                              : 'Aktiviraj članstvo'}
                          </button>
                        )}

                        {!actions.canChangeRole &&
                          !actions.canChangeActive && '—'}

                        {hasActiveContext &&
                          currentRole === 'owner' &&
                          member.role === 'admin' &&
                          member.employee_id == null &&
                          String(member.user_id) !== String(currentUserId) && (
                            <small>
                              Za promjenu u zaposlenika potreban je
                              povezan profil zaposlenika.
                            </small>
                          )}

                        {isBusy && (
                          <small role="status">Spremanje…</small>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p>
        Članstvo određuje pristup ovom salonu. Korisnički račun
        i profil zaposlenika imaju zasebne statuse.
        Deaktivacija članstva ne briše postojeće termine.
      </p>
      <SalonMemberHistory
        refreshToken={`${refreshToken}:${reloadToken}`}
      />
    </section>
  )
}

export default SalonMemberList