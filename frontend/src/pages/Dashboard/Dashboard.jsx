import { useEffect, useState } from 'react'
import { appointmentCount, formatDate, formatMoney, periodRange, salonDate, scheduleView, summarizeAppointments } from './dashboardView.js'
import './Dashboard.css'

const periods = [['today', 'Danas'], ['yesterday', 'Jučer'], ['last7', '7 dana'], ['last30', '30 dana'], ['custom', 'Odabrani datum'], ['range', 'Raspon datuma']]
const statusLabels = { pending: 'Na čekanju', confirmed: 'Zakazano', completed: 'Završen', cancelled: 'Otkazano', no_show: 'Nedolazak' }

function AppointmentRow({ appointment, timeZone, showDate = false }) {
  const time = new Intl.DateTimeFormat('hr-HR', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(appointment.startsAt))
  return (
    <li className="dashboard-appointment">
      <div className="dashboard-appointment-time">
        {showDate && <span>{formatDate(salonDate(appointment.startsAt, timeZone))}</span>}
        <strong>{time}</strong>
      </div>
      <div className="dashboard-appointment-person">
        <strong>{appointment.clientName || 'Nepoznat klijent'}</strong>
        <span>{appointment.serviceName || appointment.service || 'Nepoznata usluga'}</span>
        {appointment.employeeName && <small>{appointment.employeeName}</small>}
      </div>
      <span className={`dashboard-status dashboard-status-${appointment.statusCode}`}>{statusLabels[appointment.statusCode] || appointment.status}</span>
    </li>
  )
}

export default function Dashboard({ appointmentList = [], clientList = [], salonTimezone, canManage = false }) {
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
  if (!salonTimezone) return <div className="dashboard"><p role="alert">Nedostaje vremenska zona salona. Ponovno učitajte aplikaciju.</p></div>
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
    ['Evidentirani termini', appointmentCount(stats.total), 'Svi statusi u odabranom razdoblju.'],
    ['Vrijednost odrađenih usluga', formatMoney(stats.valueCents), 'Prema spremljenim cijenama završenih termina; nije evidencija naplate.'],
    ['Aktivni termini', appointmentCount(stats.active), 'Na čekanju i zakazani.'],
    ['Završeni termini', appointmentCount(stats.completed), 'Termini označeni kao završeni.'],
    ['Otkazani termini', appointmentCount(stats.cancelled), 'Termini označeni kao otkazani.'],
    ['Nedolasci', appointmentCount(stats.noShow), 'Klijent nije došao na termin.'],
  ] : []
  return (
    <div className="dashboard">
      <header className="dashboard-heading">
        <p className="dashboard-eyebrow">{canManage ? 'VAŠ SALON' : 'VAŠ PREGLED'}</p>
        <h1>Pregled poslovanja</h1>
        <p>{canManage ? 'Pratite termine i vrijednost odrađenih usluga u odabranom razdoblju.' : 'Pregled termina koji su dostupni vašem računu u odabranom salonu.'}</p>
      </header>
      <section className="dashboard-panel" aria-labelledby="dashboard-period-heading">
        <h2 id="dashboard-period-heading">Razdoblje pregleda</h2>
        <div className="dashboard-period-buttons">
          {periods.map(([value, label]) => <button key={value} type="button" aria-pressed={period === value} className={period === value ? 'is-active' : ''} onClick={() => choosePeriod(value)}>{label}</button>)}
        </div>
        {custom && <form className="dashboard-range-form" onSubmit={applyRange} noValidate>
          <label htmlFor="dashboard-from">{period === 'custom' ? 'Datum' : 'Od'}<input id="dashboard-from" type="date" min="0001-01-01" max="9999-12-31" value={draftFrom} onChange={event => { setDraftFrom(event.target.value); setAppliedRange(null); setError('') }} /></label>
          {period === 'range' && <label htmlFor="dashboard-to">Do<input id="dashboard-to" type="date" min="0001-01-01" max="9999-12-31" value={draftTo} onChange={event => { setDraftTo(event.target.value); setAppliedRange(null); setError('') }} /></label>}
          <button type="submit" className="dashboard-primary">Prikaži razdoblje</button>
        </form>}
        {error && <p role="alert" className="dashboard-error">{error}</p>}
        {range ? <p className="dashboard-period-note" role="status">Prikaz: <strong>{range.from === range.to ? formatDate(range.from) : `${formatDate(range.from)} – ${formatDate(range.to)}`}</strong>. Uključena su oba datuma, prema početku termina u vremenskoj zoni salona ({salonTimezone}).</p>
          : <p className="dashboard-period-note">Odaberite {period === 'custom' ? 'datum' : 'početni i završni datum'} pa kliknite „Prikaži razdoblje”.</p>}
      </section>
      {stats && <>
        <section className="dashboard-metrics" aria-label="Statistika odabranog razdoblja">
          {cards.map(([title, value, note]) => <article className="dashboard-metric" key={title}><h2>{title}</h2><strong>{value}</strong><p>{note}</p></article>)}
        </section>
        {stats.missingPrices > 0 && <p className="dashboard-error" role="alert">Za {stats.missingPrices} završenih termina nedostaje valjana cijena. Prikazana vrijednost nije potpuna.</p>}
        {stats.total === 0 && <p className="dashboard-empty-period">U odabranom razdoblju nema evidentiranih termina.</p>}
      </>}
      {canManage && <p className="dashboard-client-summary">Klijenti u učitanom popisu salona: <strong>{clientList.length}</strong>. Ovaj broj ne ovisi o odabranom razdoblju.</p>}
      <section className="dashboard-panel" aria-labelledby="dashboard-today-heading">
        <div className="dashboard-section-heading"><div><p className="dashboard-eyebrow">{formatDate(today)}</p><h2 id="dashboard-today-heading">Današnji raspored</h2></div><span>{appointmentCount(schedule.today.length)}</span></div>
        <p className="dashboard-section-note">Današnji termini, neovisno o razdoblju statistike.</p>
        {schedule.today.length ? <ul className="dashboard-appointments">{schedule.today.map(appointment => <AppointmentRow key={appointment.id} appointment={appointment} timeZone={salonTimezone} />)}</ul> : <p className="dashboard-empty">Danas nema evidentiranih termina.</p>}
      </section>
      <section className="dashboard-panel" aria-labelledby="dashboard-upcoming-heading">
        <div className="dashboard-section-heading"><div><p className="dashboard-eyebrow">SLJEDEĆE</p><h2 id="dashboard-upcoming-heading">Nadolazeći termini</h2></div>{schedule.upcoming.length > 0 && <span>{appointmentCount(schedule.upcoming.length)}</span>}</div>
        <p className="dashboard-section-note">Do pet sljedećih aktivnih termina, neovisno o razdoblju statistike.</p>
        {schedule.upcoming.length ? <ul className="dashboard-appointments">{schedule.upcoming.map(appointment => <AppointmentRow key={appointment.id} appointment={appointment} timeZone={salonTimezone} showDate />)}</ul> : <p className="dashboard-empty">Nema nadolazećih aktivnih termina.</p>}
      </section>
    </div>
  )
}
