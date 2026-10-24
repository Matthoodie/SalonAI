import { salonFetch } from './salonApiContext'

const messages = {
  INSUFFICIENT_SALON_ROLE:
    'Nemate ovlasti za ovu radnju.',
  SALON_ACCESS_DENIED:
    'Više nemate pristup odabranom salonu.',
  PERMISSION_MANAGEMENT_FORBIDDEN:
    'Vaše trenutačno članstvo ne dopušta upravljanje ovlastima.',
  PERMISSION_ADMIN_DELEGATION_REQUIRED:
    'Vlasnik nije dopustio administratorima uređivanje ove postavke.',
  PERMISSION_DELEGATION_OWNER_REQUIRED:
    'Samo vlasnik može mijenjati delegaciju administratorima.',
  PERMISSION_SELF_CHANGE_FORBIDDEN:
    'Ovdje ne možete mijenjati vlastite ovlasti.',
  PERMISSION_TARGET_NOT_FOUND:
    'Članstvo nije pronađeno u odabranom salonu.',
  PERMISSION_TARGET_NOT_EMPLOYEE:
    'Postavke su dostupne samo za aktivno zaposleničko članstvo.',
  PERMISSION_SALON_UNAVAILABLE:
    'Salon trenutačno nije dostupan.',
  PERMISSION_KEY_NOT_MANAGEABLE:
    'Ovom postavkom nije moguće upravljati ovdje.',
  INVALID_MEMBER_PERMISSION_VALUE:
    'Odabrana vrijednost ovlasti nije valjana.',
  INVALID_PERMISSION_DELEGATION_VALUE:
    'Vrijednost delegacije nije valjana.',
  INVALID_PERMISSION_MANAGEMENT_INPUT:
    'Podaci zahtjeva nisu valjani.',
  INVALID_SALON_PERMISSION_OVERRIDE:
    'Pravilo uloge nije valjano. Postavke nije moguće učitati.',
}

async function readResponse(response) {
  const body = await response.json()

  if (!response.ok) {
    const code = body?.error?.code

    const error = new Error(
      messages[code] ||
      'Zahtjev nije uspio. Osvježite postavke i pokušajte ponovno.'
    )

    error.code = code
    error.statusCode = response.status

    throw error
  }

  return body.data
}

export async function fetchPermissionSettings({ signal } = {}) {
  const response = await salonFetch(
    '/api/members/permission-settings',
    { signal }
  )

  const data = await readResponse(response)

  if (
    !Array.isArray(data?.permissions) ||
    !Array.isArray(data?.members)
  ) {
    throw new Error('Poslužitelj nije vratio valjane postavke.')
  }

  return data
}

export async function saveMemberPermission({
  membershipId,
  permissionKey,
  value,
}) {
  if (
    !['string', 'number'].includes(typeof membershipId) ||
    !/^[1-9]\d*$/.test(String(membershipId)) ||
    !Number.isSafeInteger(Number(membershipId))
  ) {
    throw new Error('Identifikator članstva nije valjan.')
  }

  const response = await salonFetch(
    `/api/members/${membershipId}/permissions`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        permission_key: permissionKey,
        value,
      }),
    }
  )

  return readResponse(response)
}

export async function savePermissionDelegation({
  permissionKey,
  enabled,
}) {
  const response = await salonFetch(
    '/api/members/permission-delegations',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        permission_key: permissionKey,
        enabled,
      }),
    }
  )

  return readResponse(response)
}