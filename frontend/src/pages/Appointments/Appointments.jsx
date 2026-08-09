import { useEffect, useState } from 'react'

import AppointmentCard from '../../components/AppointmentCard/AppointmentCard'
import AppointmentForm from '../../components/AppointmentForm/AppointmentForm'

import './Appointments.css'

function getTodayDate() {
  const today = new Date()
  const timezoneOffset = today.getTimezoneOffset() * 60_000
  const localDate = new Date(today.getTime() - timezoneOffset)

  return localDate.toISOString().split('T')[0]
}

function Appointments({
  appointmentList,
  setAppointmentList,
  serviceList,
  initialAppointmentDate,
  clearInitialAppointmentDate,
  initialEditingAppointmentId,
  clearInitialEditingAppointmentId,
}) {

  const [formInitialDate] = useState(
  initialAppointmentDate || ''
)

  const [editingAppointment, setEditingAppointment] =
    useState(null)

  useEffect(() => {
  if (initialAppointmentDate) {
    clearInitialAppointmentDate()
  }
}, [
  initialAppointmentDate,
  clearInitialAppointmentDate,
])

useEffect(() => {
  if (!initialEditingAppointmentId) {
    return
  }

  const appointmentToEdit = appointmentList.find(
    (appointment) =>
      appointment.id === initialEditingAppointmentId
  )

  if (appointmentToEdit) {
    setEditingAppointment(appointmentToEdit)
  }

  clearInitialEditingAppointmentId()
}, [
  initialEditingAppointmentId,
  appointmentList,
  clearInitialEditingAppointmentId,
])

  function completeAppointment(appointmentId) {
    setAppointmentList((currentAppointments) =>
      currentAppointments.map((appointment) =>
        appointment.id === appointmentId
          ? {
              ...appointment,
              status: 'Završen',
            }
          : appointment
      )
    )
  }

  function deleteAppointment(appointmentId) {
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
    const appointmentWithDate = {
      ...newAppointment,
      date: newAppointment.date || getTodayDate(),
    }

    setAppointmentList((currentAppointments) => [
      ...currentAppointments,
      appointmentWithDate,
    ])
  }

  function updateAppointment(updatedAppointment) {
    const appointmentWithDate = {
      ...updatedAppointment,
      date: updatedAppointment.date || getTodayDate(),
    }

    setAppointmentList((currentAppointments) =>
      currentAppointments.map((appointment) =>
        appointment.id === appointmentWithDate.id
          ? appointmentWithDate
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
      const firstDate =
        firstAppointment.date || getTodayDate()

      const secondDate =
        secondAppointment.date || getTodayDate()

      const dateComparison =
        firstDate.localeCompare(secondDate)

      if (dateComparison !== 0) {
        return dateComparison
      }

      return firstAppointment.time.localeCompare(
        secondAppointment.time
      )
    }
  )

  const scheduledAppointmentsCount =
    appointmentList.filter(
      (appointment) =>
        appointment.status !== 'Završen'
    ).length

  const completedAppointmentsCount =
    appointmentList.filter(
      (appointment) =>
        appointment.status === 'Završen'
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
        serviceList={serviceList}
        onAddAppointment={addAppointment}
        onUpdateAppointment={updateAppointment}
        onCancelEdit={cancelEditingAppointment}
        editingAppointment={editingAppointment}
        initialDate={formInitialDate}
      />

      <div className="appointments-list">
        {sortedAppointments.length === 0 ? (
          <div className="appointments-empty-state">
            <span className="appointments-empty-icon">
              📅
            </span>

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