import {
  useEffect,
  useRef,
  useState,
} from 'react'

import AppointmentCard from '../../components/AppointmentCard/AppointmentCard'
import AppointmentForm from '../../components/AppointmentForm/AppointmentForm'

import {
  createAppointment,
  rescheduleAppointment,
  updateAppointmentStatus,
} from '../../api/appointmentApi'

import {
  salonDateTimeToUtcIso,
} from '../../api/appointmentDateTime'

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
  salonTimezone,
  salonId,
  serviceList,
  clientList,
  initialAppointmentDate,
  clearInitialAppointmentDate,
  initialEditingAppointmentId,
  employeeList,
  clearInitialEditingAppointmentId,
  appointmentsLoading,
  appointmentsLoadError,
}) {

  const [formInitialDate] = useState(
    initialAppointmentDate || ''
  )

  const [editingAppointment, setEditingAppointment] =
    useState(null)

  const appointmentFormRef = useRef(null)

  const [
    updatingAppointmentId,
    setUpdatingAppointmentId,
  ] = useState(null)

  const [
    isCreatingAppointment,
    setIsCreatingAppointment,
  ] = useState(false)

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

  async function completeAppointment(
    appointmentId
  ) {
    if (updatingAppointmentId !== null) {
      return
    }

    setUpdatingAppointmentId(
      appointmentId
    )

    try {
      await updateAppointmentStatus(
        appointmentId,
        'completed'
      )

      setAppointmentList(
        (currentAppointments) =>
          currentAppointments.map(
            (appointment) =>
              appointment.id ===
                appointmentId
                ? {
                  ...appointment,
                  status: 'Završen',
                  statusCode: 'completed',
                }
                : appointment
          )
      )
    } catch (error) {
      console.error(
        'Neuspješno označavanje termina kao završenog:',
        error
      )

      window.alert(
        error.message ||
        'Termin nije moguće označiti kao završen.'
      )
    } finally {
      setUpdatingAppointmentId(null)
    }
  }

  async function cancelAppointment(
    appointmentId
  ) {
    const isConfirmed = window.confirm(
      'Jeste li sigurni da želite otkazati ovaj termin?'
    )

    if (!isConfirmed) {
      return
    }

    if (updatingAppointmentId !== null) {
      return
    }

    setUpdatingAppointmentId(
      appointmentId
    )

    try {
      await updateAppointmentStatus(
        appointmentId,
        'cancelled'
      )

      setAppointmentList(
        (currentAppointments) =>
          currentAppointments.map(
            (appointment) =>
              appointment.id ===
                appointmentId
                ? {
                  ...appointment,
                  status: 'Otkazano',
                  statusCode: 'cancelled',
                }
                : appointment
          )
      )

      if (
        editingAppointment?.id ===
        appointmentId
      ) {
        setEditingAppointment(null)
      }
    } catch (error) {
      console.error(
        'Neuspješno otkazivanje termina:',
        error
      )

      window.alert(
        error.message ||
        'Termin trenutno nije moguće otkazati.'
      )
    } finally {
      setUpdatingAppointmentId(null)
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

  async function addAppointment(newAppointment) {
    if (!salonId || !salonTimezone) {
      window.alert(
        'Podaci salona nisu učitani. Pokušajte ponovno.'
      )

      return false
    }

    if (isCreatingAppointment) {
      return false
    }

    setIsCreatingAppointment(true)

    try {
      const startsAt =
        salonDateTimeToUtcIso(
          newAppointment.date,
          newAppointment.time,
          salonTimezone
        )

      const backendAppointment =
        await createAppointment({
          salonId,
          clientId: newAppointment.clientId,
          employeeId: newAppointment.employeeId,
          serviceId: newAppointment.serviceId,
          startsAt,
          notes: newAppointment.notes ?? null,
        })

      const createdAppointment = {
        ...newAppointment,

        id: backendAppointment.id,

        date:
          newAppointment.date ||
          getTodayDate(),

        startsAt:
          backendAppointment.starts_at,

        endsAt:
          backendAppointment.ends_at,

        durationMinutes:
          backendAppointment.duration_minutes,

        priceCents:
          backendAppointment.price_cents,

        status: 'Zakazano',

        statusCode:
          backendAppointment.status,

        source:
          backendAppointment.source,

        notes:
          backendAppointment.notes,
      }

      setAppointmentList(
        (currentAppointments) => [
          ...currentAppointments,
          createdAppointment,
        ]
      )
      return true
    } catch (error) {
      console.error(
        'Neuspješno kreiranje termina:',
        error
      )

      window.alert(
        error.message ||
        'Termin trenutno nije moguće kreirati.'
      )
      return false
    } finally {
      setIsCreatingAppointment(false)
    }
  }

  async function updateAppointment(
    updatedAppointment
  ) {
    if (!editingAppointment) {
      return false
    }

    if (!salonTimezone) {
      window.alert(
        'Vremenska zona salona nije učitana. Pokušajte ponovno.'
      )

      return false
    }

    const clientChanged =
      String(updatedAppointment.clientId) !==
      String(editingAppointment.clientId)

    const employeeChanged =
      String(updatedAppointment.employeeId) !==
      String(editingAppointment.employeeId)

    const serviceChanged =
      String(updatedAppointment.serviceId) !==
      String(editingAppointment.serviceId)

    if (
      clientChanged ||
      employeeChanged ||
      serviceChanged
    ) {
      window.alert(
        'U ovom koraku moguće je mijenjati samo datum i vrijeme termina.'
      )

      return false
    }

    if (updatingAppointmentId !== null) {
      return false
    }

    setUpdatingAppointmentId(
      updatedAppointment.id
    )

    try {
      const startsAt =
        salonDateTimeToUtcIso(
          updatedAppointment.date,
          updatedAppointment.time,
          salonTimezone
        )

      const backendAppointment =
        await rescheduleAppointment(
          updatedAppointment.id,
          startsAt
        )

      setAppointmentList(
        (currentAppointments) =>
          currentAppointments.map(
            (appointment) =>
              appointment.id ===
                updatedAppointment.id
                ? {
                  ...appointment,

                  date:
                    updatedAppointment.date,

                  time:
                    updatedAppointment.time,

                  startsAt:
                    backendAppointment
                      .starts_at,

                  endsAt:
                    backendAppointment
                      .ends_at,
                }
                : appointment
          )
      )

      setEditingAppointment(null)

      return true
    } catch (error) {
      console.error(
        'Neuspješno premještanje termina:',
        error
      )

      window.alert(
        error.message ||
        'Termin trenutno nije moguće premjestiti.'
      )

      return false
    } finally {
      setUpdatingAppointmentId(null)
    }
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
        ['pending', 'confirmed'].includes(
          appointment.statusCode
        )
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
    upcomingAppointments.length

  const completedAppointmentsCount =
    appointmentList.filter(
      (appointment) =>
        appointment.status === 'Završen'
    ).length

  if (appointmentsLoading) {
    return (
      <div className="appointments-page">
        <h1>Termini</h1>

        <p>
          Učitavanje termina...
        </p>
      </div>
    )
  }

  if (appointmentsLoadError) {
    return (
      <div className="appointments-page">
        <h1>Termini</h1>

        <p>
          Termine trenutno nije moguće učitati.
        </p>
      </div>
    )
  }

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
          employeeList={employeeList}
          onAddAppointment={addAppointment}
          onUpdateAppointment={updateAppointment}
          onCancelEdit={cancelEditingAppointment}
          editingAppointment={editingAppointment}
          isUpdating={
            editingAppointment !== null &&
            updatingAppointmentId ===
            editingAppointment.id
          }
          isCreating={
            isCreatingAppointment
          }
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
              onCancel={cancelAppointment}
              onEdit={startEditingAppointment}
              isUpdating={
                updatingAppointmentId ===
                appointment.id
              }
            />
          ))
        )}
      </div>
    </div>
  )
}

export default Appointments