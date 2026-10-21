import { fetchCurrentAuth } from './api/authApi'
import { mapClientToFrontend } from './api/clientMapper'
import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'

import {
  fetchCalendar,
} from './api/calendarApi'

import {
  mapAppointmentRowsToFrontend,
  mapCalendarResponseToAppointments,
} from './api/appointmentMapper'

import {
  fetchAppointments,
} from './api/appointmentApi'

import {
  fetchServices,
} from './api/serviceApi'

import {
  fetchEmployees,
} from './api/employeeApi'

import {
  fetchClients,
} from './api/clientApi'

import {
  mapEmployeesToFrontend,
} from './api/employeeMapper'

import {
  mapServicesToFrontend,
} from './api/serviceMapper'

import Layout from './components/Layout/Layout'

import Services from './pages/Services/Services'
import Appointments from './pages/Appointments/Appointments'
import Calendar from './pages/Calendar/Calendar'
import Clients from './pages/Clients/Clients'
import Dashboard from './pages/Dashboard/Dashboard'
import Employees from './pages/Employees/Employees'

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

function formatDateKey(date) {
  const year = date.getFullYear()

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0')

  const day = String(
    date.getDate()
  ).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getInitialCalendarRange() {
  const today = new Date()

  const rangeStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    1
  )

  const rangeEnd = new Date(
    today.getFullYear(),
    today.getMonth() + 2,
    0
  )

  return {
    from: formatDateKey(rangeStart),
    to: formatDateKey(rangeEnd),
  }
}

function getCalendarGridRange(displayedDate) {
  const firstDayOfMonth = new Date(
    displayedDate.getFullYear(),
    displayedDate.getMonth(),
    1
  )

  const daysBeforeMonday =
    (firstDayOfMonth.getDay() + 6) % 7

  const gridStart = new Date(
    firstDayOfMonth.getFullYear(),
    firstDayOfMonth.getMonth(),
    1 - daysBeforeMonday
  )

  const gridEnd = new Date(
    gridStart.getFullYear(),
    gridStart.getMonth(),
    gridStart.getDate() + 41
  )

  return {
    from: formatDateKey(gridStart),
    to: formatDateKey(gridEnd),
  }
}

function migrateAppointments(
  appointmentsToMigrate,
  serviceList,
  clientList
) {
  const fallbackDate = getTodayDate()

  return appointmentsToMigrate.map(
    (appointment) => {
      const legacyServiceName =
        appointment.serviceName ||
        appointment.service ||
        ''

      const matchingService =
        serviceList.find(
          (serviceItem) =>
            serviceItem.name ===
            legacyServiceName
        )

      const matchingClient =
        clientList.find(
          (client) =>
            client.name
              .trim()
              .toLowerCase() ===
            String(
              appointment.clientName || ''
            )
              .trim()
              .toLowerCase()
        )

      return {
        ...appointment,

        clientId:
          appointment.clientId ??
          matchingClient?.id ??
          null,

        clientName:
          appointment.clientName ||
          matchingClient?.name ||
          '',

        date:
          appointment.date ||
          fallbackDate,

        serviceId:
          appointment.serviceId ??
          matchingService?.id ??
          null,

        serviceName:
          appointment.serviceName ||
          legacyServiceName,

        servicePrice:
          appointment.servicePrice ??
          matchingService?.price ??
          null,

        serviceDurationMinutes:
          appointment.serviceDurationMinutes ??
          matchingService?.defaultDurationMinutes ??
          null,
      }
    }
  )
}

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

function migrateEmployees(
  employeesToMigrate
) {
  return employeesToMigrate.map(
    (employee) => ({
      ...employee,

      workingHours:
        employee.workingHours ||
        createDefaultWorkingHours(),

      dateOverrides:
        Array.isArray(
          employee.dateOverrides
        )
          ? employee.dateOverrides
          : [],

      timeOff:
        Array.isArray(
          employee.timeOff
        )
          ? employee.timeOff
          : [],

      blockedTimes:
        Array.isArray(
          employee.blockedTimes
        )
          ? employee.blockedTimes
          : [],
    })
  )
}

function App() {
  const [authContext, setAuthContext] = useState(null)
  const canAccessFullCrm =
    authContext?.membership?.role === 'owner' ||
    authContext?.membership?.role === 'admin'

    const canManageEmployees =
    authContext?.membership?.role === 'owner' ||
    authContext?.membership?.role === 'admin'

    const canManageServices =
    authContext?.membership?.role === 'owner' ||
    authContext?.membership?.role === 'admin'

  const [
    appointmentFormInitialDate,
    setAppointmentFormInitialDate,
  ] = useState('')

  const [
    appointmentFormEditingId,
    setAppointmentFormEditingId,
  ] = useState(null)

  const [serviceList, setServiceList] =
    useState([])

  const [employeeList, setEmployeeList] =
    useState([])

   const [
    employeesLoading,
    setEmployeesLoading,
  ] = useState(true)

  const [
    employeesLoadError,
    setEmployeesLoadError,
  ] = useState(null)

  const [clientList, setClientList] = useState([])

  const [
    appointmentList,
    setAppointmentList,
  ] = useState([])

  const [
    appointmentsLoading,
    setAppointmentsLoading,
  ] = useState(true)

  const [
    appointmentsLoadError,
    setAppointmentsLoadError,
  ] = useState(null)

  const [
    salonTimezone,
    setSalonTimezone,
  ] = useState(null)

  const [
    salonId,
    setSalonId,
  ] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadAppointmentsFromBackend() {
      try {
        setAppointmentsLoading(true)
        setAppointmentsLoadError(null)
        const currentAuth = await fetchCurrentAuth()

        if (cancelled) {
          return
        }

        setAuthContext(currentAuth)

        setSalonTimezone(
          currentAuth.current_salon.timezone
        )

        setSalonId(
          currentAuth.current_salon.id
        )

        const backendServices =
         await fetchServices()

        if (cancelled) {
          return
        }

        setServiceList(
          mapServicesToFrontend(
            backendServices
          )
        )

        const [
          backendClients,
          backendEmployees,
          backendAppointments,
        ] = await Promise.all([
          ['owner', 'admin'].includes(
            currentAuth.membership.role
          )
            ? fetchClients()
            : Promise.resolve([]),
          fetchEmployees(),
          fetchAppointments(),
        ])

        if (cancelled) {
          return
        }

        const mappedAppointments =
          mapAppointmentRowsToFrontend(
            backendAppointments,
            currentAuth.current_salon.timezone,
            backendClients,
            backendEmployees,
            backendServices
          )

        setAppointmentList(mappedAppointments)
      } catch (error) {
        console.error(
          'Neuspješno učitavanje termina s backenda:',
          error
        )

        if (!cancelled) {
          setAppointmentsLoadError(error)
        }
      } finally {
        if (!cancelled) {
          setAppointmentsLoading(false)
        }
      }
    }

    loadAppointmentsFromBackend()

    return () => {
      cancelled = true
    }
  }, [])

  async function loadCalendarMonth(displayedDate) {
    if (!salonId) {
      return
    }

    const { from, to } =
      getCalendarGridRange(displayedDate)

    try {
      const calendarData = await fetchCalendar({
           from,
           to,
         })

      const fetchedAppointments =
        mapCalendarResponseToAppointments(calendarData)

      setAppointmentList((currentAppointments) => {
        const appointmentsById = new Map(
          currentAppointments.map((appointment) => [
            String(appointment.id),
            appointment,
          ])
        )

        for (const appointment of fetchedAppointments) {
          const appointmentId = String(appointment.id)

          if (!appointmentsById.has(appointmentId)) {
            appointmentsById.set(
              appointmentId,
              appointment
            )
          }
        }

        return [...appointmentsById.values()]
      })
    } catch (error) {
      console.error(
        'Neuspješno učitavanje odabranog mjeseca:',
        error
      )

      window.alert(
        error.message ||
        'Nije moguće učitati termine za odabrani mjesec.'
      )
    }
  }

  useEffect(() => {
  if (!salonTimezone) {
    return
  }

  let cancelled = false

  async function loadEmployeesFromBackend() {
      try {
        setEmployeesLoading(true)
        setEmployeesLoadError(null)

      const backendEmployees =
         await fetchEmployees()

        if (cancelled) {
          return
        }

        const mappedEmployees =
          mapEmployeesToFrontend(
            backendEmployees,
            salonTimezone
          )

        setEmployeeList(
          mappedEmployees
        )
      } catch (error) {
        if (cancelled) {
          return
        }

        console.error(
          'Neuspješno učitavanje zaposlenika:',
          error
        )

        setEmployeesLoadError(
          error.message ||
          'Zaposlenike trenutno nije moguće učitati.'
        )
      } finally {
        if (!cancelled) {
          setEmployeesLoading(false)
        }
      }
    }

    loadEmployeesFromBackend()

    return () => {
      cancelled = true
    }
  }, [salonTimezone])

  useEffect(() => {
    if (!salonId || !canAccessFullCrm) {
      setClientList([])
      return
    }

    let cancelled = false

    async function loadClientsFromBackend() {
      try {
        const backendClients =
  await fetchClients()

        if (cancelled) {
          return
        }

    const mappedClients = backendClients.map(
          (client) => ({
            ...mapClientToFrontend(client),
            visits: 0,
          })
        )

        setClientList(mappedClients)
      } catch (error) {
        if (cancelled) {
          return
        }

        console.error(
          'Neuspješno učitavanje klijenata iz baze:',
          error
        )

        setClientList([])
      }
    }

    loadClientsFromBackend()

    return () => {
      cancelled = true
    }
   }, [salonId, canAccessFullCrm])

  function exportSalonData() {
      if (!canAccessFullCrm) {
      return
    }
    const salonData = {
      clients: clientList,
      services: serviceList,
      employees: employeeList,
      appointments: appointmentList,
      exportedAt:
        new Date().toISOString(),
      version: 1,
    }

    const dataString =
      JSON.stringify(
        salonData,
        null,
        2
      )

    const dataBlob = new Blob(
      [dataString],
      {
        type: 'application/json',
      }
    )

    const downloadUrl =
      URL.createObjectURL(dataBlob)

    const downloadLink =
      document.createElement('a')

    downloadLink.href =
      downloadUrl

    downloadLink.download =
      `salonai-backup-${getTodayDate()}.json`

    document.body.appendChild(
      downloadLink
    )

    downloadLink.click()
    downloadLink.remove()

    URL.revokeObjectURL(
      downloadUrl
    )
  }

  function importSalonData(file) {
    if (!file) {
      return
    }

    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const importedData =
          JSON.parse(
            event.target.result
          )

        const hasValidStructure =
          Array.isArray(importedData.clients) &&
          Array.isArray(importedData.services) &&
          Array.isArray(importedData.employees) &&
          Array.isArray(importedData.appointments)

        if (!hasValidStructure) {
          window.alert(
            'Odabrana datoteka nije valjani SalonAI backup.'
          )
          return
        }

        const isConfirmed =
          window.confirm(
            'Uvoz će zamijeniti trenutne lokalne podatke. Želite li nastaviti?'
          )

        if (!isConfirmed) {
          return
        }

        setClientList(
          importedData.clients
        )

        setServiceList(
          importedData.services
        )

        setEmployeeList(
          migrateEmployees(
            importedData.employees
          )
        )

        const migratedAppointments =
          migrateAppointments(
            importedData.appointments,
            importedData.services,
            importedData.clients
          )

        setAppointmentList(
          migratedAppointments
        )

        window.alert(
          'SalonAI podaci uspješno su uvezeni.'
        )
      } catch (error) {
        console.error(
          'Neuspješan uvoz SalonAI backupa:',
          error
        )

        window.alert(
          'Backup nije moguće učitati.'
        )
      }
    }

    reader.readAsText(file)
  }

  return (
    <Layout
      currentUser={authContext?.user}
      canAccessFullCrm={canAccessFullCrm}
    >
      {canAccessFullCrm && (
      <div className="data-tools">
        <button
          type="button"
          onClick={exportSalonData}
        >
          Export podataka
        </button>

        <label>
          Import podataka (privremeno nedostupno)

          <input
            type="file"
            accept="application/json,.json"
            disabled
            onChange={(event) => {
              const file =
                event.target.files?.[0]

              importSalonData(file)

              event.target.value = ''
            }}
          />
        </label>
      </div>
      )}

      <Routes>
        <Route
          path="/"
          element={
            <Dashboard
              appointmentList={appointmentList}
              clientList={clientList}
            />
          }
        />

        <Route
          path="/clients"
          element={
            !authContext ? (
              <p role="status">
                Učitavanje korisničkog računa…
              </p>
            ) : canAccessFullCrm ? (
              <Clients
                clientList={clientList}
                setClientList={setClientList}
                appointmentList={appointmentList}
                salonId={salonId}
              />
            ) : (
              <p role="alert">
                Nemate pristup bazi klijenata.
                Klijenta možete pronaći pri dodavanju termina.
              </p>
            )
          }
        />

        <Route
          path="/services"
          element={
            <Services
              canManageServices={canManageServices}
              serviceList={
                serviceList
              }
              setServiceList={
                setServiceList
              }
              salonId={
                salonId
              }
            />
          }
        />

        <Route
          path="/employees"
          element={
            <Employees
              canManageEmployees={canManageEmployees}
              isLoading={!authContext || employeesLoading}
              loadError={
                employeesLoadError ||
                (!authContext ? appointmentsLoadError : null)
              }
              employeeList={employeeList}
              setEmployeeList={setEmployeeList}
              serviceList={serviceList}
              salonId={salonId}
              salonTimezone={salonTimezone}
            />
          }
        />

        <Route
          path="/appointments"
          element={
            <Appointments
              authContext={authContext}
              appointmentList={
                appointmentList
              }
              setAppointmentList={
                setAppointmentList
              }
              salonTimezone={
                salonTimezone
              }
              salonId={
                salonId
              }
              serviceList={
                serviceList
              }
              clientList={
                clientList
              }
              setClientList={
                setClientList
              }
              employeeList={employeeList}

              initialAppointmentDate={
                appointmentFormInitialDate
              }
              clearInitialAppointmentDate={() =>
                setAppointmentFormInitialDate(
                  ''
                )
              }
              initialEditingAppointmentId={
                appointmentFormEditingId
              }
              clearInitialEditingAppointmentId={() =>
                setAppointmentFormEditingId(
                  null
                )
              }
            />
          }
        />

        <Route
          path="/calendar"
          element={
            <Calendar
              authContext={authContext}
              appointmentList={
                appointmentList
              }
              appointmentsLoading={
                appointmentsLoading
              }
              appointmentsLoadError={
                appointmentsLoadError
              }
              onRequestNewAppointment={
                setAppointmentFormInitialDate
              }
              onRequestEditAppointment={
                setAppointmentFormEditingId
              }
              onRequestMonthChange={
                loadCalendarMonth
              }
            />
          }
        />
      </Routes>
    </Layout>
  )
}

export default App