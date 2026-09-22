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
  onCancel,
  onEdit,
  isUpdating = false,
}) {
  const isCompleted =
    appointment.statusCode === 'completed'

  const isCancelled =
    appointment.statusCode === 'cancelled'

  const isActive =
    appointment.statusCode === 'pending' ||
    appointment.statusCode === 'confirmed'

  const canCancel = isActive

  return (
    <article
      className={[
        'appointment-card',
        isCompleted ? 'appointment-card-completed' : '',
        isCancelled ? 'appointment-card-cancelled' : '',
      ]
        .filter(Boolean)
        .join(' ')}
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
          className={[
            'appointment-status',
            isCompleted
              ? 'appointment-status-completed'
              : isCancelled
                ? 'appointment-status-cancelled'
                : 'appointment-status-scheduled',
          ].join(' ')}
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
        {isActive && (
          <button
            type="button"
            className="appointment-button appointment-button-complete"
            onClick={() =>
              onComplete(appointment.id)
            }
            disabled={isUpdating}
          >
            {isUpdating
              ? 'Ažuriranje...'
              : 'Označi kao završen'}
          </button>
        )}

        <button
          type="button"
          className="appointment-button appointment-button-edit"
          onClick={() => onEdit(appointment)}
        >
          Uredi
        </button>

        {canCancel && (
          <button
            type="button"
            className="appointment-button appointment-button-delete"
            onClick={() =>
              onCancel(appointment.id)
            }
            disabled={isUpdating}
          >
            {isUpdating
              ? 'Ažuriranje...'
              : 'Otkaži termin'}
          </button>
        )}
      </div>
    </article>
  )
}

export default AppointmentCard