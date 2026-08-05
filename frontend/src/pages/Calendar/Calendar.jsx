import { useState } from 'react'
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
  appointmentList = [],
  onRequestNewAppointment,
  onRequestEditAppointment,
}) {

  const navigate = useNavigate()
  const today = new Date()

  const [displayedDate, setDisplayedDate] = useState(today)
  const [selectedDate, setSelectedDate] = useState(today)

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
    setDisplayedDate((currentDate) => {
      return new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - 1,
        1
      )
    })
  }

  function showNextMonth() {
    setDisplayedDate((currentDate) => {
      return new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        1
      )
    })
  }

  function showCurrentMonth() {
    const currentDate = new Date()

    setDisplayedDate(currentDate)
    setSelectedDate(currentDate)
  }

  function selectCalendarDay(calendarDay) {
    setSelectedDate(calendarDay.date)

    if (!calendarDay.isCurrentMonth) {
      setDisplayedDate(
        new Date(
          calendarDay.date.getFullYear(),
          calendarDay.date.getMonth(),
          1
        )
      )
    }
  }
  
function createAppointmentForSelectedDate() {
  onRequestNewAppointment(selectedDateKey)
  navigate('/appointments')
}

function editAppointmentFromCalendar(appointmentId) {
  onRequestEditAppointment(appointmentId)
  navigate('/appointments')
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
            Pregledajte termine po danima, tjednima i mjesecima.
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
              aria-label="Prikaži sljedeći mjesec"
            >
              ›
            </button>
          </div>

          <h2 className="calendar-month-title">
            {displayedMonthLabel}
          </h2>

          <div className="calendar-view-switcher">
            <button
              type="button"
              className="calendar-view-button calendar-view-button-active"
            >
              Mjesec
            </button>

            <button
              type="button"
              className="calendar-view-button"
              disabled
            >
              Tjedan
            </button>

            <button
              type="button"
              className="calendar-view-button"
              disabled
            >
              Dan
            </button>
          </div>
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

    <button
  type="button"
  className="selected-day-add-button"
  onClick={createAppointmentForSelectedDate}
>
  + Novi termin
</button>
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

                return (
                  <button
  key={appointment.id}
  type="button"
  className={
    isCompleted
      ? 'selected-day-appointment selected-day-appointment-completed'
      : 'selected-day-appointment'
  }
  onClick={() =>
    editAppointmentFromCalendar(appointment.id)
  }
  aria-label={`Uredi termin za ${appointment.clientName} u ${appointment.time}`}
>
  <div className="selected-day-appointment-time">
    {appointment.time}
  </div>

  <div className="selected-day-appointment-info">
    <h3>{appointment.clientName}</h3>

    <p>{appointment.service}</p>
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