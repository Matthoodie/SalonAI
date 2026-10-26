import { salonFetch } from './salonApiContext.js'

const messages = {
  BLOCKED_TIME_CANCELLATION_NOTE_REQUIRED: 'Unesite razlog otkazivanja.',
  BLOCKED_TIME_CANCEL_FORBIDDEN: 'Više nemate ovlast za otkazivanje odobrene blokade.',
  BLOCKED_TIME_SELF_CANCEL_FORBIDDEN: 'Vlastitu odobrenu blokadu mora otkazati drugi ovlašteni član.',
  BLOCKED_TIME_REQUEST_NOT_APPROVED: 'Zahtjev više nije odobren. Osvježite popis.',
  BLOCKED_TIME_SOURCE_INCONSISTENT: 'Povezana blokada nije pronađena. Otkazivanje nije spremljeno; potrebna je provjera podataka.',
  BLOCKED_TIME_ABSENCE_CONFLICT: 'Razdoblje se preklapa s odsutnošću zaposlenika. Zahtjev ostaje na čekanju.',
  BLOCKED_TIME_INVALID_INPUT: 'Provjerite datum, vrijeme, vrstu blokade i duljinu napomene.',
  BLOCKED_TIME_AUTH_REQUIRED: 'Prijavite se ponovno.',
  BLOCKED_TIME_SALON_CONTEXT_REQUIRED: 'Ponovno odaberite salon.',
  BLOCKED_TIME_ACTOR_FORBIDDEN: 'Vaše članstvo više ne dopušta pristup. Osvježite aplikaciju.',
  BLOCKED_TIME_SALON_UNAVAILABLE: 'Salon trenutačno nije dostupan.',
  SALON_ACCESS_DENIED: 'Više nemate pristup odabranom salonu.',
  SALON_PERMISSION_DENIED: 'Nemate dopuštenje za slanje zahtjeva za blokirano vrijeme.',
  BLOCKED_TIME_EMPLOYEE_REQUIRED: 'Za slanje zahtjeva potreban je povezan profil zaposlenika.',
  BLOCKED_TIME_EMPLOYEE_UNAVAILABLE: 'Vaš profil zaposlenika nije aktivan ili više nije dostupan.',
  BLOCKED_TIME_REQUEST_DUPLICATE: 'Za isto razdoblje već postoji zahtjev na čekanju. Provjerite popis.',
  BLOCKED_TIME_REQUEST_NOT_FOUND: 'Zahtjev nije pronađen ili mu nemate pristup.',
  BLOCKED_TIME_REQUEST_NOT_PENDING: 'O zahtjevu je već odlučeno ili je povučen. Popis treba osvježiti.',
  BLOCKED_TIME_REVIEW_FORBIDDEN: 'Više nemate ovlast za odlučivanje o zahtjevima.',
  BLOCKED_TIME_SELF_REVIEW_FORBIDDEN: 'Ne možete odlučivati o vlastitom zahtjevu.',
  BLOCKED_TIME_REQUESTER_UNAVAILABLE: 'Podnositelj ili njegov profil više nije aktivan ili ispravno povezan. Zahtjev nije odobren.',
  BLOCKED_TIME_EXISTING_ABSENCE_CONFLICT: 'Razdoblje se preklapa s postojećom blokadom. Zahtjev ostaje na čekanju.',
  EMPLOYEE_BLOCKED_TIME_APPOINTMENT_CONFLICT: 'Zaposlenik u tom razdoblju ima aktivan termin. Najprije premjestite ili otkažite termin; zahtjev ostaje na čekanju.',
}

export function wasBlockedTimeRequestCancelled(error) {
  return error?.name === 'AbortError' || error?.code === 'STALE_SALON_CONTEXT'
}

function validId(value) {
  return ['string', 'number'].includes(typeof value) && /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value))
}

function requestId(value) {
  if (!validId(value)) throw new Error('Identifikator zahtjeva nije valjan.')
  return encodeURIComponent(String(value))
}

// Dependency injection permits isolated tests of transport and salon switching.
export function createBlockedTimeRequestApi({ request = salonFetch } = {}) {
  async function send(path, options = {}) {
    let response
    try {
      response = await request(path, options)
    } catch (error) {
      if (wasBlockedTimeRequestCancelled(error)) throw error
      throw Object.assign(new Error('Veza s poslužiteljem nije uspjela. Osvježite popis i provjerite stanje prije ponavljanja radnje.'), { code: 'BLOCKED_TIME_NETWORK_ERROR' })
    }
    let body
    try { body = await response.json() } catch (error) {
      if (wasBlockedTimeRequestCancelled(error)) throw error
      throw Object.assign(new Error('Odgovor poslužitelja nije moguće pročitati. Osvježite popis prije ponavljanja radnje.'), { code: 'BLOCKED_TIME_RESPONSE_INVALID', statusCode: response.status })
    }
    if (!response.ok) {
      const code = body?.error?.code
      throw Object.assign(new Error(messages[code] || 'Zahtjev nije uspio. Osvježite popis i pokušajte ponovno.'), { code, statusCode: response.status })
    }
    return body
  }

  function write(path, body, signal) {
    return send(path, { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  }

  return {
    async list({ status = '', beforeId = null, signal } = {}) {
      if (status && !['pending', 'approved', 'rejected', 'withdrawn', 'cancelled'].includes(status)) throw new Error('Status nije valjan.')
      const query = new URLSearchParams()
      if (status) query.set('status', status)
      if (beforeId !== null && beforeId !== undefined) {
        if (!validId(beforeId)) throw new Error('Pokazivač sljedeće stranice nije valjan.')
        query.set('before_id', String(beforeId))
      }
      const body = await send(`/api/blocked-time-requests${query.size ? `?${query}` : ''}`, { signal })
      if (!Array.isArray(body?.data) || !['self', 'salon'].includes(body?.meta?.scope) ||
          !Object.hasOwn(body.meta, 'next_before_id') ||
          (body.meta.next_before_id !== null && !validId(body.meta.next_before_id))) {
        throw Object.assign(new Error('Poslužitelj nije vratio valjan popis zahtjeva.'), { code: 'BLOCKED_TIME_RESPONSE_INVALID' })
      }
      return { requests: body.data, scope: body.meta.scope, nextBeforeId: body.meta.next_before_id }
    },
    async submit({ startsAt, endsAt, type, note }, { signal } = {}) {
      const body = await write('/api/blocked-time-requests', {
        starts_at: startsAt, ends_at: endsAt, type, note: note?.trim() || null,
      }, signal)
      if (!validId(body?.data?.id) || body.data.status !== 'pending') throw Object.assign(new Error('Nije moguće potvrditi slanje. Osvježite popis.'), { code: 'BLOCKED_TIME_RESPONSE_INVALID' })
      return body.data
    },
    async withdraw(id, { signal } = {}) {
      const body = await write(`/api/blocked-time-requests/${requestId(id)}/withdraw`, {}, signal)
      if (String(body?.data?.id) !== String(id) || body.data.status !== 'withdrawn') throw Object.assign(new Error('Nije moguće potvrditi povlačenje. Osvježite popis.'), { code: 'BLOCKED_TIME_RESPONSE_INVALID' })
      return body.data
    },
    async cancel(id, cancellationNote, { signal } = {}) {
      if (typeof cancellationNote !== 'string' || !cancellationNote.trim() ||
          [...cancellationNote].length > 500 || cancellationNote.includes('\0')) {
        throw new Error('Unesite razlog otkazivanja do 500 znakova.')
      }
      const body = await write(`/api/blocked-time-requests/${requestId(id)}/cancel`, {
        cancellation_note: cancellationNote.trim(),
      }, signal)
      if (String(body?.data?.id) !== String(id) || body.data.status !== 'cancelled' ||
          !body.data.cancelled_at || !validId(body.data.cancelled_by_user_id) ||
          body.data.cancellation_note !== cancellationNote.trim()) {
        throw Object.assign(new Error('Nije moguće potvrditi otkazivanje. Osvježite popis.'), { code: 'BLOCKED_TIME_RESPONSE_INVALID' })
      }
      return body.data
    },
    async decide(id, decision, decisionNote, { signal } = {}) {
      if (!['approved', 'rejected'].includes(decision)) throw new Error('Odluka nije valjana.')
      const body = await write(`/api/blocked-time-requests/${requestId(id)}/decision`, {
        decision, decision_note: decisionNote?.trim() || null,
      }, signal)
      if (String(body?.data?.request?.id) !== String(id) || body.data.request.status !== decision ||
          (decision === 'approved' && String(body.data.blocked_time?.source_request_id) !== String(id))) {
        throw Object.assign(new Error('Nije moguće potvrditi odluku. Osvježite popis.'), { code: 'BLOCKED_TIME_RESPONSE_INVALID' })
      }
      return body.data
    },
  }
}

export const blockedTimeRequestApi = createBlockedTimeRequestApi()
