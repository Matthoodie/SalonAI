import PermissionHistory from '../../components/Settings/PermissionHistory'

import { useEffect, useRef, useState } from 'react'

import {
  fetchPermissionSettings,
  saveMemberPermission,
  savePermissionDelegation,
} from '../../api/permissionSettingsApi'

const permissionLabels = {
  'appointment.create': 'Kreiranje termina',
  'appointment.reschedule': 'Pomicanje termina',
  'appointment.change_status': 'Promjena statusa i otkazivanje',
  'appointment.change_client': 'Promjena klijenta na terminu',
}

const valueLabels = {
  deny: 'Zabranjeno',
  self: 'Vlastiti termini',
}


function wasCancelled(error) {
  return (
    error?.name === 'AbortError' ||
    error?.code === 'STALE_SALON_CONTEXT'
  )
}

function Settings({
  salonId,
  salonTimezone = 'Europe/Zagreb',
}) {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [drafts, setDrafts] = useState({})
  const [reloadToken, setReloadToken] = useState(0)

  const mountedRef = useRef(false)
  const busyRef = useRef(false)
  const pendingDraftsRef = useRef(null)

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const pending = pendingDraftsRef.current

    setIsLoading(true)
    setData(null)
    setError('')

    async function load() {
      try {
        const result = await fetchPermissionSettings({
          signal: controller.signal,
        })

        if (cancelled) {
          return
        }

        if (String(result.salon_id) !== String(salonId)) {
          throw new Error(
            'Postavke ne pripadaju odabranom salonu.'
          )
        }

        const sameSalon =
          pending &&
          String(pending.salonId) === String(salonId)

        const previousMember = sameSalon
          ? result.members.find(
              (member) =>
                String(member.id) === pending.memberId
            )
          : null

        const nextMember =
          previousMember || result.members[0] || null

        const retainedDrafts = {}
        let discardedCount = 0

        if (sameSalon) {
          for (const [key, choice] of Object.entries(
            pending.drafts
          )) {
            const permission = result.permissions.find(
              (item) => item.key === key
            )

            if (
              !previousMember ||
              permission?.can_edit !== true ||
              !['inherit', 'deny', 'self'].includes(choice)
            ) {
              discardedCount += 1
              continue
            }

            const stored =
              previousMember.overrides[key] ?? 'inherit'

            if (choice !== stored) {
              retainedDrafts[key] = choice
            }
          }
        }

        setData(result)
        setSelectedId(
          nextMember ? String(nextMember.id) : ''
        )
        setDrafts(retainedDrafts)
        pendingDraftsRef.current = null

        if (discardedCount > 0) {
          setNotice((current) =>
            [
              current,
              'Neki nespremljeni izbori uklonjeni su jer članstvo ili ovlast uređivanja više nisu dostupni.',
            ]
              .filter(Boolean)
              .join(' ')
          )
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
  }, [salonId, reloadToken])

  const selectedMember = data?.members.find(
    (member) => String(member.id) === selectedId
  )

  function storedChoice(key) {
    return selectedMember?.overrides[key] ?? 'inherit'
  }

  const hasUnsavedChanges = Object.keys(drafts).some(
    (key) => drafts[key] !== storedChoice(key)
  )

  function confirmDiscard() {
    return (
      !hasUnsavedChanges ||
      window.confirm('Odbaciti nespremljene izbore u ovom obrascu?')
    )
  }

  function rememberDrafts(savedKey = null) {
    // Ako prethodno učitavanje nije uspjelo, zadrži
    // već pripremljene izbore za ponovni pokušaj.
    if (!data) {
      return
    }

    const unsaved = {}

    for (const [key, choice] of Object.entries(drafts)) {
      if (
        key !== savedKey &&
        choice !== storedChoice(key)
      ) {
        unsaved[key] = choice
      }
    }

    pendingDraftsRef.current = {
      salonId: String(salonId),
      memberId: selectedId,
      drafts: unsaved,
    }
  }

  function refreshSettings() {
    if (busyRef.current || isLoading) {
      return
    }

    rememberDrafts()
    setNotice('')
    setIsLoading(true)
    setReloadToken((value) => value + 1)
  }

  async function runChange(
    operation,
    successMessage,
    savedKey = null
  ) {
    if (busyRef.current || isLoading) {
      return
    }

    busyRef.current = true
    setIsBusy(true)
    setError('')
    setNotice('')

    try {
      const result = await operation()

      if (!mountedRef.current) {
        return
      }

      rememberDrafts(savedKey)

      setNotice(
        result.changed
          ? successMessage
          : 'Postavka već ima odabranu vrijednost.'
      )

      // Ponovno učitaj stvarno spremljena pravila.
      // Ostali nespremljeni izbori čekaju u referenci.
      setIsLoading(true)
      setData(null)
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
        setIsBusy(false)
      }
    }
  }

  function savePermission(permission) {
    if (
      busyRef.current ||
      isLoading ||
      !selectedMember ||
      permission.can_edit !== true
    ) {
      return
    }

    const choice =
      drafts[permission.key] ?? storedChoice(permission.key)

    if (choice === storedChoice(permission.key)) {
      return
    }

    const label = permissionLabels[permission.key]
    const name =
      selectedMember.display_name || selectedMember.email

    const choiceLabel =
      choice === 'inherit'
        ? 'Naslijedi pravilo uloge'
        : valueLabels[choice]

    const question =
      `Spremiti "${label}: ${choiceLabel}" za ${name}?`

    if (!window.confirm(question)) {
      return
    }

    const membershipId = selectedMember.id

    runChange(
      () => saveMemberPermission({
        membershipId,
        permissionKey: permission.key,
        value: choice === 'inherit' ? null : choice,
      }),
      'Ovlast je spremljena. Ostali nespremljeni izbori ostaju u obrascu. Korisnik treba osvježiti svoju stranicu radi novog prikaza gumba.',
      permission.key
    )
  }

  function changeDelegation(permission) {
    if (
      busyRef.current ||
      isLoading ||
      data?.can_manage_delegation !== true
    ) {
      return
    }

    const enabled = !permission.admin_delegated
    const label = permissionLabels[permission.key]

    const question = enabled
      ? `Dopustiti administratorima ovog salona uređivanje postavke "${label}" za zaposlenike?`
      : `Ukinuti administratorima uređivanje postavke "${label}"? Već spremljene ovlasti zaposlenika ostat će nepromijenjene.`

    if (!window.confirm(question)) {
      return
    }

    runChange(
      () => savePermissionDelegation({
        permissionKey: permission.key,
        enabled,
      }),
      'Delegacija administratorima je spremljena.'
    )
  }

  return (
    <div className="salon-permission-settings">
      <h2 className="settings-section-title">Upravljanje ovlastima</h2>

      <p>
        Operativne ovlasti zaposlenika u odabranom salonu.
        Promjene ovdje ne dodjeljuju administratorsku ulogu.
      </p>

      <button
        type="button"
        onClick={refreshSettings}
        disabled={isLoading || isBusy}
        style={{ marginBottom: '16px' }}
      >
        Osvježi postavke
      </button>

      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {isLoading && <p role="status">Učitavanje postavki…</p>}
      {isBusy && <p role="status">Spremanje…</p>}

      {!isLoading && data && (
        <>
          <section className="settings-panel">
            <h3>Ovlasti zaposlenika</h3>

            <p>
              „Naslijedi pravilo uloge” koristi zajedničko pravilo
              zaposleničke uloge. „Vlastiti termini” dopušta radnju
              samo na terminima tog zaposlenika.
            </p>

            {data.members.length === 0 ? (
              <p>Nema aktivnih zaposleničkih članstava za podešavanje.</p>
            ) : (
              <>
                <label htmlFor="permission-member">
                  Zaposlenik
                </label>

                <select
                  id="permission-member"
                  value={selectedId}
                  disabled={isBusy}
                  style={{
                    display: 'block',
                    maxWidth: '100%',
                    marginTop: '8px',
                    marginBottom: '16px',
                  }}
                  onChange={(event) => {
                    if (!confirmDiscard()) {
                      return
                    }

                    pendingDraftsRef.current = null
                    setSelectedId(event.target.value)
                    setDrafts({})
                    setError('')
                    setNotice('')
                  }}
                >
                  {data.members.map((member) => (
                    <option key={member.id} value={String(member.id)}>
                      {member.employee_name || member.display_name || member.email}
                      {' — '}
                      {member.email}
                    </option>
                  ))}
                </select>

                {selectedMember && (
                  <>
                    {(!selectedMember.user_active ||
                      !selectedMember.employee_active) && (
                      <p>
                        Račun ili profil zaposlenika nije aktivan.
                        Spremanje ovlasti ne mijenja njihove statuse.
                      </p>
                    )}

                    <div className="permission-cards">
                      {data.permissions.map((permission) => {
                        const key = permission.key
                        const choice = drafts[key] ?? storedChoice(key)
                        const changed = choice !== storedChoice(key)
                        return (
                          <article className="permission-card" key={key}>
                            <h4>{permissionLabels[key] || key}</h4>
                            <dl className="permission-values">
                              <div><dt>Pravilo uloge</dt><dd>{valueLabels[permission.inherited_value]}</dd></div>
                              <div><dt>Trenutačno spremljeno</dt><dd>{valueLabels[selectedMember.effective_permissions[key]]}</dd></div>
                            </dl>
                            <div className="permission-choice">
                              <span className="field-caption">Pojedinačna postavka</span>
                                  <select
                                    aria-label={`Ovlast: ${permissionLabels[key]}`}
                                    value={choice}
                                    disabled={
                                      isBusy ||
                                      permission.can_edit !== true
                                    }
                                    onChange={(event) => {
                                      const value = event.target.value
                                      setDrafts((current) => ({
                                        ...current,
                                        [key]: value,
                                      }))
                                    }}
                                  >
                                    <option value="inherit">
                                      Naslijedi pravilo uloge
                                    </option>
                                    <option value="deny">Zabranjeno</option>
                                    <option value="self">Vlastiti termini</option>
                                  </select>

                                  {changed && <div><small>Nespremljen izbor</small></div>}
                            </div>
                            <div className="permission-save">
                                  {permission.can_edit === true ? (
                                    <button
                                      type="button"
                                      disabled={isBusy || !changed}
                                      onClick={() => savePermission(permission)}
                                    >
                                      Spremi
                                    </button>
                                  ) : (
                                    <small>Uređivanje nije delegirano.</small>
                                  )}
                            </div>
                          </article>
                        )
                      })}
                    </div>
                    <details className="settings-help">
                      <summary>Kako se spremaju promjene?</summary>
                      <p>Svaka ovlast sprema se zasebno. Spremanje i osvježavanje postavki čuvaju druge nespremljene izbore dok ih smijete uređivati. Osvježavanje cijele stranice i promjena salona odbacuju nespremljene izbore.</p>
                    </details>
                  </>
                )}
              </>
            )}
          </section>

          {data.can_manage_delegation === true && (
            <section className="settings-panel">
              <h3>Delegacija administratorima</h3>

              <p>
                Odaberite koje postavke administratori smiju uređivati
                za zaposlenike. Ovo pravilo vrijedi za administratore
                ovog salona. Oni ne mogu mijenjati ovu delegaciju.
              </p>

              {data.permissions.map((permission) => (
                <div key={permission.key} className="delegation-row">
                  <strong>
                    {permissionLabels[permission.key]}
                  </strong>

                  <span>
                    {permission.admin_delegated
                      ? 'Delegirano administratorima'
                      : 'Uređuje samo vlasnik'}
                  </span>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => changeDelegation(permission)}
                  >
                    {permission.admin_delegated
                      ? 'Ukini delegaciju'
                      : 'Dopusti administratorima'}
                  </button>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      <PermissionHistory
        refreshToken={reloadToken}
        salonTimezone={salonTimezone}
      />
    </div>
  )
}

export default Settings
