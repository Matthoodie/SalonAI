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
        <div className="appointment-time">
          <span className="appointment-time-label">
            Vrijeme termina
          </span>

          <strong>{appointment.time}</strong>
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

          <p>{appointment.service}</p>
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