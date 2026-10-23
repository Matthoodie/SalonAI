import { salonFetch } from './salonApiContext'

export async function fetchSalonMembers({ signal } = {}) {
  const response = await salonFetch('/api/members', {
    signal,
  })

  const body = await response.json()

  if (!response.ok) {
    const code = body?.error?.code

    const accessDenied = [
      'INSUFFICIENT_SALON_ROLE',
      'SALON_MEMBER_ACCESS_DENIED',
      'SALON_ACCESS_DENIED',
    ].includes(code)

    const error = new Error(
      accessDenied
        ? 'Nemate pristup pregledu članova ovog salona.'
        : body?.error?.message ||
          'Članove salona nije moguće učitati.'
    )

    error.code = code || 'SALON_MEMBERS_LOAD_FAILED'
    error.statusCode = response.status

    throw error
  }

  if (!Array.isArray(body?.data?.members)) {
    throw new Error(
      'Poslužitelj nije vratio valjan popis članova.'
    )
  }

  return body.data.members
}