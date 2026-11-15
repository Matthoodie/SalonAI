import { useLanguage } from '../Language/LanguageProvider'
import { clientText, clientError } from '../Language/clientText.js'
import { overviewLocale } from '../Language/overviewText.js'
import { useEffect, useId, useRef, useState } from 'react'
import { petHistoryApi, HISTORY_STATUSES } from '../../api/petHistoryApi.js'
import { PET_SPECIES } from '../../api/petApi.js'
import './PetHistory.css'
export default function PetHistory({ salonId, clientId, pet }) {
  const {language}=useLanguage()
  const f=source=>clientText(language,source)

  const [data,setData] = useState(null), [error,setError] = useState(''), [busy,setBusy] = useState(true)
  const controller = useRef(null), generation = useRef(0), pending = useRef(false), title = useId()
  async function load(cursor = null) {
    if (pending.current && cursor !== null) return
    controller.current?.abort()
    const abort = new AbortController(), version = ++generation.current
    controller.current = abort; pending.current = true; setBusy(true); setError('')
    if (cursor === null) setData(null)
    try {
      const result = await petHistoryApi.list(salonId,clientId,pet.id,{cursor,signal:abort.signal})
      if (version !== generation.current || abort.signal.aborted) return
      setData(previous => ({ ...result, appointments: cursor && previous ?
        [...previous.appointments, ...result.appointments.filter(row=>!previous.appointments.some(old=>String(old.id)===String(row.id)))] : result.appointments }))
    } catch (reason) {
      if (version !== generation.current || abort.signal.aborted) return
      setData(null); setError(reason)
    } finally {
      if (version === generation.current && !abort.signal.aborted) { pending.current = false; setBusy(false) }
    }
  }
  useEffect(() => {
    load()
    return () => { generation.current++; controller.current?.abort(); pending.current = false }
  }, [salonId,clientId,pet.id])
  const date = value => new Intl.DateTimeFormat(overviewLocale(language),{ timeZone:data.timezone, dateStyle:'medium', timeStyle:'short' }).format(new Date(value))
  const money = value => new Intl.NumberFormat(overviewLocale(language),{style:'currency',currency:'EUR'}).format(value/100)
  return <section className="pet-history" aria-labelledby={title} aria-busy={busy}>
    <div className="pet-history-heading"><h5 id={title}>{f("Termini ljubimca:")} {pet.name}</h5><button type="button" disabled={busy} onClick={()=>load()}>{f("Osvježi termine")}</button></div>
    <p className="pet-history-help">{f("Zakazani i prethodni termini, od najkasnijeg datuma prema ranijima. Prikazani su samo termini povezani s ovim ljubimcem.")}</p>
    {error && <p className="pets-error" role="alert">{clientError(language,error)}</p>}
    {data && <>
      <p className="pet-history-help">{f("Vremenska zona salona:")} {data.timezone}{f('. Naziv ljubimca i podaci usluga prikazuju se prema spremljenom terminu.')}</p>
      {!data.appointments.length && <p className="pets-empty">{f("Ovaj ljubimac još nema povezanih termina. Stariji termini bez odabranog ljubimca ostaju u profilu vlasnika.")}</p>}
      <ol className="pet-history-list">{data.appointments.map(row=><li key={row.id}>
        <div className="pet-history-heading"><time dateTime={row.starts_at}>{date(row.starts_at)}</time><span className="pet-history-status" data-status={row.status}>{f(HISTORY_STATUSES[row.status])}</span></div>
        <p><strong>{row.pet_name}</strong> · {f(PET_SPECIES[row.pet_species])}{row.pet_breed && ` · ${row.pet_breed}`}</p>
        <p>{f("Zaposlenik:")} {row.employee_name || f('Podatak nije dostupan')}</p>
        {row.items.length ? <ul>{row.items.map(item=><li key={item.position}>{item.name} · {item.duration_minutes} min · {money(item.price_cents)}</li>)}</ul> : <p>{f("Nazivi usluga nisu sačuvani za ovaj stariji termin.")}</p>}
        <p className="pet-history-total">{f("Ukupno:")} {row.duration_minutes} min · {money(row.price_cents)}</p>
      </li>)}</ol>
      {data.next_cursor && <button type="button" disabled={busy} onClick={()=>load(data.next_cursor)}>{f("Učitaj još termina")}</button>}
      {!!data.appointments.length && !data.next_cursor && <p className="pet-history-help">{f("Prikazani su svi dostupni termini ovog ljubimca.")}</p>}
    </>}
    {busy && <p role="status">{f("Učitavanje termina…")}</p>}
  </section>
}
