import {
  useEffect,
  useState,
} from 'react'

import './EmployeeForm.css'

const weekDays = [
  {
    key: 'monday',
    label: 'Ponedjeljak',
  },
  {
    key: 'tuesday',
    label: 'Utorak',
  },
  {
    key: 'wednesday',
    label: 'Srijeda',
  },
  {
    key: 'thursday',
    label: 'Četvrtak',
  },
  {
    key: 'friday',
    label: 'Petak',
  },
  {
    key: 'saturday',
    label: 'Subota',
  },
  {
    key: 'sunday',
    label: 'Nedjelja',
  },
]

function createDefaultWorkingHours() {
  return {
    monday: {
      enabled: true,
      startTime: '08:00',
      endTime: '16:00',
    },
    tuesday: {
      enabled: true,
      startTime: '08:00',
      endTime: '16:00',
    },
    wednesday: {
      enabled: true,
      startTime: '08:00',
      endTime: '16:00',
    },
    thursday: {
      enabled: true,
      startTime: '08:00',
      endTime: '16:00',
    },
    friday: {
      enabled: true,
      startTime: '08:00',
      endTime: '16:00',
    },
    saturday: {
      enabled: false,
      startTime: '',
      endTime: '',
    },
    sunday: {
      enabled: false,
      startTime: '',
      endTime: '',
    },
  }
}

const workingTimeOptions = []

for (let hour = 0; hour < 24; hour++) {
  for (
    let minute = 0;
    minute < 60;
    minute += 15
  ) {
    const formattedHour =
      String(hour).padStart(2, '0')

    const formattedMinute =
      String(minute).padStart(2, '0')

    workingTimeOptions.push(
      `${formattedHour}:${formattedMinute}`
    )
  }
}

function getWorkingHoursSummary(workingHours) {
  const enabledDays = weekDays.filter(
    (day) =>
      workingHours[day.key]?.enabled
  )

  if (enabledDays.length === 0) {
    return 'Nema definiranih radnih dana'
  }

  const groupedSchedules = []

  enabledDays.forEach((day) => {
    const schedule =
      workingHours[day.key]

    const scheduleKey =
      `${schedule.startTime}-${schedule.endTime}`

    const existingGroup =
      groupedSchedules.find(
        (group) =>
          group.scheduleKey ===
          scheduleKey
      )

    if (existingGroup) {
      existingGroup.days.push(
        day.label
      )
    } else {
      groupedSchedules.push({
        scheduleKey,
        days: [day.label],
        startTime:
          schedule.startTime,
        endTime:
          schedule.endTime,
      })
    }
  })

  return groupedSchedules
    .map((group) => {
      const dayText =
        group.days.length === 1
          ? group.days[0]
          : `${group.days[0]}–${
              group.days[
                group.days.length - 1
              ]
            }`

      return `${dayText} ${group.startTime}–${group.endTime}`
    })
    .join(' · ')
}

function timeToMinutes(time) {
  if (!time) {
    return null
  }

  const [hours, minutes] =
    time.split(':').map(Number)

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return null
  }

  return hours * 60 + minutes
}

function validateWorkingHours(workingHours) {
  for (const day of weekDays) {
    const schedule =
      workingHours[day.key]

    if (!schedule?.enabled) {
      continue
    }

    if (
      !schedule.startTime ||
      !schedule.endTime
    ) {
      return `${day.label}: odaberite početak i kraj radnog vremena.`
    }

    const startMinutes =
      timeToMinutes(
        schedule.startTime
      )

    const endMinutes =
      timeToMinutes(
        schedule.endTime
      )

    if (
      startMinutes === null ||
      endMinutes === null
    ) {
      return `${day.label}: radno vrijeme nije ispravno.`
    }

    if (startMinutes >= endMinutes) {
      return `${day.label}: početak radnog vremena mora biti prije kraja.`
    }
  }

  return ''
}

function EmployeeForm({
  serviceList = [],
  onAddEmployee,
  onUpdateEmployee,
  onCancelEdit,
  editingEmployee,
}) {
  const [name, setName] = useState('')
  const [selectedServiceIds, setSelectedServiceIds] =
    useState([])

  const [workingHours, setWorkingHours] =
  useState(
    createDefaultWorkingHours
  )

  const [isWorkingHoursOpen, setIsWorkingHoursOpen] =
  useState(false)

    useEffect(() => {
  if (editingEmployee) {
    setName(
      editingEmployee.name || ''
    )

    setSelectedServiceIds(
      editingEmployee.serviceIds || []
    )

    setWorkingHours(
      editingEmployee.workingHours ||
        createDefaultWorkingHours()
    )

    setIsWorkingHoursOpen(false)

  } else {
    setName('')

    setSelectedServiceIds([])

    setWorkingHours(
      createDefaultWorkingHours()
    )
    setIsWorkingHoursOpen(false)
  }
}, [editingEmployee])

  function toggleService(serviceId) {
    setSelectedServiceIds((currentIds) =>
      currentIds.includes(serviceId)
        ? currentIds.filter(
            (id) => id !== serviceId
          )
        : [...currentIds, serviceId]
    )
  }

  function toggleWorkingDay(dayKey) {
  setWorkingHours(
    (currentWorkingHours) => {
      const currentDay =
        currentWorkingHours[dayKey]

      const willBeEnabled =
        !currentDay.enabled

      return {
        ...currentWorkingHours,

        [dayKey]: {
          ...currentDay,

          enabled: willBeEnabled,

          startTime: willBeEnabled
            ? currentDay.startTime || '08:00'
            : '',

          endTime: willBeEnabled
            ? currentDay.endTime || '16:00'
            : '',
        },
      }
    }
  )
}

function updateWorkingTime(
  dayKey,
  field,
  value
) {
  setWorkingHours(
    (currentWorkingHours) => ({
      ...currentWorkingHours,

      [dayKey]: {
        ...currentWorkingHours[dayKey],
        [field]: value,
      },
    })
  )
}

function handleSubmit(event) {
  event.preventDefault()

  const trimmedName = name.trim()

  if (!trimmedName) {
    window.alert(
      'Unesite ime zaposlenika.'
    )

    return
  }

  const workingHoursError =
    validateWorkingHours(
      workingHours
    )

  if (workingHoursError) {
    setIsWorkingHoursOpen(true)

    window.alert(
      workingHoursError
    )

    return
  }

  if (editingEmployee) {
    onUpdateEmployee({
      ...editingEmployee,
      name: trimmedName,
      serviceIds:
        selectedServiceIds,
      workingHours,
    })
  } else {
    const newEmployee = {
      id: Date.now(),
      name: trimmedName,
      active: true,
      serviceIds:
        selectedServiceIds,
      workingHours,
    }

    onAddEmployee(newEmployee)
  }

  setName('')
  setSelectedServiceIds([])
  setWorkingHours(
    createDefaultWorkingHours()
  )
 }

  return (
    <form
      className="employee-form"
      onSubmit={handleSubmit}
    >
      <div className="employee-form-header">
        <div>
          <span className="employee-form-eyebrow">
  {editingEmployee
    ? 'Uređivanje zaposlenika'
    : 'Novi član tima'}
 </span>

 <h2>
  {editingEmployee
    ? 'Uredi zaposlenika'
    : 'Dodaj zaposlenika'}
</h2>

<p>
  {editingEmployee
    ? 'Promijenite podatke zaposlenika i njegove usluge.'
    : 'Dodajte zaposlenika i odaberite usluge koje može obavljati.'}
</p>
        </div>
      </div>

      <div className="employee-form-field">
        <label htmlFor="employee-name">
          Ime i prezime
        </label>

        <input
          id="employee-name"
          type="text"
          value={name}
          placeholder="npr. Ivana Horvat"
          onChange={(event) =>
            setName(event.target.value)
          }
        />
      </div>

      <fieldset className="employee-services-fieldset">
        <legend>Usluge zaposlenika</legend>

        {serviceList.length === 0 ? (
          <p className="employee-services-empty">
            Trenutno nema dostupnih usluga.
          </p>
        ) : (
          <div className="employee-service-options">
            {serviceList.map((service) => (
              <label
                key={service.id}
                className="employee-service-option"
              >
                <input
                  type="checkbox"
                  checked={
                    selectedServiceIds.includes(
                      service.id
                    )
                  }
                  onChange={() =>
                    toggleService(service.id)
                  }
                />

                <span>
                  {service.name}
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

         <fieldset className="employee-working-hours-fieldset">
  <div className="employee-working-hours-header">
    <div>
      <legend>Radno vrijeme</legend>

      <p className="employee-working-hours-description">
        Odredite dane i radno vrijeme zaposlenika.
      </p>
    </div>

    <button
      type="button"
      className="employee-working-hours-toggle-button"
      onClick={() =>
        setIsWorkingHoursOpen(
          (currentValue) => !currentValue
        )
      }
      aria-expanded={isWorkingHoursOpen}
    >
      {isWorkingHoursOpen
        ? 'Sakrij raspored'
        : 'Uredi radno vrijeme'}
    </button>
  </div>

  {!isWorkingHoursOpen && (
    <div className="employee-working-hours-summary">
      {getWorkingHoursSummary(
  workingHours
)}
    </div>
  )}

  {isWorkingHoursOpen && (
    <div className="employee-working-hours-list">
      {weekDays.map((day) => {
        const daySchedule =
          workingHours[day.key]

        return (
          <div
            key={day.key}
            className="employee-working-hours-row"
          >
            <div className="employee-working-hours-day">
              <strong>
                {day.label}
              </strong>
            </div>

            <label className="employee-working-hours-toggle">
              <input
                type="checkbox"
                checked={daySchedule.enabled}
                onChange={() =>
                  toggleWorkingDay(
                    day.key
                  )
                }
              />

              <span>
                {daySchedule.enabled
                  ? 'Radi'
                  : 'Ne radi'}
              </span>
            </label>

            {daySchedule.enabled ? (
              <div className="employee-working-hours-times">

                <select
  aria-label={`${day.label} početak radnog vremena`}
  value={daySchedule.startTime}
  onChange={(event) =>
    updateWorkingTime(
      day.key,
      'startTime',
      event.target.value
    )
  }
>
  {workingTimeOptions.map(
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

                <span className="employee-working-hours-separator">
                  —
                </span>

               <select
  aria-label={`${day.label} kraj radnog vremena`}
  value={daySchedule.endTime}
  onChange={(event) =>
    updateWorkingTime(
      day.key,
      'endTime',
      event.target.value
    )
  }
>
  {workingTimeOptions.map(
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
              </div>
            ) : (
              <div className="employee-working-hours-off">
                Slobodan dan
              </div>
            )}
          </div>
        )
      })}
    </div>
  )}
</fieldset>

  <div className="employee-form-actions">
  <button
    type="submit"
    className="employee-form-submit"
  >
    {editingEmployee
      ? 'Spremi promjene'
      : 'Dodaj zaposlenika'}
  </button>

  <button
  type="button"
  className="employee-form-cancel"
  onClick={onCancelEdit}
>
  Odustani
</button>
</div>
    </form>
  )
}

export default EmployeeForm
