import { useCallback, useEffect, useRef, useState } from 'react'
import { timeOffRequestApi, wasTimeOffRequestCancelled } from '../../api/timeOffRequestApi.js'
import {
  timeOffTypes, requestStatuses, validateRequestDraft, formatRequestDate,
  formatRequestTimestamp, requestActions, assertRequestPage, appendRequestPage,
} from './timeOffRequestView.js'
import './TimeOffRequests.css'

const emptyDraft = () => ({ startDate: '', endDate: '', type: 'vacation', note: '' })

function TimeOffRequests({ authContext, employeeList, onApproved }) {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [submissionBlocked, setSubmissionBlocked] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const [reviewId, setReviewId] = useState(null)
  const [decisionNote, setDecisionNote] = useState('')
  const mounted = useRef(false)
  const busyRef = useRef(false)
  const loadingRef = useRef(true)
  const loadVersion = useRef(0)
  const loadController = useRef(null)
  const writeController = useRef(null)
  const currentData = useRef(null)
  const formHeading = useRef(null)
  const reviewField = useRef(null)
  const { current_salon: salon, user, membership } = authContext
  const ownEmployee = employeeList.find(employee => String(employee.id) === String(membership.employee_id))
  const hasEmployee = membership.employee_id != null && ownEmployee?.active === true

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      loadVersion.current += 1
      loadController.current?.abort()
      writeController.current?.abort()
    }
  }, [])

  useEffect(() => { if (formOpen) formHeading.current?.focus() }, [formOpen])
  useEffect(() => { if (reviewId !== null) reviewField.current?.focus() }, [reviewId])

  const loadPage = useCallback(async ({ append = false, beforeId = null } = {}) => {
    const version = ++loadVersion.current
    loadController.current?.abort()
    const controller = new AbortController()
    loadController.current = controller
    loadingRef.current = true
    setLoading(true)
    setError('')
    try {
      let page = await timeOffRequestApi.list({ status, beforeId, signal: controller.signal })
      if (!mounted.current || loadVersion.current !== version) return false
      // Never append old salon-wide data after reviewer access is revoked.
      if (append && currentData.current?.scope !== page.scope) {
        currentData.current = null
        setData(null)
        page = await timeOffRequestApi.list({ status, signal: controller.signal })
      }
      if (!mounted.current || loadVersion.current !== version) return false
      assertRequestPage(page, {
        current_salon: { id: salon.id }, user: { id: user.id }, membership: { id: membership.id },
      })
      const next = append ? appendRequestPage(currentData.current, page) : page
      currentData.current = next
      setData(next)
      setUncertain(false)
      return true
    } catch (requestError) {
      if (mounted.current && loadVersion.current === version && !wasTimeOffRequestCancelled(requestError)) {
        currentData.current = null
        setData(null)
        setError(requestError.message)
      }
      return false
    } finally {
      if (mounted.current && loadVersion.current === version) {
        loadingRef.current = false
        setLoading(false)
      }
    }
  }, [status, salon.id, user.id, membership.id])

  useEffect(() => {
    currentData.current = null
    setData(null)
    loadPage()
    return () => {
      loadVersion.current += 1
      loadController.current?.abort()
    }
  }, [loadPage])

  async function runChange(operation, successMessage, { created = false, approved = false } = {}) {
    if (busyRef.current || loadingRef.current || uncertain || !data) return
    busyRef.current = true
    setBusy(true)
    setError('')
    setNotice('')
    const controller = new AbortController()
    writeController.current = controller
    try {
      await operation(controller.signal)
      if (!mounted.current) return
      setNotice(successMessage)
      setReviewId(null)
      setDecisionNote('')
      if (created) { setDraft(emptyDraft()); setFormOpen(false) }
      // A failed refresh must not be presented as a failed persisted decision.
      if (approved) {
        try { await onApproved() } catch (refreshError) {
          if (mounted.current && !wasTimeOffRequestCancelled(refreshError)) {
            setNotice(`${successMessage} Profil zaposlenika nije osvježen. Osvježite aplikaciju prije uređivanja njegova rasporeda.`)
          }
        }
      }
      if (mounted.current) await loadPage()
    } catch (requestError) {
      if (!mounted.current || wasTimeOffRequestCancelled(requestError)) return
      if (created && ['SALON_PERMISSION_DENIED', 'TIME_OFF_EMPLOYEE_REQUIRED', 'TIME_OFF_EMPLOYEE_UNAVAILABLE'].includes(requestError.code)) {
        setSubmissionBlocked(requestError.message)
      }
      if (requestError.statusCode === 403 || requestError.statusCode === 404 || requestError.statusCode === 409) {
        await loadPage()
        if (!mounted.current) return
        if (['TIME_OFF_REQUEST_NOT_PENDING', 'TIME_OFF_REQUEST_NOT_FOUND', 'TIME_OFF_REVIEW_FORBIDDEN'].includes(requestError.code)) setReviewId(null)
      } else if (requestError.statusCode === 401) {
        currentData.current = null
        setData(null)
      } else if (['TIME_OFF_NETWORK_ERROR', 'TIME_OFF_RESPONSE_INVALID'].includes(requestError.code) || requestError.statusCode >= 500) {
        setUncertain(true)
      }
      if (mounted.current) setError(requestError.message)
    } finally {
      busyRef.current = false
      if (mounted.current) setBusy(false)
    }
  }

  function sendRequest(event) {
    event.preventDefault()
    const validation = validateRequestDraft(draft)
    if (validation) { setError(validation); return }
    runChange(signal => timeOffRequestApi.submit(draft, { signal }), 'Zahtjev je poslan i čeka odluku.', { created: true })
  }

  function withdrawRequest(row) {
    if (!requestActions(row, data?.scope, authContext).withdraw) return
    if (!window.confirm(`Povući zahtjev za ${formatRequestDate(row.start_date)} – ${formatRequestDate(row.end_date)}?`)) return
    runChange(signal => timeOffRequestApi.withdraw(row.id, { signal }), 'Zahtjev je povučen.')
  }

  function decideRequest(row, decision) {
    if (!requestActions(row, data?.scope, authContext).review) return
    if ([...decisionNote].length > 500) { setError('Napomena uz odluku može imati najviše 500 znakova.'); return }
    const action = decision === 'approved' ? 'Odobriti' : 'Odbiti'
    if (!window.confirm(`${action} zahtjev zaposlenika ${row.employee_name || 'za odabranu odsutnost'} za ${formatRequestDate(row.start_date)} – ${formatRequestDate(row.end_date)}?`)) return
    runChange(
      signal => timeOffRequestApi.decide(row.id, decision, decisionNote, { signal }),
      decision === 'approved' ? 'Zahtjev je odobren. Odsutnost je spremljena u raspored.' : 'Zahtjev je odbijen.',
      { approved: decision === 'approved' }
    )
  }

  const disabled = loading || busy || uncertain || !data
  const timezone = salon.timezone || 'Europe/Zagreb'

  return (
    <section className="time-off-page" aria-labelledby="time-off-title">
      <header className="time-off-header">
        <div>
          <p className="time-off-eyebrow">{salon.name || 'Odabrani salon'}</p>
          <h1 id="time-off-title">Zahtjevi za odsutnost</h1>
          <p>Zahtjev na čekanju ne blokira termine. Odsutnost ulazi u raspored nakon odobrenja.</p>
        </div>
        <div className="time-off-actions">
          <button type="button" disabled={loading || busy} onClick={async () => {
            setNotice('')
            const loaded = await loadPage()
            if (loaded) setSubmissionBlocked('')
          }}>Osvježi popis</button>
          {hasEmployee && <button type="button" className="time-off-primary" disabled={disabled} onClick={() => setFormOpen(true)}>Novi zahtjev</button>}
        </div>
      </header>

      {!hasEmployee && <p className="time-off-help">Slanje vlastitog zahtjeva dostupno je računima povezanima s aktivnim profilom zaposlenika.</p>}
      {notice && <p role="status" className="time-off-notice">{notice}</p>}
      {error && <p role="alert" className="time-off-error">{error}</p>}
      {uncertain && <p className="time-off-help">Prije nove radnje kliknite „Osvježi popis” i provjerite je li prethodna promjena spremljena.</p>}
      {busy && <p role="status">Spremanje promjene…</p>}

      {formOpen && hasEmployee && (
        <form className="time-off-panel" onSubmit={sendRequest}>
          <h2 ref={formHeading} tabIndex={-1}>Novi zahtjev za {ownEmployee.name}</h2>
          {submissionBlocked && <p role="alert" className="time-off-error">{submissionBlocked}</p>}
          <fieldset disabled={disabled || Boolean(submissionBlocked)}>
            <legend className="time-off-sr-only">Podaci zahtjeva</legend>
            <div className="time-off-form-grid">
              <label>Od datuma<input type="date" required value={draft.startDate} onChange={event => setDraft(current => ({ ...current, startDate: event.target.value }))} /></label>
              <label>Do datuma<input type="date" required min={draft.startDate || undefined} value={draft.endDate} onChange={event => setDraft(current => ({ ...current, endDate: event.target.value }))} /></label>
              <label>Vrsta odsutnosti<select value={draft.type} onChange={event => setDraft(current => ({ ...current, type: event.target.value }))}>
                {Object.entries(timeOffTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select></label>
            </div>
            <label>Napomena (neobavezno)<textarea rows={3} maxLength={500} value={draft.note} onChange={event => setDraft(current => ({ ...current, note: event.target.value }))} /></label>
            <p className="time-off-help">Oba datuma uključena su u odsutnost. Ne unosite medicinske nalaze ni druge nepotrebne osjetljive podatke.</p>
            <button type="submit" className="time-off-primary">Pošalji zahtjev</button>
          </fieldset>
          <button type="button" disabled={busy} onClick={() => {
            const changed = draft.startDate || draft.endDate || draft.note || draft.type !== 'vacation'
            if (changed && !window.confirm('Odbaciti nespremljeni zahtjev?')) return
            setDraft(emptyDraft()); setFormOpen(false)
          }}>Zatvori obrazac</button>
        </form>
      )}

      <div className="time-off-toolbar">
        <div>
          <h2>{data?.scope === 'salon' ? 'Zahtjevi salona' : 'Moji zahtjevi'}</h2>
          <p className="time-off-help">{data?.scope === 'salon' ? 'Pregled i odluke za zaposlenike odabranog salona.' : 'Zahtjevi koje ste poslali u odabranom salonu.'}</p>
        </div>
        <label>Status<select value={status} disabled={loading || busy} onChange={event => {
          setStatus(event.target.value); setReviewId(null); setDecisionNote('')
        }}>
          <option value="">Svi statusi</option>
          {Object.entries(requestStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
      </div>

      {loading && <p role="status">Učitavanje zahtjeva…</p>}
      {!loading && data && (
        <>
          {data.requests.length === 0 && <div className="time-off-empty">Nema zahtjeva za odabrani status.</div>}
          <div className="time-off-list">
            {data.requests.map(row => {
              const actions = requestActions(row, data.scope, authContext)
              return (
                <article key={row.id} className="time-off-panel" aria-label={`Zahtjev ${row.id}`}>
                  <div className="time-off-card-heading">
                    <div><h3>{row.employee_name || 'Zaposlenik'} · {timeOffTypes[row.type]}</h3><p>{formatRequestDate(row.start_date)} – {formatRequestDate(row.end_date)}</p></div>
                    <span className={`time-off-status time-off-status-${row.status}`}>{requestStatuses[row.status]}</span>
                  </div>
                  <p className="time-off-help">Zahtjev #{row.id} · Poslano {formatRequestTimestamp(row.created_at, timezone)}</p>
                  {row.note && <p className="time-off-note"><strong>Napomena:</strong> {row.note}</p>}
                  {row.decided_at && <p className="time-off-help">Odluka: {formatRequestTimestamp(row.decided_at, timezone)}</p>}
                  {row.decision_note && <p className="time-off-note"><strong>Napomena uz odluku:</strong> {row.decision_note}</p>}
                  {row.withdrawn_at && <p className="time-off-help">Povučeno: {formatRequestTimestamp(row.withdrawn_at, timezone)}</p>}
                  <div className="time-off-actions">
                    {actions.withdraw && <button type="button" disabled={disabled} onClick={() => withdrawRequest(row)}>Povuci zahtjev</button>}
                    {actions.review && String(reviewId) !== String(row.id) && <button type="button" disabled={disabled} onClick={() => {
                      if (decisionNote && !window.confirm('Odbaciti napomenu uz prethodnu odluku?')) return
                      setReviewId(row.id); setDecisionNote('')
                    }}>Pregledaj i odluči</button>}
                  </div>
                  {actions.review && String(reviewId) === String(row.id) && (
                    <div className="time-off-review">
                      <label>Napomena uz odluku (neobavezno)<textarea ref={reviewField} rows={3} maxLength={500} disabled={disabled} value={decisionNote} onChange={event => setDecisionNote(event.target.value)} /></label>
                      <div className="time-off-actions">
                        <button type="button" className="time-off-primary" disabled={disabled} onClick={() => decideRequest(row, 'approved')}>Odobri</button>
                        <button type="button" className="time-off-reject" disabled={disabled} onClick={() => decideRequest(row, 'rejected')}>Odbij</button>
                        <button type="button" disabled={busy} onClick={() => { setReviewId(null); setDecisionNote('') }}>Odustani</button>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
          {data.nextBeforeId !== null && <button type="button" disabled={disabled} onClick={() => loadPage({ append: true, beforeId: data.nextBeforeId })}>Učitaj starije zahtjeve</button>}
        </>
      )}
    </section>
  )
}

export default TimeOffRequests
