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

const sectionStyle = {
  padding: '20px',
  border: '1px solid #d1d5db',
  borderRadius: '12px',
  marginBottom: '20px',
}

const cellStyle = {
  padding: '12px',
  borderBottom: '1px solid #e5e7eb',
  textAlign: 'left',
  verticalAlign: 'top',
}

function wasCancelled(error) {
  return (
    error?.name === 'AbortError' ||
    error?.code === 'STALE_SALON_CONTEXT'
  )
}

function Settings({ salonId }) {
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
    setData(null)
    setDrafts({})
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
          throw new Error('Postavke ne pripadaju odabranom salonu.')
        }

        setData(result)

        setSelectedId((current) =>
          result.members.some(
            (member) => String(member.id) === current
          )
            ? current
            : result.members[0]
              ? String(result.members[0].id)
              : ''
        )
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

  function refreshSettings() {
    if (busyRef.current || isLoading || !confirmDiscard()) {
      return
    }

    setNotice('')
    setReloadToken((value) => value + 1)
  }

  async function runChange(operation, successMessage) {
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

      setNotice(
        result.changed
          ? successMessage
          : 'Postavka već ima odabranu vrijednost.'
      )

      // Remove the old view before reloading authoritative values.
      setData(null)
      setDrafts({})
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

    const otherUnsaved = Object.keys(drafts).some(
      (key) =>
        key !== permission.key &&
        drafts[key] !== storedChoice(key)
    )

    const label = permissionLabels[permission.key]
    const name =
      selectedMember.display_name || selectedMember.email

    const choiceLabel =
      choice === 'inherit'
        ? 'Naslijedi pravilo uloge'
        : valueLabels[choice]

    const question =
      `Spremiti "${label}: ${choiceLabel}" za ${name}?` +
      (
        otherUnsaved
          ? '\nOstali nespremljeni izbori bit će odbačeni nakon osvježavanja.'
          : ''
      )

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
      'Ovlast je spremljena. Korisnik treba osvježiti svoju stranicu radi novog prikaza gumba.'
    )
  }

  function changeDelegation(permission) {
    if (
      busyRef.current ||
      data?.can_manage_delegation !== true ||
      !confirmDiscard()
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
    <div style={{ maxWidth: '1100px' }}>
      <h1>Postavke</h1>

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
          <section style={sectionStyle}>
            <h2>Ovlasti zaposlenika</h2>

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

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                      }}>
                        <thead>
                          <tr>
                            {[
                              'Radnja',
                              'Pravilo uloge',
                              'Pojedinačna postavka',
                              'Spremljeno rezultirajuće pravilo',
                              'Spremanje',
                            ].map((label) => (
                              <th key={label} scope="col" style={cellStyle}>
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>

                        <tbody>
                          {data.permissions.map((permission) => {
                            const key = permission.key
                            const choice = drafts[key] ?? storedChoice(key)
                            const changed = choice !== storedChoice(key)

                            return (
                              <tr key={key}>
                                <th scope="row" style={cellStyle}>
                                  {permissionLabels[key] || key}
                                </th>

                                <td style={cellStyle}>
                                  {valueLabels[permission.inherited_value]}
                                </td>

                                <td style={cellStyle}>
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
                                </td>

                                <td style={cellStyle}>
                                  {valueLabels[
                                    selectedMember.effective_permissions[key]
                                  ]}
                                </td>

                                <td style={cellStyle}>
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
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    <p>
                      Svaki redak sprema se zasebno.
                      Rezultirajuće pravilo prikazuje stanje spremljeno na poslužitelju.
                    </p>
                  </>
                )}
              </>
            )}
          </section>

          {data.can_manage_delegation === true && (
            <section style={sectionStyle}>
              <h2>Delegacija administratorima</h2>

              <p>
                Odaberite koje postavke administratori smiju uređivati
                za zaposlenike. Ovo pravilo vrijedi za administratore
                ovog salona. Oni ne mogu mijenjati ovu delegaciju.
              </p>

              {data.permissions.map((permission) => (
                <div
                  key={permission.key}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 0',
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
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
    </div>
  )
}

export default Settings