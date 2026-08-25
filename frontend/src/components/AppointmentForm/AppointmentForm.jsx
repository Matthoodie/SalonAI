import { useEffect, useRef, useState } from 'react'
import {
  AVAILABILITY_REASONS,
  checkEmployeeAvailability,
  isEmployeeAvailable,
} from '../../utils/availability'
import './AppointmentForm.css'

function addMinutesToTime(time, minutesToAdd) {
  if (!time || !minutesToAdd) {
    return ''
  }

  const [hours, minutes] =
    time.split(':').map(Number)

  const totalMinutes =
    hours * 60 +
    minutes +
    Number(minutesToAdd)

  const endHours =
    Math.floor(totalMinutes / 60)

  const endMinutes =
    totalMinutes % 60

  return `${String(endHours).padStart(2, '0')}:${String(
    endMinutes
  ).padStart(2, '0')}`
}

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
  employeeList = [],
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

  const [employeeId, setEmployeeId] =
  useState('')

  const selectedServiceForEmployee =
  serviceList.find(
    (serviceItem) =>
      serviceItem.name === service
  ) || null

  const selectedServiceDuration =
  selectedServiceForEmployee
    ?.defaultDurationMinutes || 0

  const appointmentEndTime =
  time && selectedServiceDuration
    ? addMinutesToTime(
        time,
        selectedServiceDuration
      )
    : ''

  const availableEmployees =
  selectedServiceForEmployee
    ? employeeList.filter(
        (employee) =>
          employee.active !== false &&
          employee.serviceIds?.includes(
            selectedServiceForEmployee.id
          )
      )
    : []

const selectedEmployeeForAvailability =
  employeeList.find(
    (employee) =>
      String(employee.id) ===
      String(employeeId)
  ) || null

const availableTimeOptions =
  date &&
  employeeId &&
  selectedServiceDuration > 0
    ? timeOptions.filter((timeOption) =>
        isEmployeeAvailable({
          employeeId,
          workingHours:
           selectedEmployeeForAvailability
            ?.workingHours ?? null,
          date,
          startTime: timeOption,
          durationMinutes:
            selectedServiceDuration,
          appointments,
          excludeAppointmentId:
            editingAppointment?.id ?? null,
        })
      )
    : []


  const unavailableTimeReasons =
  date &&
  employeeId &&
  selectedServiceDuration > 0 &&
  selectedEmployeeForAvailability
    ? timeOptions
        .map((timeOption) =>
          checkEmployeeAvailability({
            employeeId,

            workingHours:
              selectedEmployeeForAvailability
                .workingHours ?? null,

            date,
            startTime: timeOption,

            durationMinutes:
              selectedServiceDuration,

            appointments,

            excludeAppointmentId:
              editingAppointment?.id ?? null,
          })
        )
        .filter(
          (result) =>
            !result.available &&
            result.reason
        )
        .map(
          (result) => result.reason
        )
    : []

  const hasDayOffReason =
  unavailableTimeReasons.includes(
    AVAILABILITY_REASONS.DAY_OFF
  )

const hasCollisionReason =
  unavailableTimeReasons.includes(
    AVAILABILITY_REASONS
      .APPOINTMENT_COLLISION
  )

const hasOutsideWorkingHoursReason =
  unavailableTimeReasons.includes(
    AVAILABILITY_REASONS
      .OUTSIDE_WORKING_HOURS
  )

  const [errors, setErrors] = useState({
    date: '',
    time: '',
    clientName: '',
    service: '',
    employee: '',
  })

  let timeOptionsMessage =
  'Odaberite vrijeme'

if (!selectedServiceForEmployee) {
  timeOptionsMessage =
    'Prvo odaberite uslugu'
} else if (!employeeId) {
  timeOptionsMessage =
    'Prvo odaberite zaposlenika'
} else if (
  availableTimeOptions.length === 0
) {
  if (hasDayOffReason) {
    timeOptionsMessage =
      `${selectedEmployeeForAvailability?.name || 'Zaposlenik'} ne radi odabranog dana`
  } else if (hasCollisionReason) {
    timeOptionsMessage =
      'Nema slobodnih termina za odabrani dan'
  } else if (
    hasOutsideWorkingHoursReason
  ) {
    timeOptionsMessage =
      'Usluga ne stane u radno vrijeme zaposlenika'
  } else {
    timeOptionsMessage =
      'Nema slobodnih termina'
  }
}


  const dateInputRef = useRef(null)
  const timeInputRef = useRef(null)
  const clientNameInputRef = useRef(null)
  const serviceInputRef = useRef(null)
  const employeeInputRef = useRef(null)

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

setEmployeeId(
  editingAppointment.employeeId
    ? String(editingAppointment.employeeId)
    : ''
)
    } else {
      setDate(initialDate || getTodayDate())
      setTime('')
      setClientName('')
      setClientId('')
      setService('')
      setEmployeeId('')
    }

    setErrors({
      date: '',
      time: '',
      clientName: '',
      service: '',
      employee: '',
    })
  }, [editingAppointment, initialDate])

 function handleSubmit() {

  const selectedService = serviceList.find(
    (serviceItem) =>
      serviceItem.name === service
  )

  const selectedClient = clientList.find(
  (client) =>
    String(client.id) === clientId
 )

const selectedEmployee =
  employeeList.find(
    (employee) =>
      String(employee.id) === employeeId
  )

  const candidateDuration =
  Number(
    selectedService?.defaultDurationMinutes ??
    editingAppointment?.serviceDurationMinutes
  ) || 0

const availabilityResult =
  selectedEmployee &&
  candidateDuration > 0 &&
  date &&
  time
    ? checkEmployeeAvailability({
        employeeId:
          selectedEmployee.id,

        workingHours:
          selectedEmployee
            .workingHours ?? null,

        date,
        startTime: time,

        durationMinutes:
          candidateDuration,

        appointments,

        excludeAppointmentId:
          editingAppointment?.id ?? null,
      })
    : {
        available: true,
        reason: null,
      }

  let availabilityErrorMessage = ''

if (!availabilityResult.available) {
  switch (availabilityResult.reason) {
    case AVAILABILITY_REASONS.DAY_OFF:
      availabilityErrorMessage =
        `${selectedEmployee.name} ne radi odabranog dana.`
      break

    case AVAILABILITY_REASONS.OUTSIDE_WORKING_HOURS:
      availabilityErrorMessage =
        `Odabrano vrijeme je izvan radnog vremena zaposlenika ${selectedEmployee.name}.`
      break

    case AVAILABILITY_REASONS.APPOINTMENT_COLLISION:
      availabilityErrorMessage =
        `${selectedEmployee.name} već ima termin koji se preklapa s ovim vremenom.`
      break

    case AVAILABILITY_REASONS.INVALID_INPUT:
      availabilityErrorMessage =
        'Podaci termina nisu ispravni.'
      break

    default:
      availabilityErrorMessage =
        'Odabrani termin nije dostupan.'
  }
}

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
  : availabilityErrorMessage,

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

  employee: selectedEmployee
    ? ''
    : 'Odaberite zaposlenika.',
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
      } else if (newErrors.employee) {
        employeeInputRef.current?.focus()
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

      employeeId: selectedEmployee.id,
      employeeName: selectedEmployee.name,

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

      employeeId: selectedEmployee.id,
      employeeName: selectedEmployee.name,

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

    employeeId: selectedEmployee.id,
    employeeName: selectedEmployee.name,

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
setEmployeeId('')

    setErrors({
      date: '',
      time: '',
      clientName: '',
      service: '',
      employee: '',
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
  setEmployeeId('')
  setTime('')

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

      <div className="form-field">
  <label htmlFor="appointment-employee">
    Zaposlenik
  </label>

  <select
  id="appointment-employee"
  ref={employeeInputRef}
  className={
    errors.employee
      ? 'input-error'
      : ''
  }
  value={employeeId}
    onChange={(event) => {
  setEmployeeId(event.target.value)
  setTime('')

  if (errors.employee) {
    setErrors((currentErrors) => ({
      ...currentErrors,
      employee: '',
    }))
  }
}}
    disabled={!selectedServiceForEmployee}
  >
    <option value="">
      {!selectedServiceForEmployee
        ? 'Prvo odaberite uslugu'
        : availableEmployees.length === 0
          ? 'Nema dostupnih zaposlenika'
          : 'Odaberite zaposlenika'}
    </option>

    {availableEmployees.map(
      (employee) => (
        <option
          key={employee.id}
          value={String(employee.id)}
        >
          {employee.name}
        </option>
      )
    )}
  </select>

  <p
  className={
    errors.employee
      ? 'form-error form-error-visible'
      : 'form-error'
  }
>
  {errors.employee || '\u00A0'}
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
            disabled={
            !selectedServiceForEmployee ||
            !employeeId
           }
          >

           <option value="">
             {timeOptionsMessage}
           </option>

            {availableTimeOptions.map(
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

      {appointmentEndTime && (
  <div className="appointment-duration-preview">
    <span>
      Predviđeni završetak
    </span>

    <strong>
      {appointmentEndTime}
    </strong>

    <small>
      Trajanje: {selectedServiceDuration} min
    </small>
  </div>
)}

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