import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'

import { appointments } from './data/appointments'
import { clients } from './data/clients'
import { services } from './data/services'

import Layout from './components/Layout/Layout'

import Services from './pages/Services/Services'
import Appointments from './pages/Appointments/Appointments'
import Calendar from './pages/Calendar/Calendar'
import Clients from './pages/Clients/Clients'
import Dashboard from './pages/Dashboard/Dashboard'

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
    useState(() => {
      const savedServices =
        localStorage.getItem(
          'salonai-services'
        )

      if (savedServices) {
        try {
          const parsedServices =
            JSON.parse(savedServices)

          return parsedServices.map(
            (service) => ({
              ...service,
              category:
                service.category ||
                'Ostalo',
            })
          )
        } catch (error) {
          console.error(
            'Neuspješno učitavanje spremljenih usluga:',
            error
          )
        }
      }

      return services
    })

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
  ] = useState(() => {
    const savedAppointments =
      localStorage.getItem(
        'salonai-appointments'
      )

    let migratedAppointments

    if (savedAppointments) {
      try {
        const parsedAppointments =
          JSON.parse(savedAppointments)

        migratedAppointments =
          migrateAppointments(
            parsedAppointments,
            serviceList,
            clientList
          )
      } catch (error) {
        console.error(
          'Neuspješno učitavanje spremljenih termina:',
          error
        )

        migratedAppointments =
          migrateAppointments(
            appointments,
            serviceList,
            clientList
          )
      }
    } else {
      migratedAppointments =
        migrateAppointments(
          appointments,
          serviceList,
          clientList
        )
    }

    localStorage.setItem(
      'salonai-appointments',
      JSON.stringify(
        migratedAppointments
      )
    )

    return migratedAppointments
  })

  useEffect(() => {
    localStorage.setItem(
      'salonai-clients',
      JSON.stringify(clientList)
    )
  }, [clientList])

  useEffect(() => {
    localStorage.setItem(
      'salonai-appointments',
      JSON.stringify(appointmentList)
    )
  }, [appointmentList])

  useEffect(() => {
    localStorage.setItem(
      'salonai-services',
      JSON.stringify(serviceList)
    )
  }, [serviceList])

  function exportSalonData() {
    const salonData = {
      clients: clientList,
      services: serviceList,
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
          Array.isArray(
            importedData.clients
          ) &&
          Array.isArray(
            importedData.services
          ) &&
          Array.isArray(
            importedData.appointments
          )

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
          element={<Dashboard />}
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
              serviceList={
                serviceList
              }
              clientList={
                clientList
              }
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