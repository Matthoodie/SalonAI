import { useEffect, useRef, useState } from 'react'
import { serviceImportApi } from '../../api/serviceImportApi.js'
import { newDraftRow, selectedPayload, editDraftRow, applyDuration, fingerprint, reviewIsCurrent, createPendingStore, pendingRows, MAX_ROWS } from './pricelistDraft.js'
import './ServiceImport.css'

export default function ServiceImport({userId,salonId,onImported,onClose}) {
  const [initial] = useState(() => {
    try {
      const store=createPendingStore(window.sessionStorage,userId,salonId)
      return {store,pending:store.read(),error:''}
    } catch { return {store:null,pending:null,error:'Preglednik ne može pročitati zapis potvrde. Uvoz je zaustavljen dok se zapis ne provjeri.'} }
  })
  const [rows,setRows]=useState(()=>initial.pending ? pendingRows(initial.pending) : [newDraftRow()])
  const [pending,setPending]=useState(initial.pending)
  const [review,setReview]=useState(null)
  const [duplicateHints,setDuplicateHints]=useState({})
  const [phase,setPhase]=useState(initial.pending?'uncertain':'draft')
  const [message,setMessage]=useState(initial.error)
  const [bulkDuration,setBulkDuration]=useState('')
  const [onlyMissing,setOnlyMissing]=useState(true)
  const [success,setSuccess]=useState(null)
  const [refreshFailed,setRefreshFailed]=useState(false)
  const busy=useRef(false), alive=useRef(true), previewAbort=useRef(null), heading=useRef(null)
  const locked=phase==='checking' || phase==='saving' || Boolean(pending) || !initial.store || Boolean(success)
  useEffect(()=>{
    alive.current=true
    heading.current?.focus({preventScroll:true})
    heading.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})
    return ()=>{alive.current=false;previewAbort.current?.abort()}
  },[])
  useEffect(()=>{
    const guard=event=>{
      if(pending || (!success && rows.some(row=>row.name || row.category || row.price_eur || row.default_duration_minutes))) {
        event.preventDefault();event.returnValue=''
      }
    }
    window.addEventListener('beforeunload',guard)
    return ()=>window.removeEventListener('beforeunload',guard)
  },[rows,pending,success])
  function change(next) {
    if(locked || busy.current) return
    setRows(next);setReview(null);setMessage('');setPhase('draft')
  }
  function close() {
    if(busy.current) return
    if(!pending && !success && rows.some(row=>row.name || row.category || row.price_eur || row.default_duration_minutes) &&
      !window.confirm('Zatvoriti i odbaciti nespremljeni nacrt?')) return
    onClose()
  }
  async function check() {
    if(busy.current || locked) return
    let payload
    try {payload=selectedPayload(rows)} catch(error){setMessage(error.message);return}
    busy.current=true;setPhase('checking');setMessage('');setReview(null)
    const controller=new AbortController();previewAbort.current=controller
    try {
      const data=await serviceImportApi.preview(payload,controller.signal)
      if(alive.current) {
        setReview({data,fingerprint:fingerprint(payload)})
        setDuplicateHints(Object.fromEntries(data.rows.map(row=>{
          const input=payload.items.find(item=>item.row_id===row.row_id)
          return [row.row_id,{name:input.name,category:input.category,result:row}]
        })))
      }
    } catch(error) {if(alive.current) setMessage(error.message || 'Provjera nije uspjela.')}
    finally {busy.current=false;if(alive.current) setPhase('draft')}
  }
  async function refresh() {
    try {await onImported();if(alive.current) setRefreshFailed(false)}
    catch {if(alive.current) setRefreshFailed(true)}
  }
  async function save() {
    if(busy.current || !initial.store || success) return
    let payload=pending
    const retry=Boolean(payload)
    if(!payload) {
      try {
        const selected=selectedPayload(rows)
        if(!reviewIsCurrent(review,selected)) throw new Error('Prvo provjerite odabrane stavke nakon posljednje izmjene.')
        payload={...selected,request_id:crypto.randomUUID()}
        initial.store.write(payload)
      } catch(error){setMessage(error.message || 'Potvrdu nije moguće pripremiti.');return}
      setPending(payload)
    }
    busy.current=true;setPhase('saving');setMessage('')
    try {
      const result=await serviceImportApi.confirm(payload,salonId)
      let cleanupError=false
      try {initial.store.clear()} catch {cleanupError=true}
      if(alive.current) {
        setSuccess(result);setPending(null);setPhase('success')
        setMessage(cleanupError?'Uvoz je spremljen, ali preglednik nije uklonio oznaku prethodne potvrde. Pri ponovnom otvaranju može se ponovno provjeriti isti uvoz.':'')
      }
      // Refresh live records; a replay deliberately contains historical snapshots.
      await refresh()
    } catch(error) {
      if(!retry && error.definitive) {
        try {
          initial.store.clear()
          if(alive.current){setPending(null);setReview(null);setPhase('draft');setMessage(error.message)}
        } catch {if(alive.current){setPhase('uncertain');setMessage('Zapis potvrde nije moguće ukloniti. Provjerite ishod istim zahtjevom.')}}
      } else if(alive.current) {
        setPhase('uncertain')
        setMessage('Spremanje nije potvrđeno. Stavke su zaključane kako se isti uvoz ne bi poslao pod novom oznakom. '+(error.message||''))
      }
    } finally {busy.current=false}
  }
  let payload=null
  try {payload=selectedPayload(rows)} catch { /* Empty selection is shown below. */ }
  const selected=rows.filter(row=>row.selected).length
  const canSave=!locked && payload && reviewIsCurrent(review,payload)
  return <section className="service-import" aria-labelledby="service-import-title" aria-busy={phase==='checking'||phase==='saving'}>
    <div className="service-import-heading">
      <div><span className="services-eyebrow">Priprema kataloga</span><h2 id="service-import-title" tabIndex={-1} ref={heading}>Pripremi uvoz cjenika</h2></div>
      <button type="button" onClick={close} disabled={phase==='saving'||phase==='checking'}>Zatvori</button>
    </div>
    <p>Unesite stavke, dopunite podatke i odaberite što želite dodati. Postojeće usluge ostaju sačuvane.</p>
    <p className="service-import-note">Nacrt unosite ručno. Učitavanje fotografije ili PDF-a dolazi u sljedećem koraku. Nespremljeni nacrt vrijedi dok je ovaj obrazac otvoren.</p>
    {message && <p className="service-import-alert" role="alert">{message}</p>}
    {pending && <div className="service-import-warning" role="status">
      <strong>{phase==='saving'?'Spremanje je u tijeku…':'Postoji nepotvrđen ishod spremanja.'}</strong>
      <p>Oznaka i podaci ove potvrde sačuvani su u ovom pregledniku i kartici, zasebno za korisnika i salon. Ponovna provjera koristi isti zahtjev i neće dodati iste stavke dvaput. Zatvaranje kartice može ukloniti taj zapis.</p>
      <button type="button" onClick={save} disabled={phase==='saving'}>Provjeri ishod istog uvoza</button>
    </div>}
    {success ? <div className="service-import-success" role="status">
      <h3>Uvoz je potvrđen</h3><p>Dodano usluga: <strong>{success.created_count}</strong>. {success.replayed?'Prikazana je potvrda prethodno spremljenog uvoza.':''}</p>
      <p>U zaposlenicima odaberite tko pruža nove usluge kako bi bile dostupne pri rezerviranju.</p>
      {refreshFailed && <><p>Uvoz je spremljen, ali osvježavanje kataloga nije uspjelo. Nemojte ponovno unositi iste stavke.</p><button type="button" onClick={refresh}>Osvježi katalog</button></>}
      <button type="button" onClick={onClose}>Završi</button>
    </div> : <>
      <fieldset className="service-import-bulk" disabled={locked}>
        <legend>Zajedničko trajanje</legend>
        <label>Trajanje (min)<input type="text" inputMode="numeric" value={bulkDuration} onChange={e=>setBulkDuration(e.target.value)} placeholder="npr. 30" /></label>
        <label className="service-import-check"><input type="checkbox" checked={onlyMissing} onChange={e=>setOnlyMissing(e.target.checked)} />Samo stavke kojima trajanje nedostaje</label>
        <button type="button" disabled={!selected} onClick={()=>{try{change(applyDuration(rows,bulkDuration,onlyMissing))}catch(error){setMessage(error.message)}}}>Primijeni na odabrane</button>
      </fieldset>
      <div className="service-import-selection"><strong>Odabrano {selected} / {rows.length}</strong><button type="button" disabled={locked} onClick={()=>change(rows.map(row=>({...row,selected:true})))}>Odaberi sve</button><button type="button" disabled={locked} onClick={()=>change(rows.map(row=>({...row,selected:false})))}>Poništi odabir</button></div>
      <div className="service-import-rows">{rows.map((row,index)=>{
        const result=review?.data.rows.find(item=>item.row_id===row.row_id)
        const hint=duplicateHints[row.row_id]
        const duplicateResult=result || (hint?.name===row.name && hint?.category===row.category ? hint.result : null)
        const edit=(field,value)=>change(editDraftRow(rows,row.row_id,field,value))
        return <fieldset key={row.row_id} className={'service-import-row'+(!row.selected?' service-import-row-skipped':'')} disabled={locked}>
          <legend>Stavka {index+1}</legend>
          <div className="service-import-row-heading"><label className="service-import-check"><input type="checkbox" checked={row.selected} onChange={e=>edit('selected',e.target.checked)} />Uključi u uvoz</label><button type="button" onClick={()=>change(rows.filter(item=>item.row_id!==row.row_id))}>Ukloni stavku</button></div>
          <div className="service-import-fields">{[
            ['name','Naziv usluge','npr. Osnovna njega'],['category','Kategorija','Ostalo'],['price_eur','Cijena (€)','npr. 25,00'],['default_duration_minutes','Trajanje (min)','Obavezno dopuniti'],
          ].map(([field,label,placeholder])=><label key={field}>{label}<input type="text" inputMode={field==='price_eur'?'decimal':field==='default_duration_minutes'?'numeric':undefined} value={row[field]} maxLength={field==='name'?150:field==='category'?100:20} onChange={e=>edit(field,e.target.value)} placeholder={placeholder} aria-invalid={Boolean(result?.issues.some(issue=>issue.field===field))} /></label>)}</div>
          {row.selected && result && <div className={result.ready?'service-import-ready':'service-import-row-issues'}>
            <strong>{result.ready?'Spremno za uvoz':'Potrebna provjera'}</strong>
            {result.issues.length>0 && <ul>{result.issues.map((issue,i)=><li key={i}>{issue.message}</li>)}</ul>}
            {result.duplicate_count>0 && <><p>Postojeće usluge istog naziva ({result.duplicate_count}):</p><ul>{result.duplicates.map(duplicate=><li key={duplicate.service_id}>{duplicate.name} · {duplicate.category} · {duplicate.active?'aktivna':'neaktivna'}</li>)}</ul></>}
            {result.duplicate_row_ids.length>0 && <p>Isti naziv imaju i stavke nacrta: {result.duplicate_row_ids.map(id=>rows.findIndex(item=>item.row_id===id)+1).join(', ')}.</p>}
          </div>}
          {row.selected && !result && duplicateResult && (duplicateResult.duplicate_count>0 || duplicateResult.duplicate_row_ids.length>0) && <p className="service-import-note">Prethodna provjera pronašla je isti naziv u katalogu ili nacrtu. Nakon odabira potvrde ponovno provjerite sve stavke.</p>}
          {row.selected && (row.allow_duplicate || Boolean(duplicateResult && (duplicateResult.duplicate_count || duplicateResult.duplicate_row_ids.length))) && <label className="service-import-check service-import-duplicate"><input type="checkbox" checked={row.allow_duplicate} onChange={e=>edit('allow_duplicate',e.target.checked)} />Pregledao/la sam podudaranja i želim dodati zasebnu uslugu istog naziva.</label>}
        </fieldset>
      })}</div>
      <div className="service-import-actions"><button type="button" disabled={locked || rows.length>=MAX_ROWS} onClick={()=>change([...rows,newDraftRow()])}>+ Dodaj stavku</button><button type="button" disabled={locked || !selected} onClick={check}>{phase==='checking'?'Provjera…':'Provjeri odabrane stavke'}</button><button type="button" className="service-import-primary" disabled={!canSave} onClick={save}>Potvrdi uvoz ({selected})</button></div>
      <p className="service-import-note" role="status">{review?`Spremno: ${review.data.ready_count}. Za dopunu ili pregled: ${review.data.needs_review_count}.`:'Nakon svake izmjene ponovno provjerite odabrane stavke. Najviše 100 stavki po uvozu.'}</p>
    </>}
  </section>
}
