import {
  canUseAppointmentPermission,
  canEditAppointment,
} from '../../api/appointmentPermissions'

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Calendar.css'

const weekDays = [
  'Pon',
  'Uto',
  'Sri',
  'Čet',
  'Pet',
  'Sub',
  'Ned',
]

function formatDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatFullDate(date) {
  return new Intl.DateTimeFormat('hr-HR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function generateCalendarDays(displayedDate) {
  const displayedYear = displayedDate.getFullYear()
  const displayedMonth = displayedDate.getMonth()

  const firstDayOfMonth = new Date(
    displayedYear,
    displayedMonth,
    1
  )

  const firstDayIndex =
    (firstDayOfMonth.getDay() + 6) % 7

  const calendarStartDate = new Date(
    displayedYear,
    displayedMonth,
    1 - firstDayIndex
  )

  const calendarDays = []

  for (let dayIndex = 0; dayIndex < 42; dayIndex++) {
    const calendarDate = new Date(
      calendarStartDate.getFullYear(),
      calendarStartDate.getMonth(),
      calendarStartDate.getDate() + dayIndex
    )

    calendarDays.push({
      date: calendarDate,
      dateKey: formatDateKey(calendarDate),
      dayNumber: calendarDate.getDate(),
      isCurrentMonth:
        calendarDate.getMonth() === displayedMonth,
    })
  }

  return calendarDays
}

function Calendar({
  authContext,
  appointmentList = [],
  onRequestNewAppointment,
  onRequestEditAppointment,
  onRequestMonthChange,
  appointmentsLoading,
  appointmentsLoadError,
}) {

  const canCreateAppointment = canUseAppointmentPermission(
    authContext,
    'appointment.create',
    authContext?.membership?.employee_id
  )
  const navigate = useNavigate()
  const today = new Date()

  const [displayedDate, setDisplayedDate] = useState(today)
  const [selectedDate, setSelectedDate] = useState(today)

  const [monthInput, setMonthInput] = useState(today.getMonth())
  const [yearInput, setYearInput] = useState(String(today.getFullYear()))
  const [dateInput, setDateInput] = useState(formatDateKey(today))

  useEffect(() => {
    setMonthInput(displayedDate.getMonth())
    setYearInput(String(displayedDate.getFullYear()))
  }, [displayedDate])
  useEffect(() => { setDateInput(formatDateKey(selectedDate)) }, [selectedDate])

  function goToMonth(event) {
    event.preventDefault()
    const year = Number(yearInput)
    if (!Number.isInteger(year) || year < 1900 || year > 2100) return
    const month = Number(monthInput)
    const day = Math.min(selectedDate.getDate(), new Date(year, month + 1, 0).getDate())
    const date = new Date(year, month, day)
    setDisplayedDate(new Date(year, month, 1))
    setSelectedDate(date)
    onRequestMonthChange?.(new Date(year, month, 1))
  }

  function goToDate(event) {
    event.preventDefault()
    const parts = dateInput.split('-').map(Number)
    if (parts.length !== 3) return
    const [year, month, day] = parts
    const date = new Date(year, month - 1, day)
    if (year < 1900 || year > 2100 || formatDateKey(date) !== dateInput) return
    setSelectedDate(date)
    const first = new Date(year, month - 1, 1)
    setDisplayedDate(first)
    onRequestMonthChange?.(first)
  }

  const calendarDays = generateCalendarDays(displayedDate)

  const todayKey = formatDateKey(today)
  const selectedDateKey = formatDateKey(selectedDate)

  const displayedMonthLabel =
    new Intl.DateTimeFormat('hr-HR', {
      month: 'long',
      year: 'numeric',
    }).format(displayedDate)

  const selectedDateLabel = formatFullDate(selectedDate)

  const selectedDateAppointments = appointmentList
    .filter(
      (appointment) =>
        appointment.date === selectedDateKey
    )
    .sort(
      (firstAppointment, secondAppointment) =>
        firstAppointment.time.localeCompare(
          secondAppointment.time
        )
    )

  function getAppointmentsForDate(dateKey) {
    return appointmentList.filter(
      (appointment) => appointment.date === dateKey
    )
  }

  function showPreviousMonth() {
    const previousMonth = new Date(
      displayedDate.getFullYear(),
      displayedDate.getMonth() - 1,
      1
    )

    setSelectedDate(previousMonth)
    setDisplayedDate(previousMonth)
    onRequestMonthChange?.(previousMonth)
  }

  function showNextMonth() {
    const nextMonth = new Date(
      displayedDate.getFullYear(),
      displayedDate.getMonth() + 1,
      1
    )

    setSelectedDate(nextMonth)
    setDisplayedDate(nextMonth)
    onRequestMonthChange?.(nextMonth)
  }

  function showCurrentMonth() {
    const currentDate = new Date()

    setDisplayedDate(currentDate)
    setSelectedDate(currentDate)
    onRequestMonthChange?.(currentDate)
  }

  function selectCalendarDay(calendarDay) {
    setSelectedDate(calendarDay.date)

    if (!calendarDay.isCurrentMonth) {
      const selectedMonth = new Date(
        calendarDay.date.getFullYear(),
        calendarDay.date.getMonth(),
        1
      )

      setDisplayedDate(selectedMonth)
      onRequestMonthChange?.(selectedMonth)
    }
  }
  
function createAppointmentForSelectedDate() {
  if (!canCreateAppointment) {
    return
  }
  onRequestNewAppointment(selectedDateKey)
  navigate('/appointments')
}

function editAppointmentFromCalendar(appointmentId) {
  const appointment = appointmentList.find(
    (item) => String(item.id) === String(appointmentId)
  )

  if (!canEditAppointment(authContext, appointment)) {
    return
  }
  onRequestEditAppointment(appointmentId)
  navigate('/appointments')
}

  if (appointmentsLoading) {
    return (
      <div className="calendar-page">
        <div className="calendar-page-header">
          <div>
            <span className="calendar-eyebrow">
              Upravljanje rasporedom
            </span>

            <h1>Kalendar</h1>

            <p>
              Učitavanje termina...
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (appointmentsLoadError) {
    return (
      <div className="calendar-page">
        <div className="calendar-page-header">
          <div>
            <span className="calendar-eyebrow">
              Upravljanje rasporedom
            </span>

            <h1>Kalendar</h1>

            <p>
              Termine trenutno nije moguće učitati.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="calendar-page">
      <div className="calendar-page-header">
        <div>
          <span className="calendar-eyebrow">
            Upravljanje rasporedom
          </span>

          <h1>Kalendar</h1>

          <p>
            Odaberite mjesec, godinu ili točan datum i pregledajte termine.
          </p>
        </div>
      </div>

      <section className="calendar-panel">
        <div className="calendar-toolbar">
          <div className="calendar-navigation">
            <button
              type="button"
              className="calendar-navigation-button"
              onClick={showPreviousMonth}
              disabled={displayedDate.getFullYear() === 1900 && displayedDate.getMonth() === 0}
              aria-label="Prikaži prethodni mjesec"
            >
              ‹
            </button>

            <button
              type="button"
              className="calendar-today-button"
              onClick={showCurrentMonth}
            >
              Danas
            </button>

            <button
              type="button"
              className="calendar-navigation-button"
              onClick={showNextMonth}
              disabled={displayedDate.getFullYear() === 2100 && displayedDate.getMonth() === 11}
              aria-label="Prikaži sljedeći mjesec"
            >
              ›
            </button>
          </div>

          <h2 className="calendar-month-title" aria-live="polite">
            {displayedMonthLabel}
          </h2>

        </div>
        <div className="calendar-date-controls">
          <form onSubmit={goToMonth} className="calendar-period-form">
            <label>Mjesec
              <select aria-label="Mjesec" value={monthInput} onChange={event => setMonthInput(Number(event.target.value))}>
                {Array.from({ length: 12 }, (_, month) => <option key={month} value={month}>
                  {new Intl.DateTimeFormat('hr-HR', { month: 'long' }).format(new Date(2026, month, 1))}
                </option>)}
              </select>
            </label>
            <label>Godina
              <input type="number" min="1900" max="2100" step="1" required value={yearInput}
                onChange={event => setYearInput(event.target.value)} />
            </label>
            <button type="submit">Prikaži mjesec</button>
          </form>
          <form onSubmit={goToDate} className="calendar-jump-form">
            <label>Idi na datum
              <input type="date" min="1900-01-01" max="2100-12-31" required value={dateInput}
                onChange={event => setDateInput(event.target.value)} />
            </label>
            <button type="submit">Prikaži dan</button>
          </form>
        </div>

        <div className="calendar-weekdays">
          {weekDays.map((weekDay) => (
            <div
              key={weekDay}
              className="calendar-weekday"
            >
              {weekDay}
            </div>
          ))}
        </div>

        <div className="calendar-grid">
          {calendarDays.map((calendarDay) => {
            const dayAppointments =
              getAppointmentsForDate(
                calendarDay.dateKey
              )

            const appointmentCount =
              dayAppointments.length

            const completedCount =
              dayAppointments.filter(
                (appointment) =>
                  appointment.status === 'Završen'
              ).length

            const dayClassNames = ['calendar-day']

            if (!calendarDay.isCurrentMonth) {
              dayClassNames.push(
                'calendar-day-outside-month'
              )
            }

            if (calendarDay.dateKey === todayKey) {
              dayClassNames.push(
                'calendar-day-today'
              )
            }

            if (
              calendarDay.dateKey === selectedDateKey
            ) {
              dayClassNames.push(
                'calendar-day-selected'
              )
            }

            if (appointmentCount > 0) {
              dayClassNames.push(
                'calendar-day-has-appointments'
              )
            }

            return (
              <button
                key={calendarDay.dateKey}
                type="button"
                className={dayClassNames.join(' ')}
                disabled={calendarDay.date.getFullYear() < 1900 || calendarDay.date.getFullYear() > 2100}
                onClick={() =>
                  selectCalendarDay(calendarDay)
                }
                aria-label={`Odaberi ${formatFullDate(
                  calendarDay.date
                )}`}
                aria-pressed={
                  calendarDay.dateKey === selectedDateKey
                }
              >
                <span className="calendar-day-number">
                  {calendarDay.dayNumber}
                </span>

                {appointmentCount > 0 && (
                  <div className="calendar-day-appointments">
                    <span className="calendar-day-count">
                      {appointmentCount}{' '}
                      {appointmentCount === 1
                        ? 'termin'
                        : 'termina'}
                    </span>

                    {completedCount > 0 && (
                      <span className="calendar-day-completed-count">
                        {completedCount} završeno
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </section>

      <section className="selected-day-panel">
        <div className="selected-day-header">
          <div>
            <span className="selected-day-eyebrow">
              Odabrani datum
            </span>

            <h2>{selectedDateLabel}</h2>

            <p className="selected-day-summary">
              {selectedDateAppointments.length === 0
                ? 'Nema zakazanih termina'
                : `${selectedDateAppointments.length} ${
                    selectedDateAppointments.length === 1
                      ? 'termin'
                      : 'termina'
                  }`}
            </p>
          </div>

    {canCreateAppointment && (
  <button
    type="button"
    className="selected-day-add-button"
    onClick={createAppointmentForSelectedDate}
  >
    + Novi termin
  </button>
)}
        </div>

        {selectedDateAppointments.length === 0 ? (
          <div className="selected-day-empty-state">
            <span className="selected-day-empty-icon">
              🗓️
            </span>

            <h3>Nema termina za ovaj datum</h3>

            <p>
              Odaberite drugi datum ili dodajte novi termin
              na stranici Termini.
            </p>
          </div>
        ) : (
          <div className="selected-day-appointments">
            {selectedDateAppointments.map(
              (appointment) => {
                const isCompleted =
                  appointment.status === 'Završen'
                const canEditThisAppointment =
                  canEditAppointment(authContext, appointment)

                return (
                  <button
  key={appointment.id}
  type="button"
  className={
    isCompleted
      ? 'selected-day-appointment selected-day-appointment-completed'
      : 'selected-day-appointment'
  }
  onClick={
    canEditThisAppointment
      ? () => editAppointmentFromCalendar(appointment.id)
      : undefined
  }
  aria-disabled={!canEditThisAppointment}
  aria-label={
    canEditThisAppointment
      ? `Uredi termin za ${appointment.clientName} u ${appointment.time}`
      : `Termin za ${appointment.clientName} u ${appointment.time}`
  }
>
  <div className="selected-day-appointment-time">
    {appointment.time}
  </div>

  <div className="selected-day-appointment-info">
  <h3>{appointment.clientName}</h3>

  <p>
    {appointment.serviceName ||
      appointment.service ||
      'Nepoznata usluga'}
  </p>

  <span className="selected-day-appointment-employee">
    {appointment.employeeName ||
      'Zaposlenik nije dodijeljen'}
  </span>
</div>

  <span
    className={
      isCompleted
        ? 'selected-day-appointment-status selected-day-appointment-status-completed'
        : 'selected-day-appointment-status'
    }
  >
    {appointment.status}
  </span>
</button>
                )
              }
            )}
          </div>
        )}
      </section>
    </div>
  )
}

export default Calendar
