import {useLanguage} from '../Language/LanguageProvider'
import {teamText,teamError,teamMemberQuestion} from '../Language/teamText.js'
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
  const {language}=useLanguage()
  const f=source=>teamText(language,source)

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

    const question = teamMemberQuestion(language, name, action, nextRole, nextActive)

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
    <section className="team-panel team-members">
      <div className="team-section-heading"><h2>{f("Članovi salona")}</h2>

      <button
        type="button"
        disabled={isLoading || busyId !== null}
        onClick={() => {
          setNotice('')
          setReloadToken((value) => value + 1)
        }}
      >{f("Osvježi članove")} </button></div>

      {error && <p role="alert">{teamError(language,error)}</p>}
      {notice && <p role="status">{f(notice)}</p>}

      {isLoading ? (
        <p role="status">{f("Učitavanje članova…")}</p>
      ) : members.length === 0 ? (
        !error && <p>{f("Nema članova za prikaz.")}</p>
      ) : (
        <div>
          <table className="team-table" role="table"
          >
            <thead role="rowgroup">
              <tr role="row">
                {[
                  'Korisnički račun',
                  'Uloga',
                  'Profil zaposlenika',
                  'Članstvo',
                  'Korisnički račun — status',
                  'Član od',
                  'Radnje',
                ].map((label) => (
                  <th role="columnheader" key={label} scope="col">
                    {f(label)}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody role="rowgroup">
              {members.map((member) => {
                const actions = getActions(member)
                const isBusy = busyId === String(member.id)

                return (
                  <tr role="row" key={member.id}>
                    <td role="cell"><span className="team-cell-label" aria-hidden="true">{f("Korisnički račun")}</span>
                      {member.display_name && (
                        <div>
                          <strong>{member.display_name}</strong>
                        </div>
                      )}

                      <div>{member.email}</div>
                    </td>

                    <td role="cell"><span className="team-cell-label" aria-hidden="true">{f("Uloga")}</span>
                      {f(roleLabels[member.role] || member.role)}
                    </td>

                    <td role="cell"><span className="team-cell-label" aria-hidden="true">{f("Profil zaposlenika")}</span>
                      {member.employee_id == null ? (
                        f('Bez profila zaposlenika')
                      ) : (
                        <>
                          <div>{member.employee_name}</div>
                          <small>
                            {member.employee_active
                              ? f('Aktivan profil')
                              : f('Neaktivan profil')}
                          </small>
                        </>
                      )}
                    </td>

                    <td role="cell"><span className="team-cell-label" aria-hidden="true">{f("Članstvo")}</span>
                      {member.membership_active
                        ? f('Aktivno')
                        : f('Neaktivno')}
                    </td>

                    <td role="cell"><span className="team-cell-label" aria-hidden="true">{f("Status računa")}</span>
                      {member.user_active
                        ? f('Aktivan')
                        : f('Neaktivan')}
                    </td>

                    <td role="cell"><span className="team-cell-label" aria-hidden="true">{f("Član od")}</span>
                      {new Date(
                        member.created_at
                      ).toLocaleDateString(language === 'en' ? 'en-GB' : 'hr-HR')}
                    </td>

                    <td role="cell"><span className="team-cell-label" aria-hidden="true">{f("Radnje")}</span>
                      <div>
                        {actions.canChangeRole && (
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => changeMember(member, 'role')}
                          >
                            {member.role === 'employee'
                              ? f('Dodijeli admin ulogu')
                              : f('Vrati u zaposlenika')}
                          </button>
                        )}

                        {actions.canChangeActive && (
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => changeMember(member, 'active')}
                          >
                            {member.membership_active
                              ? f('Deaktiviraj članstvo')
                              : f('Aktiviraj članstvo')}
                          </button>
                        )}

                        {!actions.canChangeRole &&
                          !actions.canChangeActive && '—'}

                        {hasActiveContext &&
                          currentRole === 'owner' &&
                          member.role === 'admin' &&
                          member.employee_id == null &&
                          String(member.user_id) !== String(currentUserId) && (
                            <small>{f("Za promjenu u zaposlenika potreban je povezan profil zaposlenika.")} </small>
                          )}

                        {isBusy && (
                          <small role="status">{f("Spremanje…")}</small>
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

      <p>{f("Članstvo određuje pristup ovom salonu. Korisnički račun i profil zaposlenika imaju zasebne statuse. Deaktivacija članstva ne briše postojeće termine.")} </p>
      <SalonMemberHistory
        refreshToken={`${refreshToken}:${reloadToken}`}
      />
    </section>
  )
}

export default SalonMemberList
