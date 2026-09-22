import { useState } from 'react'

import DashboardCard from '../../components/DashboardCard/DashboardCard'
import './Dashboard.css'

function getTodayDate() {
  const today = new Date()
  const timezoneOffset =
    today.getTimezoneOffset() * 60_000

  const localDate = new Date(
    today.getTime() - timezoneOffset
  )

  return localDate
    .toISOString()
    .split('T')[0]
}

function formatDashboardDate(date) {
  if (!date) {
    return ''
  }

  const [year, month, day] =
    date.split('-')

  const localDate = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  )

  return new Intl.DateTimeFormat(
    'hr-HR',
    {
      day: 'numeric',
      month: 'short',
    }
  ).format(localDate)
}

function Dashboard({
  appointmentList = [],
  clientList = [],
}) {
  const [selectedPeriod, setSelectedPeriod] =
    useState('today')

  const [customDate, setCustomDate] =
    useState(getTodayDate())

  const todayDate = getTodayDate()
  const yesterdayDate = new Date(
    `${todayDate}T12:00:00`
  )

  yesterdayDate.setDate(
    yesterdayDate.getDate() - 1
  )

  const selectedDate =
    selectedPeriod === 'custom'
      ? customDate
      : selectedPeriod === 'yesterday'
        ? [
          yesterdayDate.getFullYear(),
          String(
            yesterdayDate.getMonth() + 1
          ).padStart(2, '0'),
          String(
            yesterdayDate.getDate()
          ).padStart(2, '0'),
        ].join('-')
        : todayDate

  const rangeStartDate = new Date(
    `${todayDate}T12:00:00`
  )

  rangeStartDate.setDate(
    rangeStartDate.getDate() -
    (selectedPeriod === 'last7' ? 6 : 29)
  )

  const rangeStartDateText = [
    rangeStartDate.getFullYear(),
    String(
      rangeStartDate.getMonth() + 1
    ).padStart(2, '0'),
    String(
      rangeStartDate.getDate()
    ).padStart(2, '0'),
  ].join('-')

  const selectedDateAppointments =
    appointmentList.filter(
      (appointment) => {
        if (
          selectedPeriod === 'last7' ||
          selectedPeriod === 'last30'
        ) {
          return (
            appointment.date >= rangeStartDateText &&
            appointment.date <= todayDate
          )
        }

        return appointment.date === selectedDate
      }
    )

  const selectedDateCompletedAppointments =
    selectedDateAppointments.filter(
      (appointment) =>
        appointment.statusCode === 'completed'
    )

  const selectedDateRevenueCents =
    selectedDateCompletedAppointments.reduce(
      (total, appointment) =>
        total + (Number(appointment.priceCents) || 0),
      0
    )

  const selectedPeriodLabel =
    selectedPeriod === 'yesterday'
      ? 'Jučer'
      : selectedPeriod === 'last7'
        ? 'Posljednjih 7 dana'
        : selectedPeriod === 'last30'
          ? 'Posljednjih 30 dana'
          : selectedPeriod === 'custom'
            ? `Odabrani datum (${customDate})`
            : 'Danas'

  const todayAppointments =
    appointmentList.filter(
      (appointment) =>
        appointment.date === todayDate
    )

  const sortedTodayAppointments = [
    ...todayAppointments,
  ].sort(
    (
      firstAppointment,
      secondAppointment
    ) =>
      firstAppointment.time.localeCompare(
        secondAppointment.time
      )
  )


  const currentTime =
    new Date().toLocaleTimeString(
      'hr-HR',
      {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }
    )

const nextTodayAppointment =
  sortedTodayAppointments.find(
    (appointment) =>
      ['pending', 'confirmed'].includes(
        appointment.statusCode
      ) &&
      appointment.time >= currentTime
  ) || null

  const upcomingAppointments = appointmentList
    .filter((appointment) => {
    if (
      !['pending', 'confirmed'].includes(
        appointment.statusCode
      )
    ) {
      return false
    }

      if (appointment.date > todayDate) {
        return true
      }

      if (
        appointment.date === todayDate &&
        appointment.time >= currentTime
      ) {
        return true
      }

      return false
    })
    .sort((firstAppointment, secondAppointment) => {
      const firstDateTime =
        `${firstAppointment.date} ${firstAppointment.time}`

      const secondDateTime =
        `${secondAppointment.date} ${secondAppointment.time}`

      return firstDateTime.localeCompare(
        secondDateTime
      )
    })
    .slice(0, 5)

  return (
    <div className="dashboard">
      <section
        className="dashboard-period-selector"
        aria-label="Odabir razdoblja statistike"
      >
        <h2>Pregled poslovanja</h2>

        <div className="dashboard-period-buttons">
          <button
            type="button"
            className={`dashboard-period-button ${selectedPeriod === 'today'
              ? 'is-active'
              : ''
              }`}
            onClick={() => setSelectedPeriod('today')}
            aria-pressed={selectedPeriod === 'today'}
          >
            Danas
          </button>

          <button
            type="button"
            className={`dashboard-period-button ${selectedPeriod === 'yesterday'
              ? 'is-active'
              : ''
              }`}
            onClick={() => setSelectedPeriod('yesterday')}
            aria-pressed={selectedPeriod === 'yesterday'}
          >
            Jučer
          </button>
          <button
            type="button"
            className={`dashboard-period-button ${selectedPeriod === 'last7'
              ? 'is-active'
              : ''
              }`}
            onClick={() => setSelectedPeriod('last7')}
            aria-pressed={selectedPeriod === 'last7'}
          >
            7 dana
          </button>

          <button
            type="button"
            className={`dashboard-period-button ${selectedPeriod === 'last30'
              ? 'is-active'
              : ''
              }`}
            onClick={() => setSelectedPeriod('last30')}
            aria-pressed={selectedPeriod === 'last30'}
          >
            30 dana
          </button>

          <button
            type="button"
            className={`dashboard-period-button ${selectedPeriod === 'custom'
              ? 'is-active'
              : ''
              }`}
            onClick={() => setSelectedPeriod('custom')}
            aria-pressed={selectedPeriod === 'custom'}
          >
            Odabrani datum
          </button>
        </div>
        {selectedPeriod === 'custom' && (
          <label className="dashboard-custom-date">
            Datum
            <input
              type="date"
              value={customDate}
              onChange={(event) =>
                setCustomDate(event.target.value)
              }
            />
          </label>
        )}
      </section>
      <DashboardCard
        title={`Termini — ${selectedPeriodLabel}`}
        value={`${selectedDateAppointments.length} termina`}
      />

      <DashboardCard
        title={`Vrijednost odrađenih usluga — ${selectedPeriodLabel}`}
        value={`${(selectedDateRevenueCents / 100).toFixed(2)} €`}
      />

      <DashboardCard
        title="Ukupno klijenata"
        value={clientList.length}
      />


      <section className="dashboard-schedule">
        <div className="dashboard-section-header">
          <div>
            <span className="dashboard-section-eyebrow">
              Danas
            </span>

            <h2>Današnji raspored</h2>
          </div>

          <strong>
            {todayAppointments.length}
            {' '}
            {todayAppointments.length === 1
              ? 'termin'
              : 'termina'}
          </strong>
        </div>

        {sortedTodayAppointments.length === 0 ? (
          <div className="dashboard-schedule-empty">
            <span>📅</span>

            <div>
              <strong>
                Danas nema termina
              </strong>

              <p>
                Raspored za danas je prazan.
              </p>
            </div>
          </div>
        ) : (
          <div className="dashboard-schedule-list">
            {sortedTodayAppointments.map(
              (appointment) => {
                const isNext =
                  nextTodayAppointment?.id ===
                  appointment.id

                const isCompleted =
                  appointment.status ===
                  'Završen'

                return (
                  <div
                    key={appointment.id}
                    className={[
                      'dashboard-schedule-item',
                      isNext
                        ? 'dashboard-schedule-item-next'
                        : '',
                      isCompleted
                        ? 'dashboard-schedule-item-completed'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <div className="dashboard-schedule-time">
                      {appointment.time}
                    </div>

                    <div className="dashboard-schedule-client">
                      <strong>
                        {appointment.clientName}
                      </strong>

                      <span>
                        {appointment.serviceName ||
                          appointment.service ||
                          'Nepoznata usluga'}
                      </span>
                    </div>

                    <div className="dashboard-schedule-status">
                      {isCompleted
                        ? 'Završen'
                        : isNext
                          ? 'Sljedeći'
                          : appointment.status}
                    </div>
                  </div>
                )
              }
            )}
          </div>
        )}
      </section>

      <section className="dashboard-upcoming">
        <div className="dashboard-section-header">
          <div>
            <span className="dashboard-section-eyebrow">
              Sljedeće
            </span>

            <h2>Nadolazeći termini</h2>
          </div>

          <strong>
            Prvih {upcomingAppointments.length}
          </strong>
        </div>

        {upcomingAppointments.length === 0 ? (
          <div className="dashboard-schedule-empty">
            <span>✨</span>

            <div>
              <strong>
                Nema nadolazećih termina
              </strong>

              <p>
                Trenutno nema budućih rezervacija.
              </p>
            </div>
          </div>
        ) : (
          <div className="dashboard-upcoming-list">
            {upcomingAppointments.map(
              (appointment) => (
                <div
                  key={appointment.id}
                  className="dashboard-upcoming-item"
                >
                  <div className="dashboard-upcoming-date">
                    <strong>
                      {formatDashboardDate(
                        appointment.date
                      )}
                    </strong>

                    <span>
                      {appointment.time}
                    </span>
                  </div>

                  <div className="dashboard-upcoming-client">
                    <strong>
                      {appointment.clientName}
                    </strong>

                    <span>
                      {appointment.serviceName ||
                        appointment.service ||
                        'Nepoznata usluga'}
                    </span>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>

    </div>
  )
}

export default Dashboard