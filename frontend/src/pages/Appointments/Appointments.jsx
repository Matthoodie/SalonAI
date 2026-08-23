import {
  useEffect,
  useRef,
  useState,
} from 'react'

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
  clientList,
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

  const appointmentFormRef = useRef(null)

  const [appointmentView, setAppointmentView] =
  useState('upcoming')

  const [searchQuery, setSearchQuery] =
  useState('')

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

  requestAnimationFrame(() => {
    appointmentFormRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  })
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

  const todayDate = getTodayDate()

const todayAppointments =
  sortedAppointments.filter(
    (appointment) =>
      appointment.date === todayDate
  )

const upcomingAppointments =
  sortedAppointments.filter(
    (appointment) =>
      appointment.date >= todayDate &&
      appointment.status !== 'Završen'
  )

const historyAppointments =
  sortedAppointments
    .filter(
      (appointment) =>
        appointment.date < todayDate ||
        appointment.status === 'Završen'
    )
    .sort(
      (
        firstAppointment,
        secondAppointment
      ) => {
        const firstDateTime =
          `${firstAppointment.date} ${firstAppointment.time}`

        const secondDateTime =
          `${secondAppointment.date} ${secondAppointment.time}`

        return secondDateTime.localeCompare(
          firstDateTime
        )
      }
    )


  let visibleAppointments =
  upcomingAppointments

if (appointmentView === 'today') {
  visibleAppointments =
    todayAppointments
}

if (appointmentView === 'history') {
  visibleAppointments =
    historyAppointments
}

if (appointmentView === 'all') {
  visibleAppointments =
    sortedAppointments
}

const normalizedSearchQuery =
  searchQuery.trim().toLowerCase()

const searchedAppointments =
  visibleAppointments.filter(
    (appointment) => {
      if (!normalizedSearchQuery) {
        return true
      }

      const searchableText = [
        appointment.clientName,
        appointment.serviceName,
        appointment.service,
        appointment.date,
        appointment.time,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchableText.includes(
        normalizedSearchQuery
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

      <div className="appointments-view-tabs">
  <button
    type="button"
    className={
      appointmentView === 'upcoming'
        ? 'appointments-view-tab appointments-view-tab-active'
        : 'appointments-view-tab'
    }
    onClick={() =>
      setAppointmentView('upcoming')
    }
  >
    Nadolazeći
    <span>
      {upcomingAppointments.length}
    </span>
  </button>

  <button
    type="button"
    className={
      appointmentView === 'today'
        ? 'appointments-view-tab appointments-view-tab-active'
        : 'appointments-view-tab'
    }
    onClick={() =>
      setAppointmentView('today')
    }
  >
    Danas
    <span>
      {todayAppointments.length}
    </span>
  </button>

  <button
    type="button"
    className={
      appointmentView === 'history'
        ? 'appointments-view-tab appointments-view-tab-active'
        : 'appointments-view-tab'
    }
    onClick={() =>
      setAppointmentView('history')
    }
  >
    Povijest
    <span>
      {historyAppointments.length}
    </span>
  </button>

  <button
    type="button"
    className={
      appointmentView === 'all'
        ? 'appointments-view-tab appointments-view-tab-active'
        : 'appointments-view-tab'
    }
    onClick={() =>
      setAppointmentView('all')
    }
  >
    Svi
    <span>
      {appointmentList.length}
    </span>
  </button>
</div>

<div className="appointments-search">
  <span
    className="appointments-search-icon"
    aria-hidden="true"
  >
    🔍
  </span>

  <input
    type="search"
    value={searchQuery}
    onChange={(event) =>
      setSearchQuery(event.target.value)
    }
    placeholder="Pretraži termine..."
    aria-label="Pretraži termine"
  />

  {searchQuery && (
    <button
      type="button"
      className="appointments-search-clear"
      onClick={() =>
        setSearchQuery('')
      }
      aria-label="Očisti pretragu"
    >
      ×
    </button>
  )}
</div>

      <div ref={appointmentFormRef}>
  <AppointmentForm
    appointments={appointmentList}
    serviceList={serviceList}
    clientList={clientList}
    onAddAppointment={addAppointment}
    onUpdateAppointment={updateAppointment}
    onCancelEdit={cancelEditingAppointment}
    editingAppointment={editingAppointment}
    initialDate={formInitialDate}
  />
</div>

      <div className="appointments-list">
        {searchedAppointments.length === 0 ? (
          <div className="appointments-empty-state">
            <span className="appointments-empty-icon">
              📅
            </span>

            <h3>
  Nema termina u ovom prikazu
</h3>

<p>
  Odaberite drugi prikaz ili dodajte novi termin.
</p>
          </div>
        ) : (
          searchedAppointments.map((appointment) => (
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