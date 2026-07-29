import { useEffect, useRef, useState } from 'react'

const timeOptions = []

for (let hour = 7; hour <= 21; hour++) {
  for (let minute = 0; minute < 60; minute += 15) {
    const formattedHour = String(hour).padStart(2, '0')
    const formattedMinute = String(minute).padStart(2, '0')

    timeOptions.push(`${formattedHour}:${formattedMinute}`)
  }
}

function AppointmentForm({
  appointments,
  onAddAppointment,
  onUpdateAppointment,
  onCancelEdit,
  editingAppointment,
}) {
  const [time, setTime] = useState('')
  const [clientName, setClientName] = useState('')
  const [service, setService] = useState('')

  const [errors, setErrors] = useState({
    time: '',
    clientName: '',
    service: '',
  })

  const timeInputRef = useRef(null)
  const clientNameInputRef = useRef(null)
  const serviceInputRef = useRef(null)

  useEffect(() => {
    if (editingAppointment) {
      setTime(editingAppointment.time)
      setClientName(editingAppointment.clientName)
      setService(editingAppointment.service)
    } else {
      setTime('')
      setClientName('')
      setService('')
    }

    setErrors({
      time: '',
      clientName: '',
      service: '',
    })
  }, [editingAppointment])

  function handleSubmit() {
    const isTimeAlreadyTaken = appointments.some((appointment) => {
      const hasSameTime = appointment.time === time

      const isDifferentAppointment =
        !editingAppointment ||
        appointment.id !== editingAppointment.id

      return hasSameTime && isDifferentAppointment
    })

    const newErrors = {
      time: !time
        ? 'Odaberite vrijeme termina.'
        : isTimeAlreadyTaken
          ? `Termin u ${time} je već zauzet.`
          : '',

      clientName: clientName.trim()
        ? ''
        : 'Upišite ime klijenta.',

      service: service.trim()
        ? ''
        : 'Upišite uslugu.',
    }

    setErrors(newErrors)

    const hasErrors = Object.values(newErrors).some(
      (errorMessage) => errorMessage !== ''
    )

    if (hasErrors) {
      if (newErrors.time) {
        timeInputRef.current?.focus()
      } else if (newErrors.clientName) {
        clientNameInputRef.current?.focus()
      } else if (newErrors.service) {
        serviceInputRef.current?.focus()
      }

      return
    }

    if (editingAppointment) {
      onUpdateAppointment({
        ...editingAppointment,
        time,
        clientName: clientName.trim(),
        service: service.trim(),
      })
    } else {
      onAddAppointment({
        id: Date.now(),
        time,
        clientName: clientName.trim(),
        service: service.trim(),
        status: 'Zakazano',
      })
    }

    setTime('')
    setClientName('')
    setService('')

    setErrors({
      time: '',
      clientName: '',
      service: '',
    })
  }

  function handleTimeChange(event) {
    setTime(event.target.value)

    if (errors.time) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        time: '',
      }))
    }
  }

  function handleClientNameChange(event) {
    setClientName(event.target.value)

    if (errors.clientName) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        clientName: '',
      }))
    }
  }

  function handleServiceChange(event) {
    setService(event.target.value)

    if (errors.service) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        service: '',
      }))
    }
  }

  return (
    <div className="appointment-form">
      <h2>
        {editingAppointment ? 'Uredi termin' : 'Novi termin'}
      </h2>

      <div className="form-field">
        <label htmlFor="appointment-time">
          Vrijeme
        </label>

        {editingAppointment ? (
          <input
            id="appointment-time"
            ref={timeInputRef}
            className={errors.time ? 'input-error' : ''}
            type="time"
            value={time}
            step="60"
            onChange={handleTimeChange}
          />
        ) : (
          <select
            id="appointment-time"
            ref={timeInputRef}
            className={errors.time ? 'input-error' : ''}
            value={time}
            onChange={handleTimeChange}
          >
            <option value="">
              Odaberite vrijeme
            </option>

            {timeOptions.map((timeOption) => (
              <option
                key={timeOption}
                value={timeOption}
              >
                {timeOption}
              </option>
            ))}
          </select>
        )}

        <p
          className={
            errors.time
              ? 'form-error form-error-visible'
              : 'form-error'
          }
        >
          {errors.time || '\u00A0'}
        </p>
      </div>

      <div className="form-field">
        <label htmlFor="client-name">
          Ime klijenta
        </label>

        <input
          id="client-name"
          ref={clientNameInputRef}
          className={errors.clientName ? 'input-error' : ''}
          type="text"
          value={clientName}
          onChange={handleClientNameChange}
        />

        <p
          className={
            errors.clientName
              ? 'form-error form-error-visible'
              : 'form-error'
          }
        >
          {errors.clientName || '\u00A0'}
        </p>
      </div>

      <div className="form-field">
        <label htmlFor="appointment-service">
          Usluga
        </label>

        <input
          id="appointment-service"
          ref={serviceInputRef}
          className={errors.service ? 'input-error' : ''}
          type="text"
          value={service}
          onChange={handleServiceChange}
        />

        <p
          className={
            errors.service
              ? 'form-error form-error-visible'
              : 'form-error'
          }
        >
          {errors.service || '\u00A0'}
        </p>
      </div>

      <div className="form-actions">
        <button
          type="button"
          className="primary-button"
          onClick={handleSubmit}
        >
          {editingAppointment
            ? 'Spremi promjene'
            : 'Dodaj termin'}
        </button>

        {editingAppointment && (
          <button
            type="button"
            className="secondary-button"
            onClick={onCancelEdit}
          >
            Odustani
          </button>
        )}
      </div>
    </div>
  )
}

export default AppointmentForm