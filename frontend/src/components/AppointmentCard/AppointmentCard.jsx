import './AppointmentCard.css'

function formatAppointmentDate(date) {
  if (!date) {
    return 'Datum nije naveden'
  }

  const [year, month, day] = date.split('-')

  const localDate = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  )

  return new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(localDate)
}

function AppointmentCard({
  appointment,
  onComplete,
  onDelete,
  onEdit,
}) {
  const isCompleted = appointment.status === 'Završen'

  return (
    <article
      className={
        isCompleted
          ? 'appointment-card appointment-card-completed'
          : 'appointment-card'
      }
    >
      <div className="appointment-card-header">
        <div className="appointment-schedule">
          <div className="appointment-date">
            <span className="appointment-date-label">
              Datum
            </span>

            <strong>
              {formatAppointmentDate(appointment.date)}
            </strong>
          </div>

          <div className="appointment-time">
            <span className="appointment-time-label">
              Vrijeme
            </span>

            <strong>{appointment.time}</strong>
          </div>
        </div>

        <span
          className={
            isCompleted
              ? 'appointment-status appointment-status-completed'
              : 'appointment-status appointment-status-scheduled'
          }
        >
          {isCompleted ? '✓ Završen' : appointment.status}
        </span>
      </div>

      <div className="appointment-info">
        <div className="appointment-detail">
          <span className="appointment-detail-label">
            Klijent
          </span>

          <h3>{appointment.clientName}</h3>
        </div>

        <div className="appointment-detail">
          <span className="appointment-detail-label">
            Usluga
          </span>

          <p>
  {appointment.serviceName ||
    appointment.service ||
    'Nepoznata usluga'}
</p>
        </div>
  <div className="appointment-detail">
  <span className="appointment-detail-label">
    Zaposlenik
  </span>

  <p>
    {appointment.employeeName ||
      'Nije dodijeljen'}
  </p>
</div>
  </div>
   <div className="appointment-actions">
        {!isCompleted && (
          <button
            type="button"
            className="appointment-button appointment-button-complete"
            onClick={() => onComplete(appointment.id)}
          >
            Označi kao završen
          </button>
        )}

        <button
          type="button"
          className="appointment-button appointment-button-edit"
          onClick={() => onEdit(appointment)}
        >
          Uredi
        </button>

        <button
          type="button"
          className="appointment-button appointment-button-delete"
          onClick={() => onDelete(appointment.id)}
        >
          Obriši
        </button>
      </div>
    </article>
  )
}

export default AppointmentCard