import {
  useEffect,
  useRef,
  useState,
} from 'react'

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

  const [isFormOpen, setIsFormOpen] =
    useState(false)

  const employeeFormSectionRef =
    useRef(null)

  const activeEmployees =
    employeeList.filter(
      (employee) =>
        employee.active !== false
    )

  useEffect(() => {
    if (!isFormOpen) {
      return
    }

    const scrollTimeout =
      window.setTimeout(() => {
        employeeFormSectionRef.current
          ?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          })
      }, 50)

    return () => {
      window.clearTimeout(scrollTimeout)
    }
  }, [isFormOpen, editingEmployee])

  function openAddEmployeeForm() {
    setEditingEmployee(null)
    setIsFormOpen(true)
  }

  function startEditingEmployee(employee) {
    setEditingEmployee(employee)
    setIsFormOpen(true)
  }

  function addEmployee(newEmployee) {
    setEmployeeList((currentEmployees) => [
      ...currentEmployees,
      newEmployee,
    ])

    setEditingEmployee(null)
    setIsFormOpen(false)
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
    setIsFormOpen(false)
  }

  function cancelEmployeeForm() {
    setEditingEmployee(null)
    setIsFormOpen(false)
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

    if (
      editingEmployee?.id === employeeId
    ) {
      setEditingEmployee(null)
      setIsFormOpen(false)
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

        <div className="employees-header-actions">
          <button
            type="button"
            className="employees-add-button"
            onClick={openAddEmployeeForm}
          >
            + Novi zaposlenik
          </button>

          <div className="employees-count">
            <span>
              Aktivni zaposlenici
            </span>

            <strong>
              {activeEmployees.length}
            </strong>
          </div>
        </div>
      </div>

      {isFormOpen && (
        <div
          ref={employeeFormSectionRef}
          className="employees-form-section"
        >
          <EmployeeForm
            serviceList={serviceList}
            onAddEmployee={addEmployee}
            onUpdateEmployee={updateEmployee}
            onCancelEdit={cancelEmployeeForm}
            editingEmployee={
              editingEmployee
            }
          />
        </div>
      )}

      {employeeList.length === 0 ? (
        <div className="employees-placeholder">
          <h2>Još nema zaposlenika</h2>

          <p>
            Dodajte prvog zaposlenika kako
            biste počeli graditi tim salona.
          </p>

          <button
            type="button"
            className="employees-add-button"
            onClick={openAddEmployeeForm}
          >
            + Dodaj prvog zaposlenika
          </button>
        </div>
      ) : (
        <div className="employees-list">
          {employeeList.map((employee) => (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              serviceList={serviceList}
              onEdit={
                startEditingEmployee
              }
              onToggleActive={
                toggleEmployeeActive
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default Employees