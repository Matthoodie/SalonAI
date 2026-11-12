import { PET_SIZES, weightInput } from '../../api/petMeasurements.js'
import PetHistory from './PetHistory.jsx'
import { petPhotoApi } from '../../api/petPhotoApi.js'
import { PetPhoto, PetPhotoEditor } from './PetPhoto.jsx'
import { useEffect, useId, useRef, useState } from 'react'
import { petApi, petDraftErrors, PET_SPECIES } from '../../api/petApi.js'
import './ClientPets.css'

const emptyDraft = () => ({ name: '', species: 'dog', breed: '', notes: '', sizeCategory: '', weightKg: '' })
export default function ClientPets({ salonId, client, onBusyChange }) {
  const [pets, setPets] = useState([])
  const [state, setState] = useState('loading')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [photoEditor, setPhotoEditor] = useState(null)
  const [historyPet, setHistoryPet] = useState(null)
  const [editor, setEditor] = useState(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [errors, setErrors] = useState({})
  const [confirmPet, setConfirmPet] = useState(null)
  const [busy, setBusy] = useState(false)
  const alive = useRef(false), pending = useRef(false), sequence = useRef(0), controller = useRef(null)
  const formRef = useRef(null), prefix = useId()
  const ownerActive = client.active !== false

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; sequence.current++; controller.current?.abort() }
  }, [])
  useEffect(() => {
    onBusyChange?.(busy)
    return () => onBusyChange?.(false)
  }, [busy, onBusyChange])
  useEffect(() => {
    const abort = new AbortController(), version = ++sequence.current
    controller.current = abort
    petApi.list(salonId, client.id, abort.signal).then(rows => {
      if (alive.current && version === sequence.current) { setPets(rows); setState('ready') }
    }).catch(reason => {
      if (!alive.current || version !== sequence.current || reason.name === 'AbortError') return
      setState(reason.code === 'PET_BUSINESS_DISABLED' && reason.statusCode === 403 ? 'hidden' : 'error')
      setError(reason.message)
    })
    return () => abort.abort()
  }, [salonId, client.id])

  async function reload() {
    if (pending.current) return
    controller.current?.abort()
    const abort = new AbortController(), version = ++sequence.current
    controller.current = abort
    setHistoryPet(null); setState('loading'); setError(''); setNotice(''); setEditor(null); setConfirmPet(null); setPhotoEditor(null)
    try {
      const rows = await petApi.list(salonId, client.id, abort.signal)
      if (alive.current && version === sequence.current) { setPets(rows); setState('ready') }
    } catch (reason) {
      if (!alive.current || version !== sequence.current || reason.name === 'AbortError') return
      setState(reason.code === 'PET_BUSINESS_DISABLED' && reason.statusCode === 403 ? 'hidden' : 'error'); setError(reason.message)
    }
  }
  function openEditor(pet) {
    setHistoryPet(null)
    setEditor(pet || 'new'); setDraft(pet ? { name: pet.name, species: pet.species, breed: pet.breed, notes: pet.notes, sizeCategory: pet.size_category || '', weightKg: weightInput(pet.weight_grams) } : emptyDraft())
    setErrors({}); setConfirmPet(null); setNotice('')
    requestAnimationFrame(() => {
      formRef.current?.querySelector('input')?.focus({ preventScroll: true })
      formRef.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    })
  }
  async function mutate(operation, message) {
    if (pending.current || state !== 'ready') return
    pending.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const saved = await operation()
      if (!alive.current) return
      setPets(current => [...current.filter(pet => String(pet.id) !== String(saved.id)), saved])
      setEditor(null); setConfirmPet(null); setPhotoEditor(null); setNotice(message)
    } catch (reason) {
      if (!alive.current) return
      setState('error'); setConfirmPet(null)
      const uncertain = !reason.statusCode || reason.statusCode >= 500
      setError(uncertain
        ? 'Spremanje nije potvrđeno. Promjena je možda spremljena. Osvježite popis i provjerite stanje prije ponovnog unosa; zahtjev nije automatski ponovljen.'
        : reason.message)
    } finally {
      pending.current = false
      if (alive.current) setBusy(false)
    }
  }
  function submit(event) {
    event.preventDefault()
    if (!ownerActive || pending.current || state !== 'ready') return
    const next = petDraftErrors(draft); setErrors(next)
    if (Object.keys(next).length) {
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus())
      return
    }
    mutate(() => editor === 'new' ? petApi.create(salonId, client.id, draft) : petApi.update(salonId, client.id, editor, draft),
      editor === 'new' ? 'Ljubimac je dodan.' : 'Promjene su spremljene.')
  }
  function field(key) {
    return { id: `${prefix}-${key}`, value: draft[key], disabled: busy || state !== 'ready' || !ownerActive,
      'aria-invalid': errors[key] ? 'true' : undefined, 'aria-describedby': errors[key] ? `${prefix}-${key}-error` : undefined,
      onChange: event => { setDraft(current => ({ ...current, [key]: event.target.value })); setErrors(current => ({ ...current, [key]: undefined })) } }
  }
  function fieldError(key) { return errors[key] && <span className="pets-field-error" id={`${prefix}-${key}-error`}>{errors[key]}</span> }
  if (state === 'hidden') return null
  const ordered = [...pets].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'hr') || Number(a.id) - Number(b.id))
  return <section className="client-pets" aria-labelledby={`${prefix}-title`} aria-busy={busy || state === 'loading'}>
    <div className="pets-heading"><div><span className="pets-eyebrow">GROOMING</span><h3 id={`${prefix}-title`}>Ljubimci</h3>
      <p>Profili ljubimaca vlasnika {client.name}.</p></div>
      {state === 'ready' && ownerActive && <button type="button" className="pets-primary" disabled={busy || !!editor || photoEditor !== null} onClick={() => openEditor(null)}>+ Dodaj ljubimca</button>}
    </div>
    {!ownerActive && <p className="pets-warning">Vlasnik je arhiviran. Možete pregledavati i arhivirati ljubimce. Za dodavanje, uređivanje ili ponovno aktiviranje najprije aktivirajte vlasnika.</p>}
    {state === 'loading' && <p role="status">Učitavanje ljubimaca…</p>}
    {error && <div className="pets-error" role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={reload}>Osvježi popis</button><small>Osvježavanje odbacuje nespremljeni obrazac.</small></div>}
    <p className="pets-notice" role="status">{busy ? 'Spremanje… Pričekajte potvrdu prije zatvaranja profila.' : notice}</p>
    {editor && <form ref={formRef} className="pets-form" onSubmit={submit} noValidate>
      <h4>{editor === 'new' ? 'Novi ljubimac' : `Uredi ljubimca: ${editor.name}`}</h4>
      <p>Ime i vrsta su obavezni. Pasmina, veličina, težina i bilješke su neobavezni.</p>
      <div className="pets-fields">
        <label htmlFor={`${prefix}-name`}>Ime ljubimca <span aria-hidden="true">*</span><input {...field('name')} required placeholder="Npr. Luna" autoComplete="off" />{fieldError('name')}</label>
        <label htmlFor={`${prefix}-species`}>Vrsta životinje <span aria-hidden="true">*</span><select {...field('species')} required>{Object.entries(PET_SPECIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{fieldError('species')}</label>
        <label className="pets-full" htmlFor={`${prefix}-breed`}>Pasmina (neobavezno)<input {...field('breed')} placeholder={draft.species === 'dog' ? 'Npr. pudl, mješanac ili nepoznata' : draft.species === 'cat' ? 'Npr. britanska kratkodlaka ili domaća mačka' : 'Unesite pasminu ako je poznata'} />{fieldError('breed')}</label>
        <label htmlFor={`${prefix}-sizeCategory`}>Veličina (neobavezno)<select {...field('sizeCategory')}><option value="">Nije odabrana</option>{Object.entries(PET_SIZES).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>{fieldError('sizeCategory')}</label>
        <label htmlFor={`${prefix}-weightKg`}>Težina u kg (neobavezno)<input {...field('weightKg')} type="text" inputMode="decimal" maxLength={10} placeholder="Npr. 12,5" autoComplete="off" />{fieldError('weightKg')}</label>
        <p className="pets-full pets-measurement-help">Veličinu odaberite prema procjeni salona; ne određuje se automatski iz težine. Težina: 0,001–200 kg, do tri decimale. Prazno polje znači da podatak nije unesen.</p>
        <label className="pets-full" htmlFor={`${prefix}-notes`}>Bilješke (neobavezno)<textarea {...field('notes')} rows={3} placeholder="Npr. osjetljiv na zvuk sušila; odgovara mu mirniji pristup." />{fieldError('notes')}<small>{[...draft.notes].length}/2000 znakova</small></label>
      </div>
      <div className="pets-actions"><button type="submit" className="pets-primary" disabled={busy || state !== 'ready' || !ownerActive}>{busy ? 'Spremanje…' : editor === 'new' ? 'Spremi ljubimca' : 'Spremi promjene'}</button>
        <button type="button" disabled={busy} onClick={() => setEditor(null)}>Odustani</button></div>
    </form>}
    {state === 'ready' && <>
      <div className="pets-list-heading"><span>Aktivni: {pets.filter(pet => pet.active).length} · Ukupno: {pets.length}</span><button type="button" disabled={busy || !!editor || photoEditor !== null || !!confirmPet} onClick={reload}>Osvježi popis</button></div>
      {!pets.length && <div className="pets-empty">Još nema ljubimaca. Jednom vlasniku možete dodati više životinja.</div>}
      <div className="pets-list">{ordered.map(pet => <article className="pet-card" key={pet.id} data-archived={!pet.active}>
        <div className="pet-card-title"><PetPhoto salonId={salonId} clientId={client.id} pet={pet} /><div><h4>{pet.name}</h4><p>{PET_SPECIES[pet.species]} · {pet.breed || 'Pasmina nije unesena'}</p></div><span className={`pet-status ${pet.active ? '' : 'pet-status-archived'}`}>{pet.active ? 'Aktivan' : 'Arhiviran'}</span></div>
        {(pet.size_category || pet.weight_grams != null) && <p className="pet-measurements">{[pet.size_category ? `Veličina: ${PET_SIZES[pet.size_category]}` : null, pet.weight_grams != null ? `Težina: ${weightInput(pet.weight_grams)} kg` : null].filter(Boolean).join(' · ')}</p>}
        {pet.notes && <p className="pet-notes">{pet.notes}</p>}
        <div className="pets-actions">
          <button type="button" aria-expanded={String(historyPet) === String(pet.id)} aria-controls={`${prefix}-history-${pet.id}`} disabled={busy || !!editor || !!confirmPet || photoEditor !== null} onClick={() => setHistoryPet(current => String(current) === String(pet.id) ? null : pet.id)}>{String(historyPet) === String(pet.id) ? 'Zatvori termine' : 'Termini ljubimca'}</button>
          {(pet.has_photo || (ownerActive && pet.active)) && <button type="button" disabled={busy || !!editor || !!confirmPet || photoEditor !== null || pet.revision >= 2147483647 || pet.photo_version >= 2147483647} onClick={() => { setPhotoEditor(pet.id); setNotice('') }}>Fotografija</button>}
          {ownerActive && <button type="button" disabled={busy || !!editor || photoEditor !== null || pet.revision >= 2147483647} onClick={() => openEditor(pet)}>Uredi</button>}
          {(pet.active || ownerActive) && <button type="button" className={pet.active ? 'pets-danger' : 'pets-success'} disabled={busy || !!editor || photoEditor !== null || pet.revision >= 2147483647} onClick={() => setConfirmPet(pet)}>{pet.active ? 'Arhiviraj' : 'Ponovno aktiviraj'}</button>}
        </div>
        <div id={`${prefix}-history-${pet.id}`}>{String(historyPet) === String(pet.id) && <PetHistory key={`${salonId}:${client.id}:${pet.id}`} salonId={salonId} clientId={client.id} pet={pet} />}</div>
        {String(photoEditor) === String(pet.id) && <PetPhotoEditor key={`${pet.id}:${pet.photo_version}`} pet={pet} ownerActive={ownerActive} busy={busy}
          onUpload={file => mutate(() => petPhotoApi.upload(salonId, client.id, pet, file), 'Fotografija je spremljena.')}
          onRemove={() => mutate(() => petPhotoApi.remove(salonId, client.id, pet), 'Fotografija je uklonjena.')}
          onClose={() => setPhotoEditor(null)} />}
        {String(confirmPet?.id) === String(pet.id) && <div className="pets-confirm" role="group" aria-label="Potvrda promjene statusa">
          <p>{pet.active ? `Arhivirati ljubimca ${pet.name}? Profil će ostati sačuvan.` : `Ponovno aktivirati ljubimca ${pet.name}?`}</p>
          <div className="pets-actions"><button type="button" disabled={busy} className={pet.active ? 'pets-danger' : 'pets-success'} onClick={() => mutate(() => petApi.setActive(salonId, client.id, pet, !pet.active), pet.active ? 'Ljubimac je arhiviran.' : 'Ljubimac je ponovno aktiviran.')}>Potvrdi</button><button type="button" disabled={busy} onClick={() => setConfirmPet(null)}>Odustani</button></div>
        </div>}
      </article>)}</div>
    </>}
  </section>
}
