import LanguageSelector from '../Language/LanguageSelector'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { salonSetupApi, SETUP_STEPS, setupPayload } from '../../api/salonSetupApi.js'
import './SalonSetupWizard.css'

const labels = ['Djelatnost', 'Salon', 'Tim', 'Usluge', 'Raspored', 'Pregled']
const businessLabels = { hair: 'Frizerski salon', grooming: 'Grooming — njega ljubimaca', mixed: 'Više djelatnosti', other: 'Drugo' }
const teamLabels = { solo: 'Radim samostalno', team: 'Radimo kao tim' }
const boolLabel = value => value === null ? 'Još nije odabrano' : value ? 'Da' : 'Ne'
const cancelled = error => error?.name === 'AbortError' || error?.code === 'STALE_SALON_CONTEXT'

export default function SalonSetupWizard({ salonId, api = salonSetupApi }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [locked, setLocked] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [focusToken, setFocusToken] = useState(0)
  const operation = useRef(null)
  const generation = useRef(0)
  const heading = useRef(null)
  useEffect(() => {
    generation.current += 1
    return () => { generation.current += 1; operation.current?.abort() }
  }, [salonId])
  useEffect(() => { if (focusToken) heading.current?.focus({ preventScroll: true }) }, [focusToken])
  const dirty = draft && data && JSON.stringify(draft) !== JSON.stringify(data.setup)
  useEffect(() => {
    if (!dirty && !busy) return undefined
    const warn = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, busy])

  async function load() {
    if (operation.current) return
    if (draft && (dirty || locked) && !window.confirm('Učitati spremljene podatke? Trenutačni izbori u obrascu bit će zamijenjeni.')) return
    const controller = new AbortController()
    operation.current = controller
    const token = generation.current
    setBusy(true); setError(''); setNotice(''); setOpen(true)
    try {
      const result = await api.load(salonId, controller.signal)
      if (token !== generation.current) return
      setData(result); setDraft(result.setup); setLocked(false); setFocusToken(value => value + 1)
    } catch (failure) {
      if (token === generation.current && !cancelled(failure)) { setError(failure.message); setLocked(true) }
    } finally {
      if (operation.current === controller) operation.current = null
      if (token === generation.current) setBusy(false)
    }
  }
  async function save(step = draft?.last_step, destination = null, close = false) {
    if (operation.current || locked || !data || !draft) return
    const next = { ...draft, last_step: step }
    try { setupPayload(next, data.setup.revision) } catch {
      setError('Provjerite lokaciju (do 250 znakova) i odabrane vrijednosti.'); return
    }
    const controller = new AbortController()
    operation.current = controller
    const token = generation.current
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await api.save(salonId, next, data.setup.revision, controller.signal)
      if (token !== generation.current) return
      setData(result); setDraft(result.setup)
      setNotice('Izbori su spremljeni. Postavljanje možete nastaviti kasnije.')
      setFocusToken(value => value + 1)
      if (close) setOpen(false)
      if (destination) navigate(destination)
    } catch (failure) {
      if (token === generation.current && !cancelled(failure)) {
        setLocked(true)
        setError(failure.statusCode === 409 || failure.statusCode === 403 ? failure.message :
          'Spremanje nije potvrđeno. Zahtjev nije ponovljen. Učitajte spremljene podatke kako biste provjerili rezultat prije nastavka.')
      }
    } finally {
      if (operation.current === controller) operation.current = null
      if (token === generation.current) setBusy(false)
    }
  }
  function close() {
    if (operation.current) return
    if (dirty && !window.confirm('Zatvoriti bez spremanja posljednjih izmjena?')) return
    setOpen(false); setDraft(data?.setup ?? null)
  }
  const index = SETUP_STEPS.indexOf(draft?.last_step)
  function select(key, value) { setDraft(current => ({ ...current, [key]: value })); setNotice(''); setError('') }

  return <section className="settings-panel salon-setup" aria-labelledby="salon-setup-title">
    <div className="salon-setup-header">
      <LanguageSelector showProgress />
      <div><p className="settings-eyebrow">MAGIC WIZARD</p><h2 id="salon-setup-title">Postavljanje salona</h2>
        <p>Prođite osnovne izbore i nastavite uređivati svoj salon.</p></div>
      {!open && <button type="button" className="setup-primary" onClick={load}>Otvori postavljanje</button>}
    </div>
    {!open && <p className="setup-help">Spremljeni korak učitat će se pri otvaranju. Postojeći podaci salona ostaju dostupni.</p>}
    {notice && <p role="status" className="setup-notice">{notice}</p>}
    {open && <>
      {error && <p role="alert" className="setup-error">{error}</p>}
      {busy && <p role="status">{data ? 'Spremanje ili učitavanje…' : 'Učitavanje postavljanja…'}</p>}
      {(!data || locked) && !busy && <button type="button" onClick={load}>Učitaj spremljene podatke</button>}
      {draft && data && <>
        <p className="setup-context">{data.salon.name} · {data.salon.timezone}</p>
        <ol className="setup-steps" aria-label="Koraci postavljanja">{labels.map((label, i) =>
          <li key={label}><button type="button" disabled={busy || locked} aria-current={index === i ? 'step' : undefined}
            onClick={() => { if (i !== index) save(SETUP_STEPS[i]) }}>{i + 1}. {label}</button></li>)}</ol>
        <h3 ref={heading} tabIndex={-1} className="setup-step-title">{index + 1}. {labels[index]}</h3>
        <fieldset className="setup-fields" disabled={busy || locked}>
          <legend className="setup-sr">{labels[index]}</legend>
          {index === 0 && <><label htmlFor="setup-business">Čime se bavite?</label>
            <select id="setup-business" value={draft.business_type ?? ''} onChange={e => select('business_type', e.target.value || null)}>
              <option value="">Odabrat ću kasnije</option>{Object.entries(businessLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select><p className="setup-help">Izbor opisuje vašu djelatnost. Profili ljubimaca, pasmina i fotografije dolaze u grooming nadogradnji. Podrška za složenije beauty centre planirana je za V2.</p></>}
          {index === 1 && <><dl className="setup-summary"><div><dt>Naziv salona</dt><dd>{data.salon.name}</dd></div><div><dt>Vremenska zona</dt><dd>{data.salon.timezone}</dd></div></dl>
            <label htmlFor="setup-location">Lokacija (neobavezno)</label><input id="setup-location" value={draft.location} onChange={e => select('location', e.target.value)} placeholder="Grad ili adresa salona" />
            <p className="setup-help">Do 250 znakova. Naziv i vremenska zona prikazuju trenutačne podatke salona; u ovom koraku uređujete lokaciju.</p></>}
          {index === 2 && <><label htmlFor="setup-team">Kako radite?</label><select id="setup-team" value={draft.team_mode ?? ''} onChange={e => select('team_mode', e.target.value || null)}>
            <option value="">Odabrat ću kasnije</option>{Object.entries(teamLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <label htmlFor="setup-owner">Pružate li osobno usluge klijentima?</label><select id="setup-owner" value={draft.owner_provides_services === null ? '' : String(draft.owner_provides_services)} onChange={e => select('owner_provides_services', e.target.value === '' ? null : e.target.value === 'true')}>
              <option value="">Odabrat ću kasnije</option><option value="true">Da</option><option value="false">Ne</option></select>
            <p className="setup-help">Ovi izbori ne stvaraju zaposlenike ni pozivnice. Članove i profile zaposlenika uređujete na stranici Zaposlenici.</p>
            <button type="button" onClick={() => save('team', '/employees')}>Spremi i otvori zaposlenike</button></>}
          {index === 3 && <><p>Dodajte usluge ručno ili prepoznajte fotografiju/PDF cjenika. Prije uvoza pregledajte stavke i dopunite trajanja.</p>
            <button type="button" onClick={() => save('services', '/services')}>Spremi i otvori usluge</button><p className="setup-help">Za nastavak se vratite u Postavke → Postavljanje salona.</p></>}
          {index === 4 && <><p>Za svakog zaposlenika provjerite usluge koje pruža, radno vrijeme, posebne datume, odsutnosti i blokirano vrijeme.</p>
            <button type="button" onClick={() => save('schedule', '/employees')}>Spremi i otvori raspored zaposlenika</button><p className="setup-help">Raspored uređujete otvaranjem zaposlenika. Wizard ovdje ne mijenja termine ni radno vrijeme.</p></>}
          {index === 5 && <><dl className="setup-summary">
            <div><dt>Djelatnost</dt><dd>{businessLabels[draft.business_type] || 'Još nije odabrano'}</dd></div>
            <div><dt>Lokacija</dt><dd>{draft.location || 'Nije unesena'}</dd></div>
            <div><dt>Način rada</dt><dd>{teamLabels[draft.team_mode] || 'Još nije odabrano'}</dd></div>
            <div><dt>Osobno pružate usluge</dt><dd>{boolLabel(draft.owner_provides_services)}</dd></div>
            </dl><p className="setup-help">Ovo je pregled osnovnih izbora. Automatska provjera spremnosti salona dolazi u sljedećem koraku razvoja. Spremanje pregleda ne potvrđuje da su tim, usluge i raspored dovršeni.</p></>}
        </fieldset>
        <div className="setup-actions">
          {index > 0 && <button type="button" disabled={busy || locked} onClick={() => save(SETUP_STEPS[index - 1])}>Natrag</button>}
          {index < 5 && <button type="button" className="setup-primary" disabled={busy || locked} onClick={() => save(SETUP_STEPS[index + 1])}>Spremi i nastavi</button>}
          <button type="button" className={index === 5 ? 'setup-primary' : ''} disabled={busy || locked} onClick={() => save(draft.last_step, null, true)}>Spremi i zatvori</button>
          <button type="button" disabled={busy} onClick={close}>Zatvori bez spremanja</button>
        </div>
        <p className="setup-help">{dirty ? 'Imate nespremljene izbore. ' : ''}Prijelaz na drugi korak sprema izbore. Prije odlaska preko glavnog izbornika koristite „Spremi i zatvori”.</p>
      </>}
      {!data && <button type="button" disabled={busy} onClick={close}>Zatvori</button>}
    </>}
  </section>
}
