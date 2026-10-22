import { salonFetch } from './salonApiContext'

const invitationMessages = {
  INVITATION_ALREADY_OPEN:
    'Za ovaj e-mail ili profil već postoji otvorena pozivnica. Prije ponovnog pozivanja potrebno ju je opozvati.',

  EMPLOYEE_ALREADY_LINKED:
    'Ovaj profil zaposlenika već je povezan s korisničkim računom.',

  INVITATION_EMPLOYEE_UNAVAILABLE:
    'Odabrani profil zaposlenika nije dostupan.',

  INVITATION_UNAVAILABLE:
    'Pozivnica nije dostupna. Možda je istekla, opozvana ili već iskorištena.',

  INVALID_INVITATION_TOKEN:
    'Kod pozivnice nije ispravan.',

  INVITATION_EMAIL_MISMATCH:
    'Pozivnica je namijenjena drugoj e-mail adresi. Prijavite se računom s adresom na koju ste pozvani.',

  INVITATION_VERIFIED_EMAIL_REQUIRED:
    'Prije prihvaćanja potvrdite svoju primarnu e-mail adresu u korisničkom računu.',

  INVITATION_ISSUER_UNAUTHORIZED:
    'Pošiljatelj više nema potrebne ovlasti ili vi nemate ovlast upravljanja pozivnicama.',

  SALON_MEMBERSHIP_ALREADY_EXISTS:
    'Vaš račun već ima članstvo u ovom salonu. Za promjenu postojećeg pristupa obratite se administratoru.',

  INVITATION_ALREADY_ACCEPTED:
    'Pozivnica je već prihvaćena i ne može se opozvati.',

  INVITATION_SALON_UNAVAILABLE:
    'Salon trenutačno nije dostupan.',

  INSUFFICIENT_SALON_ROLE:
    'Nemate ovlast upravljanja pozivnicama.',

  UNAUTHENTICATED:
    'Potrebna je ponovna prijava.',
}

async function readResponse(response, fallbackMessage) {
  const body = await response.json()

  if (!response.ok) {
    const code = body?.error?.code

    const error = new Error(
      invitationMessages[code] ||
        body?.error?.message ||
        fallbackMessage
    )

    error.code = code || 'INVITATION_REQUEST_FAILED'
    error.statusCode = response.status

    throw error
  }

  return body.data
}

export async function createInvitation(payload) {
  const response = await salonFetch('/api/invitations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return readResponse(
    response,
    'Pozivnicu nije moguće kreirati.'
  )
}

export async function revokeInvitation(invitationId) {
  if (!/^[1-9]\d*$/.test(String(invitationId))) {
    throw new Error('Neispravna oznaka pozivnice.')
  }

  const response = await salonFetch(
    `/api/invitations/${invitationId}/revoke`,
    {
      method: 'POST',
    }
  )

  return readResponse(
    response,
    'Pozivnicu nije moguće opozvati.'
  )
}

export async function acceptInvitation(token) {
  // Prihvaćanje pripada prijavljenom korisniku,
  // ne trenutačno odabranom salonu.
  const response = await fetch('/api/invitations/accept', {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  })

  return readResponse(
    response,
    'Pozivnicu nije moguće prihvatiti.'
  )
}

export async function fetchInvitations({
  beforeId,
  signal,
} = {}) {
  const query = beforeId
    ? `?before_id=${encodeURIComponent(beforeId)}`
    : ''

  const response = await salonFetch(
    `/api/invitations${query}`,
    { signal }
  )

  return readResponse(
    response,
    'Pozivnice nije moguće učitati.'
  )
}