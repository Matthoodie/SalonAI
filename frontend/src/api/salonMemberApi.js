import { salonFetch } from './salonApiContext'

const errorMessages = {
  INSUFFICIENT_SALON_ROLE:
    'Nemate ovlasti za ovu radnju.',
  SALON_MEMBER_ACCESS_DENIED:
    'Nemate pristup članovima ovog salona.',
  SALON_ACCESS_DENIED:
    'Više nemate pristup odabranom salonu.',
  MEMBER_ACTOR_FORBIDDEN:
    'Vaše trenutačne ovlasti ne dopuštaju ovu promjenu.',
  MEMBER_OWNER_REQUIRED:
    'Samo vlasnik salona može upravljati administratorskim ovlastima.',
  MEMBER_SELF_CHANGE_FORBIDDEN:
    'Ovdje ne možete mijenjati vlastito članstvo.',
  MEMBER_OWNER_PROTECTED:
    'Članstvo vlasnika zaštićeno je od ove promjene.',
  MEMBER_EMPLOYEE_PROFILE_REQUIRED:
    'Administrator mora imati povezan profil zaposlenika prije promjene uloge u zaposlenika.',
  MEMBER_NOT_FOUND:
    'Članstvo nije pronađeno u ovom salonu.',
  MEMBER_SALON_UNAVAILABLE:
    'Salon trenutačno nije dostupan.',
  INVALID_MEMBER_ROLE:
    'Odabrana uloga nije dopuštena.',
  INVALID_MEMBER_ACTIVE:
    'Status članstva nije valjan.',
  INVALID_MEMBER_INPUT:
    'Podaci za promjenu članstva nisu valjani.',
}

async function readResponse(response) {
  const body = await response.json()

  if (!response.ok) {
    const code = body?.error?.code

    const error = new Error(
      errorMessages[code] ||
      'Zahtjev nije uspio. Osvježite popis i pokušajte ponovno.'
    )

    error.code = code || 'SALON_MEMBER_REQUEST_FAILED'
    error.statusCode = response.status

    throw error
  }

  return body.data
}

export async function fetchSalonMembers({ signal } = {}) {
  const response = await salonFetch('/api/members', {
    signal,
  })

  const data = await readResponse(response)

  if (!Array.isArray(data?.members)) {
    throw new Error('Poslužitelj nije vratio valjan popis članova.')
  }

  return data.members
}

function validateMembershipId(value) {
  if (
    !['number', 'string'].includes(typeof value) ||
    !/^[1-9]\d*$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value))
  ) {
    throw new Error('Identifikator članstva nije valjan.')
  }

  return String(value)
}

export async function updateSalonMemberRole(membershipId, role) {
  const id = validateMembershipId(membershipId)

  const response = await salonFetch(`/api/members/${id}/role`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role }),
  })

  return readResponse(response)
}

export async function updateSalonMemberActive(membershipId, active) {
  const id = validateMembershipId(membershipId)

  const response = await salonFetch(`/api/members/${id}/active`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ active }),
  })

  return readResponse(response)
}