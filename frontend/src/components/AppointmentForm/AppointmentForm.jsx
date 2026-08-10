import { useEffect, useRef, useState } from 'react'
import './AppointmentForm.css'

const timeOptions = []

for (let hour = 7; hour <= 21; hour++) {
  for (let minute = 0; minute < 60; minute += 15) {
    const formattedHour = String(hour).padStart(2, '0')
    const formattedMinute = String(minute).padStart(2, '0')

    timeOptions.push(
      `${formattedHour}:${formattedMinute}`
    )
  }
}

function getTodayDate() {
  const today = new Date()
  const timezoneOffset =
    today.getTimezoneOffset() * 60_000

  const localDate = new Date(
    today.getTime() - timezoneOffset
  )

  return localDate.toISOString().split('T')[0]
}

function AppointmentForm({
  appointments = [],
  serviceList = [],
  clientList = [],
  onAddAppointment,
  onUpdateAppointment,
  onCancelEdit,
  editingAppointment,
  initialDate = '',
}) {

  const activeServices = serviceList.filter(
    (serviceItem) => serviceItem.active
  )

  const editingClientName =
  editingAppointment?.clientName || ''

const isLegacyEditingClient =
  Boolean(
    editingAppointment &&
    !editingAppointment.clientId &&
    editingClientName
  )
  
  const editingServiceName =
  editingAppointment?.serviceName ||
  editingAppointment?.service ||
  ''
const isLegacyEditingService =
  Boolean(
    editingAppointment &&
    editingServiceName &&
    !serviceList.some(
      (serviceItem) =>
        serviceItem.name === editingServiceName
    )
  )


  const [date, setDate] = useState(getTodayDate())
  const [time, setTime] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientId, setClientId] = useState('')
  const [service, setService] = useState('')

  const [errors, setErrors] = useState({
    date: '',
    time: '',
    clientName: '',
    service: '',
  })

  const dateInputRef = useRef(null)
  const timeInputRef = useRef(null)
  const clientNameInputRef = useRef(null)
  const serviceInputRef = useRef(null)

  useEffect(() => {
    if (editingAppointment) {
      setDate(
        editingAppointment.date || getTodayDate()
      )

      setTime(editingAppointment.time)
      setClientName(editingAppointment.clientName)

  const matchingClient = clientList.find(
     (client) =>
      client.id === editingAppointment.clientId ||
      client.name === editingAppointment.clientName
)

setClientId(
  matchingClient
    ? String(matchingClient.id)
    : ''
)

      setService(
        editingAppointment.serviceName ||
        editingAppointment.service ||
        ''
)
    } else {
      setDate(initialDate || getTodayDate())
      setTime('')
      setClientName('')
      setClientId('')
      setService('')
    }

    setErrors({
      date: '',
      time: '',
      clientName: '',
      service: '',
    })
  }, [editingAppointment, initialDate])

 function handleSubmit() {
  const isAppointmentAlreadyTaken =
    appointments.some((appointment) => {
      const hasSameDate =
        appointment.date === date

      const hasSameTime =
        appointment.time === time

      const isDifferentAppointment =
        !editingAppointment ||
        appointment.id !== editingAppointment.id

      return (
        hasSameDate &&
        hasSameTime &&
        isDifferentAppointment
      )
    })

  const selectedService = serviceList.find(
    (serviceItem) =>
      serviceItem.name === service
  )

  const selectedClient = clientList.find(
  (client) =>
    String(client.id) === clientId
)

  const isUnchangedLegacyClient =
  isLegacyEditingClient &&
  !selectedClient &&
  clientName === editingClientName

  const isUnchangedLegacyService =
  isLegacyEditingService &&
  service === editingServiceName

  const newErrors = {
      date: date
        ? ''
        : 'Odaberite datum termina.',

      time: !time
        ? 'Odaberite vrijeme termina.'
        : isAppointmentAlreadyTaken
          ? `Termin ${date} u ${time} je već zauzet.`
          : '',

     clientName:
  selectedClient ||
  isUnchangedLegacyClient
    ? ''
    : 'Odaberite klijenta.',

      service:
  selectedService ||
  isUnchangedLegacyService
    ? ''
    : 'Odaberite uslugu.',
    }

    setErrors(newErrors)

    const hasErrors = Object.values(
      newErrors
    ).some(
      (errorMessage) => errorMessage !== ''
    )

    if (hasErrors) {
      if (newErrors.date) {
        dateInputRef.current?.focus()
      } else if (newErrors.time) {
        timeInputRef.current?.focus()
      } else if (newErrors.clientName) {
        clientNameInputRef.current?.focus()
      } else if (newErrors.service) {
        serviceInputRef.current?.focus()
      }

      return
    }

 if (editingAppointment) {
  if (selectedService) {
    onUpdateAppointment({
      ...editingAppointment,

      date,
      time,

      clientId: selectedClient
        ? selectedClient.id
        : null,

      clientName: selectedClient
        ? selectedClient.name
        : clientName.trim(),

      service: selectedService.name,

      serviceId: selectedService.id,
      serviceName: selectedService.name,
      servicePrice: selectedService.price,
      serviceDurationMinutes:
        selectedService.defaultDurationMinutes,
    })
  } else {
    onUpdateAppointment({
      ...editingAppointment,

      date,
      time,

      clientId: selectedClient
        ? selectedClient.id
        : null,

      clientName: selectedClient
        ? selectedClient.name
        : clientName.trim(),

      service: editingServiceName,

      serviceId: null,
      serviceName: editingServiceName,
      servicePrice: null,
      serviceDurationMinutes: null,
    })
  }
} else {
  onAddAppointment({
    id: Date.now(),

    date,
    time,

    clientId: selectedClient.id,
    clientName: selectedClient.name,

    service: selectedService.name,

    serviceId: selectedService.id,
    serviceName: selectedService.name,
    servicePrice: selectedService.price,
    serviceDurationMinutes:
      selectedService.defaultDurationMinutes,

    status: 'Zakazano',
  })
}


setDate(getTodayDate())
setTime('')
setClientName('')
setClientId('')
setService('')

    setErrors({
      date: '',
      time: '',
      clientName: '',
      service: '',
    })
  }

  function handleDateChange(event) {
    setDate(event.target.value)

    if (errors.date || errors.time) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        date: '',
        time: '',
      }))
    }
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
        {editingAppointment
          ? 'Uredi termin'
          : 'Novi termin'}
      </h2>

    <div className="form-field">
  <label htmlFor="appointment-date">
    Datum
  </label>

  <input
    id="appointment-date"
    ref={dateInputRef}
    className={
      errors.date
        ? 'input-error'
        : ''
    }
    type="date"
    value={date}
    onChange={handleDateChange}
  />

  <p
    className={
      errors.date
        ? 'form-error form-error-visible'
        : 'form-error'
    }
  >
    {errors.date || '\u00A0'}
  </p>
</div>

      <div className="form-field">
        <label htmlFor="appointment-time">
          Vrijeme
        </label>

        {editingAppointment ? (
          <input
            id="appointment-time"
            ref={timeInputRef}
            className={
              errors.time
                ? 'input-error'
                : ''
            }
            type="time"
            value={time}
            step="60"
            onChange={handleTimeChange}
          />
        ) : (
          <select
            id="appointment-time"
            ref={timeInputRef}
            className={
              errors.time
                ? 'input-error'
                : ''
            }
            value={time}
            onChange={handleTimeChange}
          >
            <option value="">
              Odaberite vrijeme
            </option>

            {timeOptions.map(
              (timeOption) => (
                <option
                  key={timeOption}
                  value={timeOption}
                >
                  {timeOption}
                </option>
              )
            )}
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
  <label htmlFor="appointment-client">
    Klijent
  </label>

  <select
    id="appointment-client"
    ref={clientNameInputRef}
    className={
      errors.clientName
        ? 'input-error'
        : ''
    }
    value={clientId}
    onChange={(event) => {
      const newClientId = event.target.value

      setClientId(newClientId)

      const newSelectedClient =
        clientList.find(
          (client) =>
            String(client.id) ===
            newClientId
        )

      setClientName(
        newSelectedClient?.name || ''
      )

      if (errors.clientName) {
        setErrors((currentErrors) => ({
          ...currentErrors,
          clientName: '',
        }))
      }
    }}
  >
    <option value="">
      Odaberite klijenta
    </option>

    {isLegacyEditingClient &&
      !clientId && (
        <option value="">
          Stari klijent — {editingClientName}
        </option>
      )}

    {clientList.map((client) => (
      <option
        key={client.id}
        value={String(client.id)}
      >
        {client.name}
      </option>
    ))}
  </select>

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

        <select
          id="appointment-service"
          ref={serviceInputRef}
          className={
            errors.service
              ? 'input-error'
              : ''
          }
          value={service}
          onChange={handleServiceChange}
        >
          <option value="">
            Odaberite uslugu
          </option>

   {isLegacyEditingService && (
  <option value={editingServiceName}>
    Stara usluga — {editingServiceName}
  </option>
   )}

          {activeServices.map(
            (serviceItem) => (
              <option
                key={serviceItem.id}
                value={serviceItem.name}
              >
                {serviceItem.name}
              </option>
            )
          )}
        </select>

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