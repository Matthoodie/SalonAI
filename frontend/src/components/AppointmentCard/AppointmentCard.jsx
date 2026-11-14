import {useLanguage} from '../Language/LanguageProvider'
import {bookingText,bookingPrice} from '../Language/bookingText.js'
import {overviewRecipient,overviewStatus,overviewLocale} from '../Language/overviewText.js'
import './AppointmentCard.css'

function formatAppointmentDate(date,language) {
  if (!date) {
    return bookingText(language,'Datum nije naveden')
  }

  const [year, month, day] = date.split('-')

  const localDate = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  )

  return new Intl.DateTimeFormat(overviewLocale(language), {
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
  canEdit = false,
  canChangeStatus = false,
}) {
  const {language}=useLanguage()
  const f=source=>bookingText(language,source)

  const isCompleted =
    appointment.statusCode === 'completed'

  const isCancelled =
    appointment.statusCode === 'cancelled'

  const isActive =
    appointment.statusCode === 'pending' ||
    appointment.statusCode === 'confirmed'

  const canCancel = isActive && canChangeStatus

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
            <span className="appointment-date-label">{f("Datum")} </span>

            <strong>
              {formatAppointmentDate(appointment.date,language)}
            </strong>
          </div>

          <div className="appointment-time">
            <span className="appointment-time-label">{f("Vrijeme")} </span>

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
          {(isCompleted ? '✓ ' : '') + overviewStatus(language,appointment)}
        </span>
      </div>

      <div className="appointment-info">
        <div className="appointment-detail">
          <span className="appointment-detail-label">
            {appointment.petId?f('Ljubimac i vlasnik'):f('Klijent')}
          </span>

          <h3>{overviewRecipient(language,appointment)}</h3>
        </div>

        <div className="appointment-detail">
          <span className="appointment-detail-label">{f("Usluga")} </span>

          {appointment.items?.length ? (
            <ul className="appointment-item-list">{appointment.items.map(item => (
              <li key={item.service_id}><span>{item.name}</span><small>{item.duration_minutes} min · {bookingPrice(language,item.price_cents)}</small></li>
            ))}</ul>
          ) : <p>{appointment.serviceName || appointment.service || f('Nepoznata usluga')}</p>}
          <p><strong>{f("Ukupno:")} {appointment.durationMinutes} min · {bookingPrice(language,appointment.priceCents)}</strong></p>
        </div>
        <div className="appointment-detail">
          <span className="appointment-detail-label">{f("Zaposlenik")} </span>

          <p>
            {appointment.employeeName ||
              f('Nije dodijeljen')}
          </p>
        </div>
      </div>
      {(canEdit || (isActive && canChangeStatus)) && (
        <div className="appointment-actions">
          {isActive && canChangeStatus && (
            <button
              type="button"
              className="appointment-button appointment-button-complete"
              onClick={() => onComplete(appointment.id)}
              disabled={isUpdating}
            >
              {isUpdating ? f('Ažuriranje...') : f('Označi kao završen')}
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              className="appointment-button appointment-button-edit"
              onClick={() => onEdit(appointment)}
              disabled={isUpdating}
            >{f("Uredi")} </button>
          )}

          {canCancel && (
            <button
              type="button"
              className="appointment-button appointment-button-delete"
              onClick={() => onCancel(appointment.id)}
              disabled={isUpdating}
            >
              {isUpdating ? f('Ažuriranje...') : f('Otkaži termin')}
            </button>
          )}
        </div>
      )}
    </article>
  )
}

export default AppointmentCard
