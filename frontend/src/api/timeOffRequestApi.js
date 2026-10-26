import { salonFetch } from './salonApiContext.js'

const messages = {
  TIME_OFF_INVALID_INPUT: 'Provjerite datume, vrstu odsutnosti i duljinu napomene.',
  TIME_OFF_AUTH_REQUIRED: 'Prijavite se ponovno.',
  TIME_OFF_SALON_CONTEXT_REQUIRED: 'Ponovno odaberite salon.',
  TIME_OFF_ACTOR_FORBIDDEN: 'Vaše članstvo više ne dopušta pristup. Osvježite aplikaciju.',
  TIME_OFF_SALON_UNAVAILABLE: 'Salon trenutačno nije dostupan.',
  SALON_ACCESS_DENIED: 'Više nemate pristup odabranom salonu.',
  SALON_PERMISSION_DENIED: 'Nemate dopuštenje za slanje zahtjeva za odsutnost.',
  TIME_OFF_EMPLOYEE_REQUIRED: 'Za slanje zahtjeva potreban je povezan profil zaposlenika.',
  TIME_OFF_EMPLOYEE_UNAVAILABLE: 'Vaš profil zaposlenika nije aktivan ili više nije dostupan.',
  TIME_OFF_REQUEST_DUPLICATE: 'Za iste datume već postoji zahtjev na čekanju. Provjerite popis.',
  TIME_OFF_REQUEST_NOT_FOUND: 'Zahtjev nije pronađen ili mu nemate pristup.',
  TIME_OFF_REQUEST_NOT_PENDING: 'O zahtjevu je već odlučeno ili je povučen. Popis treba osvježiti.',
  TIME_OFF_REVIEW_FORBIDDEN: 'Više nemate ovlast za odlučivanje o zahtjevima.',
  TIME_OFF_SELF_REVIEW_FORBIDDEN: 'Ne možete odlučivati o vlastitom zahtjevu.',
  TIME_OFF_REQUESTER_UNAVAILABLE: 'Podnositelj ili njegov profil više nije aktivan ili ispravno povezan. Zahtjev nije odobren.',
  TIME_OFF_EXISTING_ABSENCE_CONFLICT: 'Razdoblje se preklapa s postojećom odsutnošću. Zahtjev ostaje na čekanju.',
  EMPLOYEE_TIME_OFF_APPOINTMENT_CONFLICT: 'Zaposlenik u tom razdoblju ima aktivan termin. Najprije premjestite ili otkažite termin; zahtjev ostaje na čekanju.',
}

export function wasTimeOffRequestCancelled(error) {
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
export function createTimeOffRequestApi({ request = salonFetch } = {}) {
  async function send(path, options = {}) {
    let response
    try {
      response = await request(path, options)
    } catch (error) {
      if (wasTimeOffRequestCancelled(error)) throw error
      throw Object.assign(new Error('Veza s poslužiteljem nije uspjela. Osvježite popis i provjerite stanje prije ponavljanja radnje.'), { code: 'TIME_OFF_NETWORK_ERROR' })
    }
    let body
    try { body = await response.json() } catch (error) {
      if (wasTimeOffRequestCancelled(error)) throw error
      throw Object.assign(new Error('Odgovor poslužitelja nije moguće pročitati. Osvježite popis prije ponavljanja radnje.'), { code: 'TIME_OFF_RESPONSE_INVALID', statusCode: response.status })
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
      if (status && !['pending', 'approved', 'rejected', 'withdrawn'].includes(status)) throw new Error('Status nije valjan.')
      const query = new URLSearchParams()
      if (status) query.set('status', status)
      if (beforeId !== null && beforeId !== undefined) {
        if (!validId(beforeId)) throw new Error('Pokazivač sljedeće stranice nije valjan.')
        query.set('before_id', String(beforeId))
      }
      const body = await send(`/api/time-off-requests${query.size ? `?${query}` : ''}`, { signal })
      if (!Array.isArray(body?.data) || !['self', 'salon'].includes(body?.meta?.scope) ||
          !Object.hasOwn(body.meta, 'next_before_id') ||
          (body.meta.next_before_id !== null && !validId(body.meta.next_before_id))) {
        throw Object.assign(new Error('Poslužitelj nije vratio valjan popis zahtjeva.'), { code: 'TIME_OFF_RESPONSE_INVALID' })
      }
      return { requests: body.data, scope: body.meta.scope, nextBeforeId: body.meta.next_before_id }
    },
    async submit({ startDate, endDate, type, note }, { signal } = {}) {
      const body = await write('/api/time-off-requests', {
        start_date: startDate, end_date: endDate, type, note: note?.trim() || null,
      }, signal)
      if (!validId(body?.data?.id) || body.data.status !== 'pending') throw Object.assign(new Error('Nije moguće potvrditi slanje. Osvježite popis.'), { code: 'TIME_OFF_RESPONSE_INVALID' })
      return body.data
    },
    async withdraw(id, { signal } = {}) {
      const body = await write(`/api/time-off-requests/${requestId(id)}/withdraw`, {}, signal)
      if (String(body?.data?.id) !== String(id) || body.data.status !== 'withdrawn') throw Object.assign(new Error('Nije moguće potvrditi povlačenje. Osvježite popis.'), { code: 'TIME_OFF_RESPONSE_INVALID' })
      return body.data
    },
    async decide(id, decision, decisionNote, { signal } = {}) {
      if (!['approved', 'rejected'].includes(decision)) throw new Error('Odluka nije valjana.')
      const body = await write(`/api/time-off-requests/${requestId(id)}/decision`, {
        decision, decision_note: decisionNote?.trim() || null,
      }, signal)
      if (String(body?.data?.request?.id) !== String(id) || body.data.request.status !== decision ||
          (decision === 'approved' && String(body.data.time_off?.source_request_id) !== String(id))) {
        throw Object.assign(new Error('Nije moguće potvrditi odluku. Osvježite popis.'), { code: 'TIME_OFF_RESPONSE_INVALID' })
      }
      return body.data
    },
  }
}

export const timeOffRequestApi = createTimeOffRequestApi()
