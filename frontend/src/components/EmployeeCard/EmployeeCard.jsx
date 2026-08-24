import './EmployeeCard.css'

function getEmployeeInitials(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((namePart) =>
      namePart.charAt(0).toUpperCase()
    )
    .join('')
}

const weekDays = [
  {
    key: 'monday',
    shortLabel: 'Pon',
  },
  {
    key: 'tuesday',
    shortLabel: 'Uto',
  },
  {
    key: 'wednesday',
    shortLabel: 'Sri',
  },
  {
    key: 'thursday',
    shortLabel: 'Čet',
  },
  {
    key: 'friday',
    shortLabel: 'Pet',
  },
  {
    key: 'saturday',
    shortLabel: 'Sub',
  },
  {
    key: 'sunday',
    shortLabel: 'Ned',
  },
]

function getEmployeeScheduleSummary(
  workingHours
) {
  if (!workingHours) {
    return 'Radno vrijeme nije definirano'
  }

  const enabledDays =
    weekDays.filter(
      (day) =>
        workingHours[day.key]?.enabled
    )

  if (enabledDays.length === 0) {
    return 'Nema radnih dana'
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
        day.shortLabel
      )
    } else {
      groupedSchedules.push({
        scheduleKey,
        days: [day.shortLabel],
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

function EmployeeCard({
  employee,
  serviceList = [],
  onEdit,
  onToggleActive,
}) {
  const employeeServices =
    serviceList.filter((service) =>
      employee.serviceIds?.includes(
        service.id
      )
    )

   const scheduleSummary =
  getEmployeeScheduleSummary(
    employee.workingHours
  )

  return (
    <article className="employee-card">
      <div className="employee-card-main">
        <div className="employee-avatar">
          {getEmployeeInitials(
            employee.name
          )}
        </div>

        <div className="employee-identity">
          <h3>{employee.name}</h3>

          <span
            className={
              employee.active
                ? 'employee-status employee-status-active'
                : 'employee-status employee-status-inactive'
            }
          >
            {employee.active
              ? 'Aktivan'
              : 'Neaktivan'}
          </span>

          <p className="employee-schedule-summary">
             {scheduleSummary}
          </p>
        </div>
      </div>

      <div className="employee-card-services">
        <span className="employee-card-label">
          Usluge
        </span>

        <strong>
          {employeeServices.length}
        </strong>
      </div>
<div className="employee-card-actions">
  <button
    type="button"
    className="employee-edit-button"
    onClick={() => onEdit(employee)}
  >
    Uredi
  </button>
  <button
  type="button"
  className={
    employee.active
      ? 'employee-status-button employee-status-button-deactivate'
      : 'employee-status-button employee-status-button-activate'
  }
  onClick={() =>
    onToggleActive(employee.id)
  }
>
  {employee.active
    ? 'Deaktiviraj'
    : 'Aktiviraj'}
</button>
</div>
    </article>
  )
}

export default EmployeeCard