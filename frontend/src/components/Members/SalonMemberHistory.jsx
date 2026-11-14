import {useLanguage} from '../Language/LanguageProvider'
import {teamText,teamError} from '../Language/teamText.js'
import { useEffect, useRef, useState } from 'react'

import {
  fetchSalonMemberHistory,
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

function personLabel(name, email, userId, language) {
  if (name && email) {
    return `${name} (${email})`
  }

  return name || email || `${language==='en'?'User':'Korisnik'} #${userId}`
}

function describeChange(change, language) {
  const f=source=>teamText(language,source)
  if (change.action === 'role') {
    const before = roleLabels[change.old_role] || change.old_role
    const after = roleLabels[change.new_role] || change.new_role

    return `${f(before)} → ${f(after)}`
  }

  const before = change.old_active ? 'Aktivno' : 'Neaktivno'
  const after = change.new_active ? 'Aktivno' : 'Neaktivno'

  return `${f(before)} → ${f(after)}`
}

function SalonMemberHistory({ refreshToken = 0 }) {
  const {language}=useLanguage()
  const f=source=>teamText(language,source)

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

    setIsLoadingMore(false)
    setChanges([])
    setNextBeforeId(null)
    setError('')
    setIsLoading(isOpen)

    if (isOpen) {
      async function load() {
        try {
          const result = await fetchSalonMemberHistory({
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
      const result = await fetchSalonMemberHistory({
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
    <details className="team-history"
      open={isOpen}
      onToggle={(event) => {
        setIsOpen(event.currentTarget.open)
      }}
    >
      <summary>{f("Povijest promjena članstava")} </summary>

      {isOpen && (
        <div>
          <p>{f("Evidencija promjena uloga i aktivnosti članstava. Najnovije promjene prikazane su prve.")} </p>

          <button
            type="button"
            disabled={isLoading || isLoadingMore}
            onClick={() => {
              setReloadToken((value) => value + 1)
            }}
          >{f("Osvježi povijest")} </button>

          {error && <p role="alert">{teamError(language,error)}</p>}

          {isLoading ? (
            <p role="status">{f("Učitavanje povijesti…")}</p>
          ) : changes.length === 0 ? (
            !error && <p>{f("Još nema zabilježenih promjena članstava.")}</p>
          ) : (
            <>
              <div
              >
                <table className="team-table" role="table"
                >
                  <thead role="rowgroup">
                    <tr role="row">
                      {[
                        'Vrijeme',
                        'Izvršitelj',
                        'Član',
                        'Radnja',
                        'Promjena',
                      ].map((label) => (
                        <th role="columnheader"
                          key={label}
                          scope="col"

                        >
                          {f(label)}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody role="rowgroup">
                    {changes.map((change) => (
                      <tr role="row" key={change.id}>
                        <td role="cell"><span className="team-cell-label" aria-hidden="true">{f("Vrijeme")}</span>
                          {new Date(
                            change.created_at
                          ).toLocaleString(language === 'en' ? 'en-GB' : 'hr-HR', {
                            timeZone: 'Europe/Zagreb',
                          })}
                        </td>

                        <td role="cell"><span className="team-cell-label" aria-hidden="true">{f("Izvršitelj")}</span>
                          <div>
                            {personLabel(
                              change.actor_display_name,
                              change.actor_email,
                              change.actor_user_id, language
                            )}
                          </div>

                          <small>{f("Uloga pri promjeni:")}{' '}
                            {f(roleLabels[change.actor_role] || change.actor_role)}
                          </small>
                        </td>

                        <td role="cell"><span className="team-cell-label" aria-hidden="true">{f("Član")}</span>
                          {personLabel(
                            change.target_display_name,
                            change.target_email,
                            change.target_user_id, language
                          )}
                        </td>

                        <td role="cell"><span className="team-cell-label" aria-hidden="true">{f("Radnja")}</span>
                          {change.action === 'role'
                            ? f('Promjena uloge')
                            : f('Promjena aktivnosti članstva')}
                        </td>

                        <td role="cell"><span className="team-cell-label" aria-hidden="true">{f("Promjena")}</span>
                          {describeChange(change, language)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {nextBeforeId !== null && (
                <button
                  type="button"
                  disabled={isLoadingMore}
                  onClick={loadMore}
                >
                  {isLoadingMore
                    ? f('Učitavanje…')
                    : f('Učitaj starije promjene')}
                </button>
              )}
            </>
          )}

          <p>{f("Vrijeme je prikazano za Europe/Zagreb. Imena i e-mail adrese odgovaraju trenutačnim podacima računa; uloga izvršitelja i promjena stanja zabilježene su u trenutku radnje.")} </p>
        </div>
      )}
    </details>
  )
}

export default SalonMemberHistory
