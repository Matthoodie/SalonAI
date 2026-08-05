import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'

import { appointments } from './data/appointments'
import { clients } from './data/clients'

import Layout from './components/Layout/Layout'

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

function migrateAppointments(appointmentsToMigrate) {
  const fallbackDate = getTodayDate()

  return appointmentsToMigrate.map((appointment) => ({
    ...appointment,
    date: appointment.date || fallbackDate,
  }))
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
          parsedAppointments
        )
      } catch (error) {
        console.error(
          'Neuspješno učitavanje spremljenih termina:',
          error
        )

        migratedAppointments = migrateAppointments(appointments)
      }
    } else {
      migratedAppointments = migrateAppointments(appointments)
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
  path="/appointments"
  element={
    <Appointments
  appointmentList={appointmentList}
  setAppointmentList={setAppointmentList}
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