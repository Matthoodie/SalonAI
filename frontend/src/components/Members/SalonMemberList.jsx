import { useEffect, useState } from 'react'

import {
  fetchSalonMembers,
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

function SalonMemberList({ refreshToken = 0 }) {
  const [members, setMembers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

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
        if (
          !cancelled &&
          requestError?.name !== 'AbortError' &&
          requestError?.code !== 'STALE_SALON_CONTEXT'
        ) {
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

  return (
    <section
      aria-labelledby="salon-members-title"
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
        <h2 id="salon-members-title">Članovi salona</h2>

        <button
          type="button"
          disabled={isLoading}
          onClick={() =>
            setReloadToken((value) => value + 1)
          }
        >
          Osvježi članove
        </button>
      </div>

      <p>
        Korisnički računi povezani s ovim salonom.
        Pozivnica se pretvara u članstvo nakon prihvaćanja.
      </p>

      {isLoading && (
        <p role="status">Učitavanje članova…</p>
      )}

      {error && <p role="alert">{error}</p>}

      {!isLoading && !error && members.length === 0 && (
        <p>Nema članova za prikaz.</p>
      )}

      {members.length > 0 && (
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
                  'Korisnički račun',
                  'Uloga',
                  'Profil zaposlenika',
                  'Članstvo',
                  'Korisnički račun — status',
                  'Član od',
                ].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    style={cellStyle}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {members.map((member) => (
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
                    {member.employee_id === null ? (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p>
        Status članstva odnosi se na ovaj salon.
        Status korisničkog računa odnosi se na račun u aplikaciji.
        Profil zaposlenika ima zaseban status.
      </p>
    </section>
  )
}

export default SalonMemberList