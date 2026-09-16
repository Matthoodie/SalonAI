import {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  createEmployee as createEmployeeRequest,
  updateEmployee as updateEmployeeRequest,
  updateEmployeeActive as updateEmployeeActiveRequest,
  fetchEmployees,
} from '../../api/employeeApi'

import {
  mapEmployeeToCreatePayload,
  mapEmployeesToFrontend,
} from '../../api/employeeMapper'

import EmployeeCard from '../../components/EmployeeCard/EmployeeCard'
import EmployeeForm from '../../components/EmployeeForm/EmployeeForm'

import './Employees.css'

function Employees({
  employeeList = [],
  setEmployeeList,
  serviceList = [],
  salonId,
  salonTimezone,
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

  async function addEmployee(
    newEmployee
  ) {
    try {
      if (
        !Number.isSafeInteger(
          Number(salonId)
        ) ||
        Number(salonId) <= 0
      ) {
        throw new Error(
          'Salon nije spreman za dodavanje zaposlenika.'
        )
      }

      const employeePayload =
        mapEmployeeToCreatePayload(
          newEmployee,
          Number(salonId),
          salonTimezone
        )

      await createEmployeeRequest(
        employeePayload
      )

      const backendEmployees =
        await fetchEmployees({
          salonId: Number(salonId),
        })

      const mappedEmployees =
        mapEmployeesToFrontend(
          backendEmployees,
          salonTimezone
        )

      setEmployeeList(
        mappedEmployees
      )

      setEditingEmployee(null)
      setIsFormOpen(false)

      return true
    } catch (error) {
      console.error(
        'Neuspješno kreiranje zaposlenika:',
        error
      )

      window.alert(
        error.message ||
        'Zaposlenika trenutno nije moguće dodati.'
      )

      return false
    }
  }

  async function updateEmployee(
    updatedEmployee
  ) {
    try {
      if (
        !Number.isSafeInteger(
          Number(salonId)
        ) ||
        Number(salonId) <= 0
      ) {
        throw new Error(
          'Salon nije spreman za uređivanje zaposlenika.'
        )
      }

      const employeePayload =
        mapEmployeeToCreatePayload(
          updatedEmployee,
          Number(salonId),
          salonTimezone
        )

      await updateEmployeeRequest(
        updatedEmployee.id,
        employeePayload
      )

      const backendEmployees =
        await fetchEmployees({
          salonId: Number(salonId),
        })

      const mappedEmployees =
        mapEmployeesToFrontend(
          backendEmployees,
          salonTimezone
        )

      setEmployeeList(
        mappedEmployees
      )

      setEditingEmployee(null)
      setIsFormOpen(false)

      return true
    } catch (error) {
      console.error(
        'Neuspješno uređivanje zaposlenika:',
        error
      )

      window.alert(
        error.message ||
        'Zaposlenika trenutno nije moguće urediti.'
      )

      return false
    }
  }

  function cancelEmployeeForm() {
    setEditingEmployee(null)
    setIsFormOpen(false)
  }

  async function toggleEmployeeActive(
    employeeId
  ) {
    try {
      const employee =
        employeeList.find(
          (item) =>
            item.id === employeeId
        )

      if (!employee) {
        throw new Error(
          'Zaposlenik nije pronađen.'
        )
      }

      if (
        !Number.isSafeInteger(
          Number(salonId)
        ) ||
        Number(salonId) <= 0
      ) {
        throw new Error(
          'Salon nije spreman za promjenu statusa zaposlenika.'
        )
      }

      await updateEmployeeActiveRequest(
        employeeId,
        {
          salonId:
            Number(salonId),

          active:
            !employee.active,
        }
      )

      const backendEmployees =
        await fetchEmployees({
          salonId:
            Number(salonId),
        })

      const mappedEmployees =
        mapEmployeesToFrontend(
          backendEmployees,
          salonTimezone
        )

      setEmployeeList(
        mappedEmployees
      )

      if (
        editingEmployee?.id ===
        employeeId
      ) {
        setEditingEmployee(null)
        setIsFormOpen(false)
      }

      return true
    } catch (error) {
      console.error(
        'Neuspješna promjena statusa zaposlenika:',
        error
      )

      window.alert(
        error.message ||
        'Status zaposlenika trenutno nije moguće promijeniti.'
      )

      return false
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