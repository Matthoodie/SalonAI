import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'

import { appointments } from './data/appointments'
import { clients } from './data/clients'
import { services } from './data/services'

import {
  fetchCalendar,
} from './api/calendarApi'

import {
  mapCalendarResponseToAppointments,
} from './api/appointmentMapper'

import {
  fetchServices,
} from './api/serviceApi'

import {
  fetchEmployees,
} from './api/employeeApi'

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
  ] = useState(false)

  const [
    employeesLoadError,
    setEmployeesLoadError,
  ] = useState(null)

  const [clientList, setClientList] =
    useState(() => {
      const savedClients =
        localStorage.getItem(
          'salonai-clients'
        )

      if (savedClients) {
        try {
          const parsedClients =
            JSON.parse(savedClients)

          return parsedClients.map(
            (client) => {
              if (
                client.phoneCountryCode &&
                client.phoneNumber &&
                client.phoneNormalized
              ) {
                return client
              }

              const digitsOnly = String(
                client.phone || ''
              ).replace(/\D/g, '')

              let phoneNumber = digitsOnly

              if (
                phoneNumber.startsWith('0')
              ) {
                phoneNumber =
                  phoneNumber.slice(1)
              }

              return {
                ...client,

                phoneCountryCode:
                  client.phoneCountryCode ||
                  '+385',

                phoneNumber:
                  client.phoneNumber ||
                  phoneNumber,

                phoneNormalized:
                  client.phoneNormalized ||
                  (
                    phoneNumber
                      ? `+385${phoneNumber}`
                      : ''
                  ),
              }
            }
          )
        } catch (error) {
          console.error(
            'Neuspješno učitavanje spremljenih klijenata:',
            error
          )
        }
      }

      return clients
    })

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
        const {
          from,
          to,
        } = getInitialCalendarRange()

        const calendarData =
          await fetchCalendar({
            salonId: 1,
            from,
            to,
          })

        if (cancelled) {
          return
        }

        setSalonTimezone(
          calendarData.salon.timezone
        )

        setSalonId(
          calendarData.salon.id
        )

        const backendServices =
          await fetchServices(
            calendarData.salon.id
          )

        if (cancelled) {
          return
        }

        setServiceList(
          mapServicesToFrontend(
            backendServices
          )
        )

        const backendAppointments =
          mapCalendarResponseToAppointments(
            calendarData
          )

        setAppointmentList(
          backendAppointments
        )
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

  useEffect(() => {
  let cancelled = false

  async function loadEmployeesFromBackend() {
    try {
      setEmployeesLoading(true)
      setEmployeesLoadError(null)

      const backendEmployees =
        await fetchEmployees({
          salonId: 1,
        })

      if (cancelled) {
        return
      }

      const mappedEmployees =
        mapEmployeesToFrontend(
          backendEmployees
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
}, [])

  useEffect(() => {
    localStorage.setItem(
      'salonai-clients',
      JSON.stringify(clientList)
    )
  }, [clientList])

  function exportSalonData() {
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
    <Layout>
      <div className="data-tools">
        <button
          type="button"
          onClick={exportSalonData}
        >
          Export podataka
        </button>

        <label>
          Import podataka

          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file =
                event.target.files?.[0]

              importSalonData(file)

              event.target.value = ''
            }}
          />
        </label>
      </div>

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
            <Clients
              clientList={clientList}
              setClientList={
                setClientList
              }
              appointmentList={
                appointmentList
              }
            />
          }
        />

        <Route
          path="/services"
          element={
            <Services
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
              employeeList={employeeList}
              setEmployeeList={setEmployeeList}
              serviceList={serviceList}
              salonId={salonId}
            />
          }
        />

        <Route
          path="/appointments"
          element={
            <Appointments
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
            />
          }
        />
      </Routes>
    </Layout>
  )
}

export default App