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