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
import InvitationManager from '../../components/Invitations/InvitationManager'
import InvitationList from '../../components/Invitations/InvitationList'

import './Employees.css'

function Employees({
  employeeList = [],
  setEmployeeList,
  serviceList = [],
  salonId,
  salonTimezone,
  canManageEmployees = false,
  isLoading = false,
  loadError = null,
}) {
  const [invitationsRevision, setInvitationsRevision] =
    useState(0)

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
    if (!canManageEmployees) {
      return
    }

    setEditingEmployee(null)
    setIsFormOpen(true)
  }

  function startEditingEmployee(employee) {
    if (!canManageEmployees) {
      return
    }

    setEditingEmployee(employee)
    setIsFormOpen(true)
  }

  async function addEmployee(
    newEmployee
  ) {
     if (!canManageEmployees) {
      return false
    }
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
    salonTimezone
  )

      await createEmployeeRequest(
        employeePayload
      )

      const backendEmployees =
        await fetchEmployees()

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
     if (!canManageEmployees) {
      return false
    }
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
    salonTimezone
  )

      await updateEmployeeRequest(
        updatedEmployee.id,
        employeePayload
      )

      const backendEmployees =
        await fetchEmployees()

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
      if (!canManageEmployees) {
      return false
    }
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
    active:
      !employee.active,
  }
)

      const backendEmployees =
        await fetchEmployees()

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
            {canManageEmployees ? 'Tim' : 'Profil'}
          </span>

          <h1>
            {canManageEmployees ? 'Zaposlenici' : 'Moj profil'}
          </h1>

          <p>
            {canManageEmployees
              ? 'Upravljajte zaposlenicima salona i njihovim statusom.'
              : 'Pregled vašeg profila i redovnog radnog vremena.'}
          </p>
        </div>

        {canManageEmployees && (
          <div className="employees-header-actions">
            <button
              type="button"
              className="employees-add-button"
              onClick={openAddEmployeeForm}
              disabled={isLoading || Boolean(loadError)}
            >
              + Novi zaposlenik
            </button>

            {!isLoading && !loadError && (
              <div className="employees-count">
                <span>Aktivni zaposlenici</span>
                <strong>{activeEmployees.length}</strong>
              </div>
            )}
          </div>
        )}
      </div>

      {loadError ? (
        <div className="employees-placeholder" role="alert">
          <h2>Podatke nije moguće učitati</h2>
          <p>
            {typeof loadError === 'string'
              ? loadError
              : loadError.message ||
                'Pokušajte ponovno osvježiti stranicu.'}
          </p>
        </div>
      ) : isLoading ? (
        <div className="employees-placeholder" role="status">
          <p>Učitavanje podataka…</p>
        </div>
      ) : (
        <>
          {canManageEmployees && (
            <>
              <InvitationManager
                employeeList={employeeList}
                refreshToken={invitationsRevision}
                onChanged={() =>
                  setInvitationsRevision((value) => value + 1)
                }
              />

              <InvitationList
                refreshToken={invitationsRevision}
                onChanged={() =>
                  setInvitationsRevision((value) => value + 1)
                }
              />
            </>
          )}

          {canManageEmployees && isFormOpen && (
            <div
              ref={employeeFormSectionRef}
              className="employees-form-section"
            >
              <EmployeeForm
                serviceList={serviceList}
                onAddEmployee={addEmployee}
                onUpdateEmployee={updateEmployee}
                onCancelEdit={cancelEmployeeForm}
                editingEmployee={editingEmployee}
              />
            </div>
          )}

          {employeeList.length === 0 ? (
            <div className="employees-placeholder">
              <h2>
                {canManageEmployees
                  ? 'Još nema zaposlenika'
                  : 'Profil zaposlenika nije dostupan'}
              </h2>

              <p>
                {canManageEmployees
                  ? 'Dodajte prvog zaposlenika kako biste počeli graditi tim salona.'
                  : 'Obratite se administratoru salona radi provjere svojeg profila.'}
              </p>

              {canManageEmployees && (
                <button
                  type="button"
                  className="employees-add-button"
                  onClick={openAddEmployeeForm}
                >
                  + Dodaj prvog zaposlenika
                </button>
              )}
            </div>
          ) : (
            <div className="employees-list">
              {employeeList.map((employee) => (
                <EmployeeCard
                  key={employee.id}
                  employee={employee}
                  serviceList={serviceList}
                  canManageEmployees={canManageEmployees}
                  onEdit={startEditingEmployee}
                  onToggleActive={toggleEmployeeActive}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Employees