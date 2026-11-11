import { useEffect, useId, useRef, useState } from 'react'
import { petPhotoApi, photoFileError } from '../../api/petPhotoApi.js'

export function PetPhoto({ salonId, clientId, pet }) {
  const [photo, setPhoto] = useState(null), [failed, setFailed] = useState(false)
  const identity = `${salonId}:${clientId}:${pet.id}:${pet.photo_version}:${pet.has_photo}`
  useEffect(() => {
    let live = true, url
    const abort = new AbortController()
    setPhoto(null); setFailed(false)
    if (pet.has_photo) petPhotoApi.load(salonId, clientId, pet, abort.signal).then(blob => {
      if (!live) return
      url = URL.createObjectURL(blob); setPhoto({ identity, url })
    }).catch(reason => { if (live && reason.name !== 'AbortError') setFailed(true) })
    return () => { live = false; abort.abort(); if (url) URL.revokeObjectURL(url) }
  }, [identity])
  return <div className="pet-photo-avatar">
    {photo?.identity === identity ? <img src={photo.url} alt={`Fotografija ljubimca ${pet.name}`} /> :
      <span aria-label={failed ? 'Fotografiju nije moguće učitati. Osvježite popis.' : pet.has_photo ? 'Učitavanje fotografije' : 'Bez fotografije'}>{[...pet.name][0]?.toLocaleUpperCase('hr')}</span>}
    {failed && <small>Osvježite popis</small>}
  </div>
}

export function PetPhotoEditor({ pet, ownerActive, busy, onUpload, onRemove, onClose }) {
  const [file, setFile] = useState(null), [preview, setPreview] = useState(null), [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false), [previewReady, setPreviewReady] = useState(false)
  const editorRef = useRef(null)
  useEffect(() => {
    editorRef.current?.querySelector('input,button')?.focus({ preventScroll: true })
    editorRef.current?.scrollIntoView?.({ block: 'nearest', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }, [])
  const id = useId(), canUpload = ownerActive && pet.active
  useEffect(() => {
    setPreviewReady(false)
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file); setPreview({ file, url })
    return () => URL.revokeObjectURL(url)
  }, [file])
  return <div ref={editorRef} className="pet-photo-editor" role="group" aria-labelledby={`${id}-title`}>
    <h4 id={`${id}-title`}>Fotografija: {pet.name}</h4>
    <p>JPEG ili PNG do 8 MB i 24 megapiksela. Fotografiju ćemo smanjiti za prikaz profila i ukloniti podatke o lokaciji.</p>
    {canUpload ? <label htmlFor={id}>Odaberi fotografiju<input id={id} type="file" accept="image/jpeg,image/png" disabled={busy}
      aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${id}-error` : undefined}
      onChange={event => {
        const selected = event.target.files?.[0], message = photoFileError(selected)
        setPreviewReady(false); setError(message); setConfirm(false); setFile(message ? null : selected)
        event.target.value = ''
      }} /></label> : <p>Za dodavanje ili zamjenu fotografije vlasnik i ljubimac moraju biti aktivni.</p>}
    {error && <p className="pets-field-error" id={`${id}-error`} role="alert">{error}</p>}
    {file && preview?.file === file && <figure className="pet-photo-preview"><img src={preview.url} alt={`Pregled odabrane fotografije za ${pet.name}`}
      onLoad={event => {
        const image = event.currentTarget
        if (image.naturalWidth * image.naturalHeight > 24000000) { setPreviewReady(false); setError('Fotografija smije imati najviše 24 megapiksela. Odaberite manju sliku.'); setFile(null) }
        else setPreviewReady(true)
      }} onError={() => { setPreviewReady(false); setError('Fotografiju nije moguće prikazati. Odaberite drugu datoteku.'); setFile(null) }} />
      <figcaption>Pregled prije spremanja. Fotografija još nije spremljena.</figcaption></figure>}
    <div className="pets-actions">
      {canUpload && <button type="button" className="pets-primary" disabled={busy || !file || !previewReady || !!error} onClick={() => onUpload(file)}>Spremi fotografiju</button>}
      {pet.has_photo && <button type="button" className="pets-danger" disabled={busy} onClick={() => setConfirm(true)}>Ukloni fotografiju</button>}
      <button type="button" disabled={busy} onClick={onClose}>Odustani</button>
    </div>
    {confirm && <div className="pets-confirm" role="group" aria-label="Potvrda uklanjanja fotografije"><p>Ukloniti fotografiju ljubimca {pet.name}? Profil i termini ostaju sačuvani.</p>
      <div className="pets-actions"><button type="button" className="pets-danger" disabled={busy} onClick={onRemove}>Potvrdi uklanjanje</button><button type="button" disabled={busy} onClick={() => setConfirm(false)}>Zadrži fotografiju</button></div>
    </div>}
  </div>
}
