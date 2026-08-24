import { useState } from 'react'
import EmployeeCard from '../../components/EmployeeCard/EmployeeCard'
import EmployeeForm from '../../components/EmployeeForm/EmployeeForm'
import './Employees.css'

function Employees({
  employeeList = [],
  setEmployeeList,
  serviceList = [],
}) {
const [editingEmployee, setEditingEmployee] =
  useState(null)

  const activeEmployees =
    employeeList.filter(
      (employee) =>
        employee.active !== false
    )

    function addEmployee(newEmployee) {
  setEmployeeList((currentEmployees) => [
    ...currentEmployees,
    newEmployee,
  ])
}

function updateEmployee(updatedEmployee) {
  setEmployeeList((currentEmployees) =>
    currentEmployees.map((employee) =>
      employee.id === updatedEmployee.id
        ? updatedEmployee
        : employee
    )
  )

  setEditingEmployee(null)
}

function cancelEdit() {
  setEditingEmployee(null)
}

function toggleEmployeeActive(employeeId) {
  setEmployeeList((currentEmployees) =>
    currentEmployees.map((employee) =>
      employee.id === employeeId
        ? {
            ...employee,
            active: !employee.active,
          }
        : employee
    )
  )

  if (editingEmployee?.id === employeeId) {
  setEditingEmployee(null)
}
}

  return (
    <div className="employees-page">
      <div className="employees-header">
        <div>
          <span className="employees-eyebrow">
            Tim
          </span>

          <h1>Zaposlenici</h1>

          <p>
            Upravljajte zaposlenicima salona
            i njihovim statusom.
          </p>
        </div>

        <div className="employees-count">
          <span>Aktivni zaposlenici</span>

          <strong>
            {activeEmployees.length}
          </strong>
        </div>
      </div>

      <EmployeeForm
  serviceList={serviceList}
  onAddEmployee={addEmployee}
  onUpdateEmployee={updateEmployee}
  onCancelEdit={cancelEdit}
  editingEmployee={editingEmployee}
/>

      {employeeList.length === 0 ? (
     <div className="employees-placeholder">
     <h2>Još nema zaposlenika</h2>

     <p>
      Dodajte prvog zaposlenika kako biste
      počeli graditi tim salona.
      </p>
  </div>
) : (
  <div className="employees-list">
    {employeeList.map((employee) => (
      <EmployeeCard
  key={employee.id}
  employee={employee}
  serviceList={serviceList}
  onEdit={setEditingEmployee}
  onToggleActive={toggleEmployeeActive}
/>
    ))}
  </div>
)}
    </div>
  )
}

export default Employees