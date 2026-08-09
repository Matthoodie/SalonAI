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
  const timezoneOffset = today.getTimezoneOffset() * 60_000
  const localDate = new Date(today.getTime() - timezoneOffset)

  return localDate.toISOString().split('T')[0]
}

function migrateAppointments(
  appointmentsToMigrate,
  serviceList
) {
  const fallbackDate = getTodayDate()

  return appointmentsToMigrate.map((appointment) => {
    const legacyServiceName =
      appointment.serviceName ||
      appointment.service ||
      ''

    const matchingService = serviceList.find(
      (serviceItem) =>
        serviceItem.name === legacyServiceName
    )

    return {
      ...appointment,

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
  })
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

const [serviceList, setServiceList] = useState(() => {
  const savedServices = localStorage.getItem(
    'salonai-services'
  )

  if (savedServices) {
    try {
      return JSON.parse(savedServices)
    } catch (error) {
      console.error(
        'Neuspješno učitavanje spremljenih usluga:',
        error
      )
    }
  }

  return services
})

  const [clientList, setClientList] = useState(() => {
    const savedClients = localStorage.getItem('salonai-clients')

    if (savedClients) {
      try {
        return JSON.parse(savedClients)
      } catch (error) {
        console.error(
          'Neuspješno učitavanje spremljenih klijenata:',
          error
        )
      }
    }

    return clients
  })

  const [appointmentList, setAppointmentList] = useState(() => {
    const savedAppointments = localStorage.getItem(
      'salonai-appointments'
    )

    let migratedAppointments

    if (savedAppointments) {
      try {
        const parsedAppointments = JSON.parse(savedAppointments)

        migratedAppointments = migrateAppointments(
          parsedAppointments,
          services
        )
      } catch (error) {
        console.error(
          'Neuspješno učitavanje spremljenih termina:',
          error
        )

        migratedAppointments = migrateAppointments(
          appointments,
          services
        )
      }
    } else {
      migratedAppointments = migrateAppointments(
        appointments,
        services
      )
    }

    localStorage.setItem(
      'salonai-appointments',
      JSON.stringify(migratedAppointments)
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

  return (
    <Layout>
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
              setClientList={setClientList}
            />
          }
        />

<Route
  path="/services"
  element={
   <Services
  serviceList={serviceList}
  setServiceList={setServiceList}
/>
  }
/>
        <Route
  path="/appointments"
  element={
    <Appointments
  appointmentList={appointmentList}
  setAppointmentList={setAppointmentList}
  serviceList={serviceList}
  initialAppointmentDate={
    appointmentFormInitialDate
  }
  clearInitialAppointmentDate={() =>
    setAppointmentFormInitialDate('')
  }
  initialEditingAppointmentId={
    appointmentFormEditingId
  }
  clearInitialEditingAppointmentId={() =>
    setAppointmentFormEditingId(null)
  }
/>
  }
/>

<Route
  path="/calendar"
  element={
   <Calendar
  appointmentList={appointmentList}
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