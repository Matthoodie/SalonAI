import { useState, useEffect } from 'react'
import { appointments } from '../../data/appointments'
import AppointmentCard from '../../components/AppointmentCard/AppointmentCard'
import AppointmentForm from '../../components/AppointmentForm/AppointmentForm'
import './Appointments.css'

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

function Appointments({ clientList }) {

const [appointmentList, setAppointmentList] = useState(() => {
  const savedAppointments = localStorage.getItem(
    'salonai-appointments'
  )

  let migratedAppointments

  if (savedAppointments) {
    try {
      const parsedAppointments = JSON.parse(savedAppointments)

      migratedAppointments = migrateAppointments(parsedAppointments)
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

const [editingAppointment, setEditingAppointment] = useState(null)

useEffect(() => {
  localStorage.setItem(
    'salonai-appointments',
    JSON.stringify(appointmentList)
  )
}, [appointmentList])

function completeAppointment(appointmentId) {
  const updatedAppointments = appointmentList.map((appointment) => {
    if (appointment.id === appointmentId) {
      return {
        ...appointment,
        status: 'Završen',
      }
    }

    return appointment
  })

  setAppointmentList(updatedAppointments)
}

const deleteAppointment = (appointmentId) => {
  const isConfirmed = window.confirm(
    'Jeste li sigurni da želite obrisati ovaj termin?'
  )

  if (!isConfirmed) {
    return
  }

  setAppointmentList((currentAppointments) =>
    currentAppointments.filter(
      (appointment) => appointment.id !== appointmentId
    )
  )

  if (editingAppointment?.id === appointmentId) {
    setEditingAppointment(null)
  }
}

function startEditingAppointment(appointment) {
  setEditingAppointment(appointment)
}

function addAppointment(newAppointment) {

  setAppointmentList([
    ...appointmentList,
    newAppointment
  ])

}


function updateAppointment(updatedAppointment) {
  setAppointmentList(currentAppointments =>
    currentAppointments.map(appointment =>
      appointment.id === updatedAppointment.id
        ? updatedAppointment
        : appointment
    )
  )

  setEditingAppointment(null)
}

function cancelEditingAppointment() {
  setEditingAppointment(null)
}

const sortedAppointments = [...appointmentList].sort(
  (firstAppointment, secondAppointment) => {
    const dateComparison = firstAppointment.date.localeCompare(
      secondAppointment.date
    )

    if (dateComparison !== 0) {
      return dateComparison
    }

    return firstAppointment.time.localeCompare(
      secondAppointment.time
    )
  }
)

const scheduledAppointmentsCount = appointmentList.filter(
  (appointment) => appointment.status !== 'Završen'
).length

const completedAppointmentsCount = appointmentList.filter(
  (appointment) => appointment.status === 'Završen'
).length

  return (
    <div className="appointments-page">

      <h1>Termini</h1>

      <div className="appointments-summary">
  <div className="appointments-summary-item">
    <span>Ukupno</span>
    <strong>{appointmentList.length}</strong>
  </div>

  <div className="appointments-summary-item">
    <span>Zakazano</span>
    <strong>{scheduledAppointmentsCount}</strong>
  </div>

  <div className="appointments-summary-item">
    <span>Završeno</span>
    <strong>{completedAppointmentsCount}</strong>
  </div>
</div>

    <AppointmentForm
  appointments={appointmentList}
  onAddAppointment={addAppointment}
  onUpdateAppointment={updateAppointment}
  onCancelEdit={cancelEditingAppointment}
  editingAppointment={editingAppointment}
/>

      <div className="appointments-list">
  {sortedAppointments.length === 0 ? (
    <div className="appointments-empty-state">
      <span className="appointments-empty-icon">📅</span>

      <h3>Nema zakazanih termina</h3>

      <p>
        Dodajte prvi termin pomoću obrasca iznad.
      </p>
    </div>
  ) : (
    sortedAppointments.map((appointment) => (
      <AppointmentCard
        key={appointment.id}
        appointment={appointment}
        onComplete={completeAppointment}
        onDelete={deleteAppointment}
        onEdit={startEditingAppointment}
      />
    ))
  )}
</div>

    </div>
  )
}

export default Appointments