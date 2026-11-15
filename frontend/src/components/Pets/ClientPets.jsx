import { useLanguage } from '../Language/LanguageProvider'
import { clientText, clientError, clientDynamic, clientWeight } from '../Language/clientText.js'
import { PET_SIZES, weightInput } from '../../api/petMeasurements.js'
import PetHistory from './PetHistory.jsx'
import { petPhotoApi } from '../../api/petPhotoApi.js'
import { PetPhoto, PetPhotoEditor } from './PetPhoto.jsx'
import { useEffect, useId, useRef, useState } from 'react'
import { petApi, petDraftErrors, PET_SPECIES } from '../../api/petApi.js'
import './ClientPets.css'

const emptyDraft = () => ({ name: '', species: 'dog', breed: '', notes: '', sizeCategory: '', weightKg: '' })
export default function ClientPets({ salonId, client, onBusyChange }) {
  const {language}=useLanguage()
  const f=source=>clientText(language,source)

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
      setError(reason)
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
      setState(reason.code === 'PET_BUSINESS_DISABLED' && reason.statusCode === 403 ? 'hidden' : 'error'); setError(reason)
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
        : reason)
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
  function fieldError(key) { return errors[key] && <span className="pets-field-error" id={`${prefix}-${key}-error`}>{clientError(language,errors[key])}</span> }
  if (state === 'hidden') return null
  const ordered = [...pets].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, language === 'en' ? 'en' : 'hr') || Number(a.id) - Number(b.id))
  return <section className="client-pets" aria-labelledby={`${prefix}-title`} aria-busy={busy || state === 'loading'}>
    <div className="pets-heading"><div><span className="pets-eyebrow">GROOMING</span><h3 id={`${prefix}-title`}>{f("Ljubimci")}</h3>
      <p>{f("Profili ljubimaca vlasnika")} {client.name}.</p></div>
      {state === 'ready' && ownerActive && <button type="button" className="pets-primary" disabled={busy || !!editor || photoEditor !== null} onClick={() => openEditor(null)}>{f("+ Dodaj ljubimca")}</button>}
    </div>
    {!ownerActive && <p className="pets-warning">{f("Vlasnik je arhiviran. Možete pregledavati i arhivirati ljubimce. Za dodavanje, uređivanje ili ponovno aktiviranje najprije aktivirajte vlasnika.")}</p>}
    {state === 'loading' && <p role="status">{f("Učitavanje ljubimaca…")}</p>}
    {error && <div className="pets-error" role="alert"><p>{clientError(language,error)}</p><button type="button" disabled={busy} onClick={reload}>{f("Osvježi popis")}</button><small>{f("Osvježavanje odbacuje nespremljeni obrazac.")}</small></div>}
    <p className="pets-notice" role="status">{busy ? f('Spremanje… Pričekajte potvrdu prije zatvaranja profila.') : f(notice)}</p>
    {editor && <form ref={formRef} className="pets-form" onSubmit={submit} noValidate>
      <h4>{editor === 'new' ? f('Novi ljubimac') : clientDynamic(language,'editPet',editor.name)}</h4>
      <p>{f("Ime i vrsta su obavezni. Pasmina, veličina, težina i bilješke su neobavezni.")}</p>
      <div className="pets-fields">
        <label htmlFor={`${prefix}-name`}>{f("Ime ljubimca")} <span aria-hidden="true">*</span><input {...field('name')} required placeholder={f("Npr. Luna")} autoComplete="off" />{fieldError('name')}</label>
        <label htmlFor={`${prefix}-species`}>{f("Vrsta životinje")} <span aria-hidden="true">*</span><select {...field('species')} required>{Object.entries(PET_SPECIES).map(([value, label]) => <option key={value} value={value}>{f(label)}</option>)}</select>{fieldError('species')}</label>
        <label className="pets-full" htmlFor={`${prefix}-breed`}>{f("Pasmina (neobavezno)")}<input {...field('breed')} placeholder={draft.species === 'dog' ? f('Npr. pudl, mješanac ili nepoznata') : draft.species === 'cat' ? f('Npr. britanska kratkodlaka ili domaća mačka') : f('Unesite pasminu ako je poznata')} />{fieldError('breed')}</label>
        <label htmlFor={`${prefix}-sizeCategory`}>{f("Veličina (neobavezno)")}<select {...field('sizeCategory')}><option value="">{f("Nije odabrana")}</option>{Object.entries(PET_SIZES).map(([value,label]) => <option key={value} value={value}>{f(label)}</option>)}</select>{fieldError('sizeCategory')}</label>
        <label htmlFor={`${prefix}-weightKg`}>{f("Težina u kg (neobavezno)")}<input {...field('weightKg')} type="text" inputMode="decimal" maxLength={10} placeholder={f("Npr. 12,5")} autoComplete="off" />{fieldError('weightKg')}</label>
        <p className="pets-full pets-measurement-help">{f("Veličinu odaberite prema procjeni salona; ne određuje se automatski iz težine. Težina: 0,001–200 kg, do tri decimale. Prazno polje znači da podatak nije unesen.")}</p>
        <label className="pets-full" htmlFor={`${prefix}-notes`}>{f("Bilješke (neobavezno)")}<textarea {...field('notes')} rows={3} placeholder={f("Npr. osjetljiv na zvuk sušila; odgovara mu mirniji pristup.")} />{fieldError('notes')}<small>{[...draft.notes].length}/2000 {f('znakova')}</small></label>
      </div>
      <div className="pets-actions"><button type="submit" className="pets-primary" disabled={busy || state !== 'ready' || !ownerActive}>{busy ? f('Spremanje…') : editor === 'new' ? f('Spremi ljubimca') : f('Spremi promjene')}</button>
        <button type="button" disabled={busy} onClick={() => setEditor(null)}>{f("Odustani")}</button></div>
    </form>}
    {state === 'ready' && <>
      <div className="pets-list-heading"><span>{f("Aktivni:")} {pets.filter(pet => pet.active).length} · {f('Ukupno:')} {pets.length}</span><button type="button" disabled={busy || !!editor || photoEditor !== null || !!confirmPet} onClick={reload}>{f("Osvježi popis")}</button></div>
      {!pets.length && <div className="pets-empty">{f("Još nema ljubimaca. Jednom vlasniku možete dodati više životinja.")}</div>}
      <div className="pets-list">{ordered.map(pet => <article className="pet-card" key={pet.id} data-archived={!pet.active}>
        <div className="pet-card-title"><PetPhoto salonId={salonId} clientId={client.id} pet={pet} /><div><h4>{pet.name}</h4><p>{f(PET_SPECIES[pet.species])} · {pet.breed || f('Pasmina nije unesena')}</p></div><span className={`pet-status ${pet.active ? '' : 'pet-status-archived'}`}>{pet.active ? f('Aktivan') : f('Arhiviran')}</span></div>
        {(pet.size_category || pet.weight_grams != null) && <p className="pet-measurements">{[pet.size_category ? `${f('Veličina:')} ${f(PET_SIZES[pet.size_category])}` : null, pet.weight_grams != null ? `${f('Težina:')} ${clientWeight(language,pet.weight_grams)} kg` : null].filter(Boolean).join(' · ')}</p>}
        {pet.notes && <p className="pet-notes">{pet.notes}</p>}
        <div className="pets-actions">
          <button type="button" aria-expanded={String(historyPet) === String(pet.id)} aria-controls={`${prefix}-history-${pet.id}`} disabled={busy || !!editor || !!confirmPet || photoEditor !== null} onClick={() => setHistoryPet(current => String(current) === String(pet.id) ? null : pet.id)}>{String(historyPet) === String(pet.id) ? f('Zatvori termine') : f('Termini ljubimca')}</button>
          {(pet.has_photo || (ownerActive && pet.active)) && <button type="button" disabled={busy || !!editor || !!confirmPet || photoEditor !== null || pet.revision >= 2147483647 || pet.photo_version >= 2147483647} onClick={() => { setPhotoEditor(pet.id); setNotice('') }}>{f("Fotografija")}</button>}
          {ownerActive && <button type="button" disabled={busy || !!editor || photoEditor !== null || pet.revision >= 2147483647} onClick={() => openEditor(pet)}>{f("Uredi")}</button>}
          {(pet.active || ownerActive) && <button type="button" className={pet.active ? 'pets-danger' : 'pets-success'} disabled={busy || !!editor || photoEditor !== null || pet.revision >= 2147483647} onClick={() => setConfirmPet(pet)}>{pet.active ? f('Arhiviraj') : f('Ponovno aktiviraj')}</button>}
        </div>
        <div id={`${prefix}-history-${pet.id}`}>{String(historyPet) === String(pet.id) && <PetHistory key={`${salonId}:${client.id}:${pet.id}`} salonId={salonId} clientId={client.id} pet={pet} />}</div>
        {String(photoEditor) === String(pet.id) && <PetPhotoEditor key={`${pet.id}:${pet.photo_version}`} pet={pet} ownerActive={ownerActive} busy={busy}
          onUpload={file => mutate(() => petPhotoApi.upload(salonId, client.id, pet, file), 'Fotografija je spremljena.')}
          onRemove={() => mutate(() => petPhotoApi.remove(salonId, client.id, pet), 'Fotografija je uklonjena.')}
          onClose={() => setPhotoEditor(null)} />}
        {String(confirmPet?.id) === String(pet.id) && <div className="pets-confirm" role="group" aria-label={f("Potvrda promjene statusa")}>
          <p>{pet.active ? clientDynamic(language,'archivePet',pet.name) : clientDynamic(language,'reactivatePet',pet.name)}</p>
          <div className="pets-actions"><button type="button" disabled={busy} className={pet.active ? 'pets-danger' : 'pets-success'} onClick={() => mutate(() => petApi.setActive(salonId, client.id, pet, !pet.active), pet.active ? 'Ljubimac je arhiviran.' : 'Ljubimac je ponovno aktiviran.')}>{f("Potvrdi")}</button><button type="button" disabled={busy} onClick={() => setConfirmPet(null)}>{f("Odustani")}</button></div>
        </div>}
      </article>)}</div>
    </>}
  </section>
}
