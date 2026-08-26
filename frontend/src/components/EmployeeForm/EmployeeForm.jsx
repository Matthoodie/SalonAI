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

const timeOffTypes = [
  {
    value: 'VACATION',
    label: 'Godišnji odmor',
  },
  {
    value: 'SICK_LEAVE',
    label: 'Bolovanje',
  },
  {
    value: 'DAY_OFF',
    label: 'Slobodan dan',
  },
  {
    value: 'TRAINING',
    label: 'Edukacija',
  },
  {
    value: 'PRIVATE',
    label: 'Privatna odsutnost',
  },
  {
    value: 'OTHER',
    label: 'Drugo',
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

function formatDate(date) {
  if (!date) {
    return ''
  }

  const [year, month, day] =
    date.split('-')

  return `${day}.${month}.${year}.`
}

function getTimeOffTypeLabel(type) {
  const timeOffType =
    timeOffTypes.find(
      (typeOption) =>
        typeOption.value === type
    )

  return timeOffType?.label ?? 'Drugo'
}

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

function validateDateOverrides(
  dateOverrides
) {
  const seenDates = new Set()

  for (const override of dateOverrides) {
    if (!override.date) {
      return 'Posebni datum nije ispravan.'
    }

    if (seenDates.has(override.date)) {
      return `Za datum ${formatDate(
        override.date
      )} postoji više posebnih rasporeda.`
    }

    seenDates.add(override.date)

    if (!override.enabled) {
      continue
    }

    const startMinutes =
      timeToMinutes(
        override.startTime
      )

    const endMinutes =
      timeToMinutes(
        override.endTime
      )

    if (
      startMinutes === null ||
      endMinutes === null
    ) {
      return `${formatDate(
        override.date
      )}: posebno radno vrijeme nije ispravno.`
    }

    if (startMinutes >= endMinutes) {
      return `${formatDate(
        override.date
      )}: početak posebnog radnog vremena mora biti prije kraja.`
    }
  }

  return ''
}

function validateTimeOff(timeOff) {
  const sortedTimeOff = [...timeOff].sort(
    (firstTimeOff, secondTimeOff) =>
      firstTimeOff.startDate.localeCompare(
        secondTimeOff.startDate
      )
  )

  for (
    let index = 0;
    index < sortedTimeOff.length;
    index++
  ) {
    const timeOffItem =
      sortedTimeOff[index]

    if (
      !timeOffItem.startDate ||
      !timeOffItem.endDate
    ) {
      return 'Svaka odsutnost mora imati početni i završni datum.'
    }

    if (
      timeOffItem.startDate >
      timeOffItem.endDate
    ) {
      return 'Početni datum odsutnosti mora biti prije ili jednak završnom datumu.'
    }

    if (!timeOffItem.type) {
      return 'Svaka odsutnost mora imati odabranu vrstu.'
    }

    if (index > 0) {
      const previousTimeOff =
        sortedTimeOff[index - 1]

      if (
        timeOffItem.startDate <=
        previousTimeOff.endDate
      ) {
        return 'Periodi odsutnosti ne smiju se međusobno preklapati.'
      }
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
 
  const [dateOverrides, setDateOverrides] =
  useState([])

  const [timeOff, setTimeOff] =
  useState([])

  const [timeOffStartDate, setTimeOffStartDate] =
  useState('')

const [timeOffEndDate, setTimeOffEndDate] =
  useState('')

const [timeOffType, setTimeOffType] =
  useState('VACATION')

const [timeOffNote, setTimeOffNote] =
  useState('')

const [isTimeOffOpen, setIsTimeOffOpen] =
  useState(false)

  const [overrideDate, setOverrideDate] =
  useState('')

const [overrideEnabled, setOverrideEnabled] =
  useState(true)

const [overrideStartTime, setOverrideStartTime] =
  useState('08:00')

const [overrideEndTime, setOverrideEndTime] =
  useState('16:00')

  const [isWorkingHoursOpen, setIsWorkingHoursOpen] =
  useState(false)

const [isDateOverridesOpen, setIsDateOverridesOpen] =
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

   setDateOverrides(
  Array.isArray(
    editingEmployee.dateOverrides
  )
    ? editingEmployee.dateOverrides
    : []
)
setTimeOff(
  Array.isArray(
    editingEmployee.timeOff
  )
    ? editingEmployee.timeOff
    : []
)

    setIsWorkingHoursOpen(false)
    setIsDateOverridesOpen(false)
    setIsTimeOffOpen(false)

  } else {
    setName('')

    setSelectedServiceIds([])

    setWorkingHours(
      createDefaultWorkingHours()
    )
    setDateOverrides([])
    setTimeOff([])

    setIsWorkingHoursOpen(false)
    setIsDateOverridesOpen(false)
    setIsTimeOffOpen(false)
  }
}, [editingEmployee])

function addDateOverride() {
  if (!overrideDate) {
    window.alert(
      'Odaberite datum posebnog rasporeda.'
    )

    return
  }

  if (overrideDate < getTodayDate()) {
  window.alert(
    'Posebni raspored nije moguće dodati za datum u prošlosti.'
  )

  return
}

  const alreadyExists =
    dateOverrides.some(
      (override) =>
        override.date === overrideDate
    )

  if (alreadyExists) {
    window.alert(
      'Za odabrani datum već postoji poseban raspored.'
    )

    return
  }

  if (overrideEnabled) {
    const startMinutes =
      timeToMinutes(overrideStartTime)

    const endMinutes =
      timeToMinutes(overrideEndTime)

    if (
      startMinutes === null ||
      endMinutes === null ||
      startMinutes >= endMinutes
    ) {
      window.alert(
        'Početak posebnog radnog vremena mora biti prije kraja.'
      )

      return
    }
  }

  const newOverride = {
    id: Date.now(),
    date: overrideDate,
    enabled: overrideEnabled,

    startTime: overrideEnabled
      ? overrideStartTime
      : '',

    endTime: overrideEnabled
      ? overrideEndTime
      : '',
  }

  setDateOverrides(
    (currentOverrides) => [
      ...currentOverrides,
      newOverride,
    ]
  )

  setOverrideDate('')
  setOverrideEnabled(true)
  setOverrideStartTime('08:00')
  setOverrideEndTime('16:00')
}

function addTimeOff() {
  if (
    !timeOffStartDate ||
    !timeOffEndDate
  ) {
    window.alert(
      'Odaberite početni i završni datum odsutnosti.'
    )

    return
  }

  if (
    timeOffStartDate >
    timeOffEndDate
  ) {
    window.alert(
      'Početni datum odsutnosti mora biti prije ili jednak završnom datumu.'
    )

    return
  }

  const hasOverlap =
    timeOff.some((timeOffItem) => {
      return (
        timeOffStartDate <=
          timeOffItem.endDate &&
        timeOffEndDate >=
          timeOffItem.startDate
      )
    })

  if (hasOverlap) {
    window.alert(
      'Odabrani period preklapa se s postojećom odsutnošću.'
    )

    return
  }

  const newTimeOff = {
    id: Date.now(),

    startDate:
      timeOffStartDate,

    endDate:
      timeOffEndDate,

    type:
      timeOffType,

    note:
      timeOffNote.trim(),
  }

  setTimeOff(
    (currentTimeOff) => [
      ...currentTimeOff,
      newTimeOff,
    ]
  )

  setTimeOffStartDate('')
  setTimeOffEndDate('')
  setTimeOffType('VACATION')
  setTimeOffNote('')
}

function removeTimeOff(
  timeOffId
) {
  setTimeOff(
    (currentTimeOff) =>
      currentTimeOff.filter(
        (timeOffItem) =>
          timeOffItem.id !== timeOffId
      )
  )
}

function removeDateOverride(
  overrideId
) {
  setDateOverrides(
    (currentOverrides) =>
      currentOverrides.filter(
        (override) =>
          override.id !== overrideId
      )
  )
}

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

  const dateOverridesError =
  validateDateOverrides(
    dateOverrides
  )

if (dateOverridesError) {
  setIsDateOverridesOpen(true)

  window.alert(
    dateOverridesError
  )

  return
}

const timeOffError =
  validateTimeOff(
    timeOff
  )

if (timeOffError) {
  setIsTimeOffOpen(true)

  window.alert(
    timeOffError
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
      dateOverrides,
      timeOff,
    })
  } else {
    const newEmployee = {
      id: Date.now(),
      name: trimmedName,
      active: true,
      serviceIds:
        selectedServiceIds,
      workingHours,
      dateOverrides,
      timeOff,
    }

    onAddEmployee(newEmployee)
  }

  setName('')
  setSelectedServiceIds([])
  setWorkingHours(
  createDefaultWorkingHours()
  )
  setDateOverrides([])
  setTimeOff([])
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

<fieldset className="employee-date-overrides-fieldset">
  <div className="employee-date-overrides-header">
    <div>
      <div className="employee-date-overrides-title-row">
        <legend>
          Posebni datumi
        </legend>

        {dateOverrides.length > 0 && (
          <span className="employee-date-overrides-count">
            {dateOverrides.length}
          </span>
        )}
      </div>

      <p className="employee-date-overrides-description">
        Posebni rasporedi koji odstupaju od
        standardnog radnog vremena.
      </p>
    </div>

    <button
      type="button"
      className="employee-date-overrides-toggle-button"
      onClick={() =>
        setIsDateOverridesOpen(
          (currentValue) => !currentValue
        )
      }
      aria-expanded={isDateOverridesOpen}
    >
      {isDateOverridesOpen
        ? 'Sakrij posebne datume'
        : 'Uredi posebne datume'}
    </button>
  </div>

  {!isDateOverridesOpen && (
    <div className="employee-date-overrides-summary">
      {dateOverrides.length === 0
        ? 'Nema posebnih datuma'
        : `${dateOverrides.length} ${
            dateOverrides.length === 1
              ? 'poseban datum'
              : 'posebna datuma'
          }`}
    </div>
  )}

  {isDateOverridesOpen && (
    <div className="employee-date-overrides-content">
      {dateOverrides.length > 0 && (
        <div className="employee-date-overrides-list">
          {[...dateOverrides]
            .sort(
              (
                firstOverride,
                secondOverride
              ) =>
                firstOverride.date.localeCompare(
                  secondOverride.date
                )
            )
            .map((override) => (
              <div
                key={override.id}
                className="employee-date-override-item"
              >
                <div className="employee-date-override-info">
                  <strong>
                    {formatDate(
                      override.date
                    )}
                  </strong>

                  <span>
                    {override.enabled
                      ? `${override.startTime}–${override.endTime}`
                      : 'Ne radi'}
                  </span>
                </div>

                <button
                  type="button"
                  className="employee-date-override-remove"
                  onClick={() =>
                    removeDateOverride(
                      override.id
                    )
                  }
                >
                  Obriši
                </button>
              </div>
            ))}
        </div>
      )}

      <div className="employee-date-override-form">
        <input
          type="date"
          value={overrideDate}
          onChange={(event) =>
            setOverrideDate(
              event.target.value
            )
          }
          aria-label="Datum posebnog rasporeda"
        />

        <label className="employee-date-override-toggle">
          <input
            type="checkbox"
            checked={overrideEnabled}
            onChange={(event) =>
              setOverrideEnabled(
                event.target.checked
              )
            }
          />

          <span>
            {overrideEnabled
              ? 'Radi'
              : 'Ne radi'}
          </span>
        </label>

        {overrideEnabled && (
          <div className="employee-date-override-times">
            <select
              value={overrideStartTime}
              onChange={(event) =>
                setOverrideStartTime(
                  event.target.value
                )
              }
              aria-label="Početak posebnog radnog vremena"
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

            <span>—</span>

            <select
              value={overrideEndTime}
              onChange={(event) =>
                setOverrideEndTime(
                  event.target.value
                )
              }
              aria-label="Kraj posebnog radnog vremena"
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
        )}

        <button
          type="button"
          onClick={addDateOverride}
          className="employee-date-override-add"
        >
          + Dodaj posebni datum
        </button>
      </div>
    </div>
  )}
</fieldset>

<fieldset className="employee-time-off-fieldset">
  <div className="employee-time-off-header">
    <div>
      <legend>
        Odsutnosti
      </legend>

      <p className="employee-time-off-description">
        Dodajte godišnji odmor, bolovanje ili
        drugi period odsutnosti zaposlenika.
      </p>
    </div>

    <button
      type="button"
      className="employee-time-off-toggle-button"
      onClick={() =>
        setIsTimeOffOpen(
          (currentValue) => !currentValue
        )
      }
      aria-expanded={isTimeOffOpen}
    >
      {isTimeOffOpen
        ? 'Sakrij odsutnosti'
        : 'Uredi odsutnosti'}
    </button>
  </div>

  {!isTimeOffOpen && (
    <div className="employee-time-off-summary">
      {timeOff.length === 0
        ? 'Nema evidentiranih odsutnosti'
        : `${timeOff.length} ${
            timeOff.length === 1
              ? 'evidentirana odsutnost'
              : 'evidentirane odsutnosti'
          }`}
    </div>
  )}

  {isTimeOffOpen && (
    <>
      <div className="employee-time-off-form">
        <div className="employee-time-off-field">
          <label htmlFor="time-off-start-date">
            Od
          </label>

          <input
            id="time-off-start-date"
            type="date"
            value={timeOffStartDate}
            onChange={(event) =>
              setTimeOffStartDate(
                event.target.value
              )
            }
          />
        </div>

        <div className="employee-time-off-field">
          <label htmlFor="time-off-end-date">
            Do
          </label>

          <input
            id="time-off-end-date"
            type="date"
            value={timeOffEndDate}
            onChange={(event) =>
              setTimeOffEndDate(
                event.target.value
              )
            }
          />
        </div>

        <div className="employee-time-off-field">
          <label htmlFor="time-off-type">
            Vrsta odsutnosti
          </label>

          <select
            id="time-off-type"
            value={timeOffType}
            onChange={(event) =>
              setTimeOffType(
                event.target.value
              )
            }
          >
            {timeOffTypes.map(
              (typeOption) => (
                <option
                  key={typeOption.value}
                  value={typeOption.value}
                >
                  {typeOption.label}
                </option>
              )
            )}
          </select>
        </div>

        <div className="employee-time-off-field employee-time-off-note-field">
          <label htmlFor="time-off-note">
            Napomena
          </label>

          <input
            id="time-off-note"
            type="text"
            value={timeOffNote}
            placeholder="Opcionalno..."
            onChange={(event) =>
              setTimeOffNote(
                event.target.value
              )
            }
          />
        </div>

        <button
          type="button"
          className="employee-time-off-add"
          onClick={addTimeOff}
        >
          + Dodaj odsutnost
        </button>
      </div>

      {timeOff.length > 0 && (
        <div className="employee-time-off-list">
          {[...timeOff]
            .sort(
              (
                firstTimeOff,
                secondTimeOff
              ) =>
                firstTimeOff.startDate.localeCompare(
                  secondTimeOff.startDate
                )
            )
            .map((timeOffItem) => (
              <div
                key={timeOffItem.id}
                className="employee-time-off-item"
              >
                <div className="employee-time-off-info">
                  <strong>
                    {formatDate(
                      timeOffItem.startDate
                    )}

                    {' — '}

                    {formatDate(
                      timeOffItem.endDate
                    )}
                  </strong>

                  <span>
                    {getTimeOffTypeLabel(
                      timeOffItem.type
                    )}
                  </span>

                  {timeOffItem.note && (
                    <small>
                      {timeOffItem.note}
                    </small>
                  )}
                </div>

                <button
                  type="button"
                  className="employee-time-off-remove"
                  onClick={() =>
                    removeTimeOff(
                      timeOffItem.id
                    )
                  }
                >
                  Obriši
                </button>
              </div>
            ))}
        </div>
      )}
    </>
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
