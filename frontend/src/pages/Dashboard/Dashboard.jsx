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
  const todayDate = getTodayDate()

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
      appointment.status !== 'Završen' &&
      appointment.time >= currentTime
  ) || null

const upcomingAppointments = appointmentList
  .filter((appointment) => {
    if (appointment.status === 'Završen') {
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

  const todayCompletedAppointments =
    todayAppointments.filter(
      (appointment) =>
        appointment.status === 'Završen'
    )

  const todayRevenue =
    todayCompletedAppointments.reduce(
      (total, appointment) =>
        total +
        (
          Number(
            appointment.servicePrice
          ) || 0
        ),
      0
    )

  return (
    <div className="dashboard">
      <DashboardCard
        title="Današnji termini"
        value={`${todayAppointments.length} termina`}
      />

      <DashboardCard
        title="Današnji prihod"
        value={`${todayRevenue.toFixed(2)} €`}
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