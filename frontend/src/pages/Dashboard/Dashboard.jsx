import {useLanguage} from '../../components/Language/LanguageProvider'
import {overviewText,overviewError,overviewLocale,overviewCount,overviewMoney,overviewDate,overviewStatus,overviewRecipient,overviewMissingPrices} from '../../components/Language/overviewText.js'
import { useEffect, useState } from 'react'
import { periodRange, salonDate, scheduleView, summarizeAppointments } from './dashboardView.js'
import './Dashboard.css'

const periods = [['today', 'Danas'], ['yesterday', 'Jučer'], ['last7', '7 dana'], ['last30', '30 dana'], ['custom', 'Odabrani datum'], ['range', 'Raspon datuma']]

function AppointmentRow({ appointment, timeZone, showDate = false }) {
  const {language}=useLanguage()
  const f=source=>overviewText(language,source)
  const time = new Intl.DateTimeFormat(overviewLocale(language), { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(appointment.startsAt))
  return (
    <li className="dashboard-appointment">
      <div className="dashboard-appointment-time">
        {showDate && <span>{overviewDate(language,salonDate(appointment.startsAt, timeZone))}</span>}
        <strong>{time}</strong>
      </div>
      <div className="dashboard-appointment-person">
        <strong>{overviewRecipient(language,appointment)}</strong>
        <span>{appointment.serviceName || appointment.service || f('Nepoznata usluga')}</span>
        {appointment.employeeName && <small>{appointment.employeeName}</small>}
      </div>
      <span className={`dashboard-status dashboard-status-${appointment.statusCode}`}>{overviewStatus(language,appointment)}</span>
    </li>
  )
}

export default function Dashboard({ appointmentList = [], clientList = [], salonTimezone, canManage = false }) {
  const {language}=useLanguage()
  const f=source=>overviewText(language,source)

  const [now, setNow] = useState(() => new Date())
  const [period, setPeriod] = useState('today')
  const [draftFrom, setDraftFrom] = useState(() => salonTimezone ? salonDate(new Date(), salonTimezone) : '')
  const [draftTo, setDraftTo] = useState(() => salonTimezone ? salonDate(new Date(), salonTimezone) : '')
  const [appliedRange, setAppliedRange] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const update = () => setNow(new Date())
    const timer = window.setInterval(update, 30000)
    window.addEventListener('focus', update)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update) }
  }, [])
  if (!salonTimezone) return <div className="dashboard"><p role="alert">{f("Nedostaje vremenska zona salona. Ponovno učitajte aplikaciju.")}</p></div>
  const today = salonDate(now, salonTimezone)
  const custom = period === 'range' || period === 'custom'
  const range = custom ? appliedRange : periodRange(period, today)
  const stats = range ? summarizeAppointments(appointmentList, range, salonTimezone) : null
  const schedule = scheduleView(appointmentList, now, salonTimezone)
  function choosePeriod(value) {
    setPeriod(value)
    setError('')
    if (value === 'range' || value === 'custom') setAppliedRange(null)
  }
  function applyRange(event) {
    event.preventDefault()
    try { setAppliedRange(periodRange(period, today, draftFrom, draftTo)); setError('') }
    catch (failure) { setError(failure.message); setAppliedRange(null) }
  }
  const cards = stats ? [
    [f('Evidentirani termini'), overviewCount(language,stats.total), f('Svi statusi u odabranom razdoblju.')],
    [f('Vrijednost odrađenih usluga'), overviewMoney(language,stats.valueCents), f('Prema spremljenim cijenama završenih termina; nije evidencija naplate.')],
    [f('Aktivni termini'), overviewCount(language,stats.active), f('Na čekanju i zakazani.')],
    [f('Završeni termini'), overviewCount(language,stats.completed), f('Termini označeni kao završeni.')],
    [f('Otkazani termini'), overviewCount(language,stats.cancelled), f('Termini označeni kao otkazani.')],
    [f('Nedolasci'), overviewCount(language,stats.noShow), f('Klijent nije došao na termin.')],
  ] : []
  return (
    <div className="dashboard">
      <header className="dashboard-heading">
        <p className="dashboard-eyebrow">{canManage ? f('VAŠ SALON') : f('VAŠ PREGLED')}</p>
        <h1>{f("Pregled poslovanja")}</h1>
        <p>{canManage ? f('Pratite termine i vrijednost odrađenih usluga u odabranom razdoblju.') : f('Pregled termina koji su dostupni vašem računu u odabranom salonu.')}</p>
      </header>
      <section className="dashboard-panel" aria-labelledby="dashboard-period-heading">
        <h2 id="dashboard-period-heading">{f("Razdoblje pregleda")}</h2>
        <div className="dashboard-period-buttons">
          {periods.map(([value, label]) => <button key={value} type="button" aria-pressed={period === value} className={period === value ? 'is-active' : ''} onClick={() => choosePeriod(value)}>{f(label)}</button>)}
        </div>
        {custom && <form className="dashboard-range-form" onSubmit={applyRange} noValidate>
          <label htmlFor="dashboard-from">{period === 'custom' ? f('Datum') : f('Od')}<input id="dashboard-from" type="date" min="0001-01-01" max="9999-12-31" value={draftFrom} onChange={event => { setDraftFrom(event.target.value); setAppliedRange(null); setError('') }} /></label>
          {period === 'range' && <label htmlFor="dashboard-to">{f("Do")}<input id="dashboard-to" type="date" min="0001-01-01" max="9999-12-31" value={draftTo} onChange={event => { setDraftTo(event.target.value); setAppliedRange(null); setError('') }} /></label>}
          <button type="submit" className="dashboard-primary">{f("Prikaži razdoblje")}</button>
        </form>}
        {error && <p role="alert" className="dashboard-error">{overviewError(language,error)}</p>}
        {range ? <p className="dashboard-period-note" role="status">{f("Prikaz:")} <strong>{range.from === range.to ? overviewDate(language,range.from) : `${overviewDate(language,range.from)} – ${overviewDate(language,range.to)}`}</strong>{language==='en' ? `. Both dates are included, based on appointment start in the salon timezone (${salonTimezone}).` : `. Uključena su oba datuma, prema početku termina u vremenskoj zoni salona (${salonTimezone}).`}</p>
          : <p className="dashboard-period-note">{language==='en' ? (period==='custom' ? 'Choose a date, then click “Show period”.' : 'Choose the start and end dates, then click “Show period”.') : (period==='custom' ? 'Odaberite datum pa kliknite „Prikaži razdoblje”.' : 'Odaberite početni i završni datum pa kliknite „Prikaži razdoblje”.')}</p>}
      </section>
      {stats && <>
        <section className="dashboard-metrics" aria-label={f("Statistika odabranog razdoblja")}>
          {cards.map(([title, value, note], index) => <article className="dashboard-metric" key={index}><h2>{title}</h2><strong>{value}</strong><p>{note}</p></article>)}
        </section>
        {stats.missingPrices > 0 && <p className="dashboard-error" role="alert">{overviewMissingPrices(language,stats.missingPrices)}</p>}
        {stats.total === 0 && <p className="dashboard-empty-period">{f("U odabranom razdoblju nema evidentiranih termina.")}</p>}
      </>}
      {canManage && <p className="dashboard-client-summary">{f("Klijenti u učitanom popisu salona:")} <strong>{clientList.length}</strong>{f(". Ovaj broj ne ovisi o odabranom razdoblju.")}</p>}
      <section className="dashboard-panel" aria-labelledby="dashboard-today-heading">
        <div className="dashboard-section-heading"><div><p className="dashboard-eyebrow">{overviewDate(language,today)}</p><h2 id="dashboard-today-heading">{f("Današnji raspored")}</h2></div><span>{overviewCount(language,schedule.today.length)}</span></div>
        <p className="dashboard-section-note">{f("Današnji termini, neovisno o razdoblju statistike.")}</p>
        {schedule.today.length ? <ul className="dashboard-appointments">{schedule.today.map(appointment => <AppointmentRow key={appointment.id} appointment={appointment} timeZone={salonTimezone} />)}</ul> : <p className="dashboard-empty">{f("Danas nema evidentiranih termina.")}</p>}
      </section>
      <section className="dashboard-panel" aria-labelledby="dashboard-upcoming-heading">
        <div className="dashboard-section-heading"><div><p className="dashboard-eyebrow">{f("SLJEDEĆE")}</p><h2 id="dashboard-upcoming-heading">{f("Nadolazeći termini")}</h2></div>{schedule.upcoming.length > 0 && <span>{overviewCount(language,schedule.upcoming.length)}</span>}</div>
        <p className="dashboard-section-note">{f("Do pet sljedećih aktivnih termina, neovisno o razdoblju statistike.")}</p>
        {schedule.upcoming.length ? <ul className="dashboard-appointments">{schedule.upcoming.map(appointment => <AppointmentRow key={appointment.id} appointment={appointment} timeZone={salonTimezone} showDate />)}</ul> : <p className="dashboard-empty">{f("Nema nadolazećih aktivnih termina.")}</p>}
      </section>
    </div>
  )
}
