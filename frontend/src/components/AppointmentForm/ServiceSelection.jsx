import {useLanguage} from '../Language/LanguageProvider'
import {bookingText,bookingError,bookingPrice} from '../Language/bookingText.js'
import { useState } from 'react'
import { MAX_APPOINTMENT_SERVICES, draftItems, sumItems } from '../../api/appointmentItemsView.js'

export default function ServiceSelection({ ids, onChange, services, previous = [], disabled = false }) {
  const {language}=useLanguage()
  const f=source=>bookingText(language,source)

  const [search, setSearch] = useState('')
  let items = [], error = ''
  try { if (ids.length) items = draftItems(ids, services, previous) } catch (failure) { error = failure.message }
  let totals = null
  try { if (items.length) totals = sumItems(items) } catch (failure) { error = failure.message }
  const filtered = services.filter(item => item.active === true &&
    (item.name + ' ' + item.category).toLocaleLowerCase('hr').includes(search.toLocaleLowerCase('hr')))
  return (
    <fieldset className="appointment-service-picker" disabled={disabled}>
      <legend>{f("Usluge termina")}</legend>
      <label>{f("Pretraži usluge")} <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={f("Naziv ili kategorija")} />
      </label>
      <div className="appointment-service-options">
        {filtered.map(service => {
          const checked = ids.some(id => String(id) === String(service.id))
          return <label key={service.id} className={checked ? 'is-selected' : ''}>
            <input type="checkbox" checked={checked} disabled={!checked && ids.length >= MAX_APPOINTMENT_SERVICES}
              onChange={() => onChange(checked ? ids.filter(id => String(id) !== String(service.id)) : [...ids, service.id])} />
            <span><strong>{service.name}</strong><small>{service.category} · {service.defaultDurationMinutes} min · {bookingPrice(language,service.priceCents)}</small></span>
          </label>
        })}
        {!filtered.length && <p>{f("Nema usluga za ovaj odabir.")}</p>}
      </div>
      <p className="appointment-service-help">{f("Odabrano:")} {ids.length}/{MAX_APPOINTMENT_SERVICES}{f('. Usluge izvodi isti zaposlenik, jedna za drugom.')}</p>
      {ids.length > 0 && <ol className="appointment-service-selected">
        {ids.map(id => {
          const item = items.find(row => String(row.service_id) === String(id))
          const catalog = services.find(row => String(row.id) === String(id))
          const old = previous.find(row => String(row.service_id) === String(id))
          return <li key={id}><span>{item?.name ?? old?.name ?? catalog?.name ?? f('Nedostupna usluga')}
            {item && <small>{item.duration_minutes} min · {bookingPrice(language,item.price_cents)}</small>}
            {catalog?.active !== true && <small>{f("Neaktivna usluga — uklonite je prije promjene sastava.")}</small>}
          </span><button type="button" onClick={() => onChange(ids.filter(value => String(value) !== String(id)))}
            aria-label={f('Ukloni uslugu ') + (item?.name ?? old?.name ?? catalog?.name ?? '')}>{f("Ukloni")}</button></li>
        })}
      </ol>}
      {totals && <p className="appointment-service-total" aria-live="polite"><strong>{f("Ukupno:")} {totals.durationMinutes} min · {bookingPrice(language,totals.priceCents)}</strong></p>}
      {error && <p role="alert">{bookingError(language,error)}</p>}
    </fieldset>
  )
}
