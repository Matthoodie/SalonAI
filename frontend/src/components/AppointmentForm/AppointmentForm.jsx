import ServiceSelection from './ServiceSelection.jsx'
import AppointmentServicesEditor from './AppointmentServicesEditor.jsx'
import { appointmentServicesApi } from '../../api/appointmentServicesApi.js'
import { draftItems, sumItems, employeeSupportsServices, formatServicePrice } from '../../api/appointmentItemsView.js'
import { getSalonLocalDateParts } from '../../api/salonDateTime.js'
import {
  canUseAppointmentPermission,
} from '../../api/appointmentPermissions'

import {
  canSearchBookingClients,
  searchBookingClients,
} from '../../api/clientApi'

import { useEffect, useRef, useState } from 'react'
import ClientForm from '../ClientForm/ClientForm'
import {
  AVAILABILITY_REASONS,
  checkEmployeeAvailability,
  isEmployeeAvailable,
} from '../../utils/availability'
import './AppointmentForm.css'

function addMinutesToTime(time, minutesToAdd) {
  if (!time || !minutesToAdd) {
    return ''
  }

  const [hours, minutes] =
    time.split(':').map(Number)

  const totalMinutes =
    hours * 60 +
    minutes +
    Number(minutesToAdd)

  const endHours =
    Math.floor(totalMinutes / 60) % 24

  const endMinutes =
    totalMinutes % 60

  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}${totalMinutes >= 1440 ? ' (sljedeći dan)' : ''}`
}

const timeOptions = []

for (let hour = 0; hour <= 23; hour++) {
  for (let minute = 0; minute < 60; minute += 15) {
    const formattedHour = String(hour).padStart(2, '0')
    const formattedMinute = String(minute).padStart(2, '0')

    timeOptions.push(
      `${formattedHour}:${formattedMinute}`
    )
  }
}

function getTodayDate() {
  const today = new Date()
  const timezoneOffset =
    today.getTimezoneOffset() * 60_000

  const localDate = new Date(
    today.getTime() - timezoneOffset
  )

  return localDate.toISOString().split('T')[0]
}

function AppointmentForm({
  authContext,
  salonTimezone,
  onChangeServices,
  appointments = [],
  serviceList = [],
  clientList = [],
  onQuickAddClient,
  employeeList = [],
  onAddAppointment,
  onUpdateAppointment,
  onCancelEdit,
  editingAppointment,
  isUpdating = false,
  isCreating = false,
  initialDate = '',
}) {

  const editingClientName =
    editingAppointment?.clientName || ''

  const isLegacyEditingClient =
    Boolean(
      editingAppointment &&
      !editingAppointment.clientId &&
      editingClientName
    )

  const [date, setDate] = useState(getTodayDate())
  const [time, setTime] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientId, setClientId] = useState('')
  const [pendingClient, setPendingClient] = useState(null)
  const [clientSearch, setClientSearch] = useState('')
  const [isClientSearchOpen, setIsClientSearchOpen] =
    useState(false)
  const [
    isQuickAddClientOpen,
    setIsQuickAddClientOpen,
  ] = useState(false)
  const [selectedServiceIds, setSelectedServiceIds] = useState([])
  const [servicesDirty, setServicesDirty] = useState(false)

  const [selectedLookupClient, setSelectedLookupClient] =
    useState(null)

  const [clientLookup, setClientLookup] = useState({
    query: '',
    rows: [],
    loading: false,
    error: '',
  })

  const lookupQuery = clientSearch.trim()
  const lookupAllowed = canSearchBookingClients(lookupQuery)

  const filteredClientList =
    lookupAllowed && clientLookup.query === lookupQuery
      ? clientLookup.rows
      : []

  const clientLookupMessage = !lookupAllowed
    ? 'Upišite najmanje 3 slova imena ili 7 znamenki telefona bez početnog pozivnog prefiksa.'
    : clientLookup.query !== lookupQuery || clientLookup.loading
      ? 'Pretraživanje...'
      : clientLookup.error || 'Nema pronađenih klijenata.'

  useEffect(() => {
    if (!isClientSearchOpen || !lookupAllowed) {
      return
    }

    const controller = new AbortController()

    setClientLookup({
      query: lookupQuery,
      rows: [],
      loading: true,
      error: '',
    })

    const timeout = window.setTimeout(async () => {
      try {
        const rows = await searchBookingClients(
          lookupQuery,
          { signal: controller.signal }
        )

        if (!controller.signal.aborted) {
          setClientLookup({
            query: lookupQuery,
            rows,
            loading: false,
            error: '',
          })
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setClientLookup({
            query: lookupQuery,
            rows: [],
            loading: false,
            error:
              error.message ||
              'Pretraga klijenata nije uspjela.',
          })
        }
      }
    }, 300)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [lookupQuery, lookupAllowed, isClientSearchOpen])

  const [employeeId, setEmployeeId] =
    useState('')

  let selectedItems = [], selectionError = ''
  try {
    if (selectedServiceIds.length) selectedItems = draftItems(selectedServiceIds, serviceList)
  } catch (error) { selectionError = error.message }
  let selectedTotals = { durationMinutes: 0, priceCents: 0 }
  try { selectedTotals = sumItems(selectedItems) } catch (error) { selectionError = error.message }
  const selectedServiceForEmployee = editingAppointment || selectedItems[0] || null
  const selectedServiceDuration = editingAppointment
    ? Number(editingAppointment.durationMinutes)
    : selectedTotals.durationMinutes
  const appointmentEndTime = time && selectedServiceDuration
    ? addMinutesToTime(time, selectedServiceDuration) : ''
  const availableEmployees = editingAppointment
    ? employeeList.filter(employee => String(employee.id) === String(editingAppointment.employeeId))
    : employeeList.filter(employee =>
        employeeSupportsServices(employee, selectedServiceIds) &&
        canUseAppointmentPermission(authContext, 'appointment.create', employee.id))
  const [availability, setAvailability] = useState({ key: '', loading: false, slots: [], error: '' })
  const [availabilityVersion, setAvailabilityVersion] = useState(0)
  const selectionKey = selectedServiceIds.join(',')
  const availabilityKey = [authContext?.current_salon?.id, employeeId, selectionKey, date, salonTimezone, availabilityVersion].join('|')
  useEffect(() => {
    if (editingAppointment || !employeeId || !selectionKey || !date || !salonTimezone || selectionError) return
    const controller = new AbortController()
    let current = true
    setAvailability({ key: availabilityKey, loading: true, slots: [], error: '' })
    appointmentServicesApi.availability({
      employeeId, ids: selectionKey.split(','), date, timezone: salonTimezone, signal: controller.signal,
    }).then(data => {
      if (current) setAvailability({
        key: availabilityKey, loading: false, slots: data.availableSlots,
        error: data.durationMinutes !== selectedServiceDuration
          ? 'Trajanje u cjeniku promijenjeno je. Osvježite stranicu prije rezervacije.' : '',
      })
    }).catch(error => {
      if (current && !controller.signal.aborted) setAvailability({
        key: availabilityKey, loading: false, slots: [], error: error.message || 'Dostupnost nije učitana.',
      })
    })
    return () => { current = false; controller.abort() }
  }, [availabilityKey, editingAppointment, employeeId, selectionKey, date, salonTimezone, selectionError, selectedServiceDuration])
  const availabilityReady = availability.key === availabilityKey && !availability.loading && !availability.error

  const selectedEmployeeForAvailability =
    employeeList.find(
      (employee) =>
        String(employee.id) ===
        String(employeeId)
    ) || null

  const localTimeOptions =
    date &&
      employeeId &&
      selectedServiceDuration > 0
      ? timeOptions.filter((timeOption) =>
        isEmployeeAvailable({
          employeeId,
          workingHours:
            selectedEmployeeForAvailability
              ?.workingHours ?? null,
          dateOverrides:
            selectedEmployeeForAvailability
              ?.dateOverrides ?? [],
          timeOff:
            selectedEmployeeForAvailability
              ?.timeOff ?? [],
          blockedTimes:
            selectedEmployeeForAvailability
              ?.blockedTimes ?? [],
          date,
          startTime: timeOption,
          durationMinutes:
            selectedServiceDuration,
          appointments,
          excludeAppointmentId:
            editingAppointment?.id ?? null,
        })
      )
      : []


  const availableTimeOptions = editingAppointment
    ? localTimeOptions
    : availabilityReady ? availability.slots : []

  const unavailableTimeReasons =
    date &&
      employeeId &&
      selectedServiceDuration > 0 &&
      selectedEmployeeForAvailability
      ? timeOptions
        .map((timeOption) =>
          checkEmployeeAvailability({
            employeeId,

            workingHours:
              selectedEmployeeForAvailability
                .workingHours ?? null,

            dateOverrides:
              selectedEmployeeForAvailability
                .dateOverrides ?? [],

            timeOff:
              selectedEmployeeForAvailability
                .timeOff ?? [],

            blockedTimes:
              selectedEmployeeForAvailability
                .blockedTimes ?? [],

            date,
            startTime: timeOption,

            durationMinutes:
              selectedServiceDuration,

            appointments,

            excludeAppointmentId:
              editingAppointment?.id ?? null,
          })
        )
        .filter(
          (result) =>
            !result.available &&
            result.reason
        )
        .map(
          (result) => result.reason
        )
      : []

  const hasDayOffReason =
    unavailableTimeReasons.includes(
      AVAILABILITY_REASONS.DAY_OFF
    )

  const hasTimeOffReason =
    unavailableTimeReasons.includes(
      AVAILABILITY_REASONS.TIME_OFF
    )

  const hasBlockedTimeReason =
    unavailableTimeReasons.includes(
      AVAILABILITY_REASONS.BLOCKED_TIME
    )

  const hasCollisionReason =
    unavailableTimeReasons.includes(
      AVAILABILITY_REASONS
        .APPOINTMENT_COLLISION
    )

  const hasOutsideWorkingHoursReason =
    unavailableTimeReasons.includes(
      AVAILABILITY_REASONS
        .OUTSIDE_WORKING_HOURS
    )

  const [errors, setErrors] = useState({
    date: '',
    time: '',
    clientName: '',
    service: '',
    employee: '',
  })

  let timeOptionsMessage =
    'Odaberite vrijeme'

  if (!selectedServiceForEmployee) {
    timeOptionsMessage =
      'Prvo odaberite uslugu'
  } else if (!employeeId) {
    timeOptionsMessage =
      'Prvo odaberite zaposlenika'
  } else if (
    availableTimeOptions.length === 0
  ) {
    if (hasTimeOffReason) {
      timeOptionsMessage =
        `${selectedEmployeeForAvailability?.name || 'Zaposlenik'} nije dostupan zbog evidentirane odsutnosti`

    } else if (hasBlockedTimeReason) {
      timeOptionsMessage =
        'Dio radnog vremena zaposlenika je blokiran'

    } else if (hasDayOffReason) {
      timeOptionsMessage =
        `${selectedEmployeeForAvailability?.name || 'Zaposlenik'} ne radi odabranog dana`

    } else if (hasCollisionReason) {
      timeOptionsMessage =
        'Nema slobodnih termina za odabrani dan'

    } else if (
      hasOutsideWorkingHoursReason
    ) {
      timeOptionsMessage =
        'Usluga ne stane u radno vrijeme zaposlenika'

    } else {
      timeOptionsMessage =
        'Nema slobodnih termina'
    }
  }


  if (!editingAppointment && employeeId && selectedServiceIds.length) {
    if (!availabilityReady) timeOptionsMessage = availability.error || 'Učitavanje slobodnih termina…'
    else if (!availableTimeOptions.length) timeOptionsMessage = 'Nema slobodnog termina za ukupno trajanje usluga.'
  }

  const dateInputRef = useRef(null)
  const timeInputRef = useRef(null)
  const clientNameInputRef = useRef(null)
  const serviceInputRef = useRef(null)
  const employeeInputRef = useRef(null)

  useEffect(() => {
    if (editingAppointment) {
      setDate(
        editingAppointment.date || getTodayDate()
      )

      setTime(editingAppointment.time)
      setClientName(editingAppointment.clientName)

      setClientSearch(editingAppointment.clientName || '')
      setIsClientSearchOpen(false)

      const matchingClientById =
        clientList.find(
          (client) =>
            String(client.id) ===
            String(editingAppointment.clientId)
        )

      const legacyMatchingClients =
        isLegacyEditingClient
          ? clientList.filter(
            (client) =>
              client.name ===
              editingAppointment.clientName
          )
          : []

      const matchingClient =
        matchingClientById ??
        (
          legacyMatchingClients.length === 1
            ? legacyMatchingClients[0]
            : null
        )

      setClientId(
        matchingClient
          ? String(matchingClient.id)
          : editingAppointment.clientId != null
            ? String(editingAppointment.clientId)
            : ''
      )

      setEmployeeId(
        editingAppointment.employeeId
          ? String(editingAppointment.employeeId)
          : ''
      )
    } else {
      setDate(initialDate || (salonTimezone ? getSalonLocalDateParts(new Date().toISOString(), salonTimezone).date : getTodayDate()))
      setTime('')
      setClientName('')
      setClientId('')
      setClientSearch('')
      setIsClientSearchOpen(false)
      setSelectedServiceIds([])
      setEmployeeId('')
    }

    setErrors({
      date: '',
      time: '',
      clientName: '',
      service: '',
      employee: '',
    })
  }, [editingAppointment, initialDate])

    useEffect(() => {
    setServicesDirty(false)
    setPendingClient(null)
    setSelectedLookupClient(null)
    setIsQuickAddClientOpen(false)
  }, [editingAppointment, initialDate])

  async function handleQuickAddClient(newClient) {
    if (!canQuickAddClient) {
      throw new Error('Nemate dopuštenje za dodavanje klijenta ovim putem.')
    }
      setSelectedLookupClient(null)
    if (!editingAppointment) {
      setPendingClient({ ...newClient })
      setClientId('')
      setClientName(newClient.name)
      setClientSearch(newClient.name)
      setIsClientSearchOpen(false)
      setIsQuickAddClientOpen(false)

      setErrors((currentErrors) => ({
        ...currentErrors,
        clientName: '',
      }))

      return newClient
    }

    if (!onQuickAddClient) {
      throw new Error(
        'Dodavanje novog klijenta trenutno nije dostupno.'
      )
    }

    const createdClient = await onQuickAddClient(newClient)

    setPendingClient(null)
    setClientId(String(createdClient.id))
    setClientName(createdClient.name)
    setClientSearch(createdClient.name)
    setIsClientSearchOpen(false)
    setIsQuickAddClientOpen(false)

    setErrors((currentErrors) => ({
      ...currentErrors,
      clientName: '',
    }))

    return createdClient
  }

  const canCreate = canUseAppointmentPermission(
    authContext,
    'appointment.create',
    authContext?.membership?.employee_id
  )

  const canReschedule = Boolean(editingAppointment) &&
    canUseAppointmentPermission(
      authContext,
      'appointment.reschedule',
      editingAppointment.employeeId
    )

  const canChangeClient = Boolean(editingAppointment) &&
    canUseAppointmentPermission(
      authContext,
      'appointment.change_client',
      editingAppointment.employeeId
    )

  const canEditScheduleFields = editingAppointment
    ? canReschedule
    : canCreate

  const canEditClientFields = editingAppointment
    ? canChangeClient
    : canCreate

  const canSubmitForm = editingAppointment
    ? canReschedule || canChangeClient
    : canCreate

  const canQuickAddClient = canEditClientFields && (
    !editingAppointment ||
    ['owner', 'admin'].includes(authContext?.membership?.role)
  )

  async function handleSubmit() {
    if (!canSubmitForm || isCreating || isUpdating || servicesDirty) {
      return
    }

    const selectedClient =
      (!editingAppointment && pendingClient) ||
      (
        selectedLookupClient &&
        String(selectedLookupClient.id) === clientId
          ? selectedLookupClient
          : null
      ) ||
      clientList.find(
        (client) => String(client.id) === clientId
      ) ||
      (
        editingAppointment?.clientId != null &&
        String(editingAppointment.clientId) === clientId
          ? {
              id: editingAppointment.clientId,
              name: editingAppointment.clientName,
            }
          : null
      )

    const selectedEmployee =
      employeeList.find(
        (employee) =>
          String(employee.id) === employeeId
      )

    const candidateDuration = selectedServiceDuration

    const availabilityResult =
      editingAppointment &&
        (date !== editingAppointment.date || time !== editingAppointment.time) &&
        selectedEmployee &&
        candidateDuration > 0 &&
        date &&
        time
        ? checkEmployeeAvailability({
          employeeId:
            selectedEmployee.id,

          workingHours:
            selectedEmployee
              .workingHours ?? null,

          dateOverrides:
            selectedEmployee
              .dateOverrides ?? [],

          timeOff:
            selectedEmployee
              .timeOff ?? [],

          blockedTimes:
            selectedEmployee
              .blockedTimes ?? [],

          date,
          startTime: time,

          durationMinutes:
            candidateDuration,

          appointments,

          excludeAppointmentId:
            editingAppointment?.id ?? null,
        })
        : {
          available: true,
          reason: null,
        }

    let availabilityErrorMessage = ''

    if (!availabilityResult.available) {
      switch (availabilityResult.reason) {
        case AVAILABILITY_REASONS.DAY_OFF:
          availabilityErrorMessage =
            `${selectedEmployee.name} ne radi odabranog dana.`
          break

        case AVAILABILITY_REASONS.TIME_OFF:
          availabilityErrorMessage =
            `${selectedEmployee.name} nije dostupan/na zbog evidentirane odsutnosti.`
          break

        case AVAILABILITY_REASONS.BLOCKED_TIME:
          availabilityErrorMessage =
            `${selectedEmployee.name} ima blokirano vrijeme koje se preklapa s odabranim terminom.`
          break

        case AVAILABILITY_REASONS.OUTSIDE_WORKING_HOURS:
          availabilityErrorMessage =
            `Odabrano vrijeme je izvan radnog vremena zaposlenika ${selectedEmployee.name}.`
          break

        case AVAILABILITY_REASONS.APPOINTMENT_COLLISION:
          availabilityErrorMessage =
            `${selectedEmployee.name} već ima termin koji se preklapa s ovim vremenom.`
          break

        case AVAILABILITY_REASONS.INVALID_INPUT:
          availabilityErrorMessage =
            'Podaci termina nisu ispravni.'
          break

        default:
          availabilityErrorMessage =
            'Odabrani termin nije dostupan.'
      }
    }

    const isUnchangedLegacyClient =
      isLegacyEditingClient &&
      !selectedClient &&
      clientName === editingClientName

    const newErrors = {
      date: date
        ? ''
        : 'Odaberite datum termina.',

      time: !time
        ? 'Odaberite vrijeme termina.'
        : !editingAppointment && (!availabilityReady || !availableTimeOptions.includes(time))
          ? 'Ponovno odaberite slobodno vrijeme za odabrane usluge.'
          : availabilityErrorMessage,

      clientName:
        selectedClient ||
          isUnchangedLegacyClient
          ? ''
          : 'Odaberite klijenta.',

      service:
        editingAppointment ? '' : selectionError || (selectedItems.length ? '' : 'Odaberite barem jednu uslugu.'),

      employee: selectedEmployee && (editingAppointment || employeeSupportsServices(selectedEmployee, selectedServiceIds))
        ? ''
        : 'Odaberite zaposlenika.',
    }



    setErrors(newErrors)

    const hasErrors = Object.values(
      newErrors
    ).some(
      (errorMessage) => errorMessage !== ''
    )

    if (hasErrors) {
      if (newErrors.date) {
        dateInputRef.current?.focus()
      } else if (newErrors.time) {
        timeInputRef.current?.focus()
      } else if (newErrors.clientName) {
        clientNameInputRef.current?.focus()
      } else if (newErrors.service) {
        serviceInputRef.current?.focus()
      } else if (newErrors.employee) {
        employeeInputRef.current?.focus()
      }

      return
    }

    if (editingAppointment) {
      const updateSucceeded =
        await onUpdateAppointment({
          ...editingAppointment,
          clientId:
            selectedClient?.id ??
            editingAppointment.clientId,
          clientName:
            selectedClient?.name ??
            editingAppointment.clientName,
          date,
          time,
        })

      if (!updateSucceeded) {
        return
      }
    } else {
      const createSucceeded =
        await onAddAppointment({
          date,
          time,

          clientId: pendingClient
            ? undefined
            : selectedClient.id,
          clientName: selectedClient.name,
          newClient: pendingClient
            ? { ...pendingClient }
            : undefined,

          employeeId: selectedEmployee.id,
          employeeName: selectedEmployee.name,

          serviceIds: selectedServiceIds,
          service: selectedItems.map(item => item.name).join(' + '),
          serviceId: selectedItems[0].service_id,
          serviceName: selectedItems.map(item => item.name).join(' + '),
          servicePrice: selectedTotals.priceCents / 100,
          serviceDurationMinutes: selectedServiceDuration,
        })

      if (!createSucceeded) {
        setTime('')
        setAvailabilityVersion(value => value + 1)
        return
      }
    }

    setSelectedLookupClient(null)
    setDate(salonTimezone ? getSalonLocalDateParts(new Date().toISOString(), salonTimezone).date : getTodayDate())
    setTime('')
    setClientName('')
    setClientId('')
    setPendingClient(null)
    setClientSearch('')
    setIsClientSearchOpen(false)
    setIsQuickAddClientOpen(false)
    setSelectedServiceIds([])
    setEmployeeId('')

    setErrors({
      date: '',
      time: '',
      clientName: '',
      service: '',
      employee: '',
    })
  }

  function handleDateChange(event) {
    setDate(event.target.value)
    if (!editingAppointment) setTime('')

    if (errors.date || errors.time) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        date: '',
        time: '',
      }))
    }
  }

  function handleTimeChange(event) {
    setTime(event.target.value)

    if (errors.time) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        time: '',
      }))
    }
  }

  function handleServicesChange(ids) {
    setSelectedServiceIds(ids)
    setEmployeeId('')
    setTime('')
    setErrors(current => ({ ...current, service: '', employee: '', time: '' }))
  }

  if (!canSubmitForm) {
    return (
      <div className="appointment-form">
        <p role="status">
          {editingAppointment
            ? 'Nemate dopuštenje za uređivanje ovog termina.'
            : 'Dodavanje termina nije dostupno za vaš račun.'}
        </p>

        {editingAppointment && (
          <button type="button" onClick={onCancelEdit}>
            Zatvori
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="appointment-form">
      <h2>
        {editingAppointment
          ? 'Uredi termin'
          : 'Novi termin'}
      </h2>

      <div className="form-field">
        <label htmlFor="appointment-date">
          Datum
        </label>

        <input
          id="appointment-date"
          disabled={!canEditScheduleFields || isUpdating || isCreating}
          ref={dateInputRef}
          className={
            errors.date
              ? 'input-error'
              : ''
          }
          type="date"
          value={date}
          onChange={handleDateChange}
        />

        <p
          className={
            errors.date
              ? 'form-error form-error-visible'
              : 'form-error'
          }
        >
          {errors.date || '\u00A0'}
        </p>
      </div>


      <div className="form-field">
        <label htmlFor="appointment-client">
          Klijent
        </label>

        <input
          id="appointment-client"
          disabled={!canEditClientFields || isUpdating || isCreating}
          ref={clientNameInputRef}
          type="search"
          className={
            errors.clientName
              ? 'input-error'
              : ''
          }
          value={clientSearch}
          onFocus={() => setIsClientSearchOpen(true)}
          onChange={(event) => {
            setPendingClient(null)
            setSelectedLookupClient(null)
            setClientSearch(event.target.value)
            setClientId('')
            setClientName('')
            setIsClientSearchOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setIsClientSearchOpen(false)
            }
          }}
          placeholder="Pretraži po imenu ili telefonu"
          aria-label="Pretraži klijente po imenu ili telefonu"
          autoComplete="off"
        />

        {isLegacyEditingClient &&
          !clientId &&
          clientName === editingClientName && (
            <p className="appointment-client-legacy">
              Stari klijent — {editingClientName}
            </p>
          )}

        {canEditClientFields && isClientSearchOpen && (
          <ul className="appointment-client-results">
            {filteredClientList.length === 0 ? (
              <li className="appointment-client-no-results">
                {clientLookupMessage}
              </li>
            ) : (
              filteredClientList.map((client) => (
                <li key={client.id}>
                  <button
                    type="button"
                    className="appointment-client-result"
                    onClick={() => {
                      setSelectedLookupClient(client)
                      setClientId(String(client.id))
                      setPendingClient(null)
                      setClientName(client.name)
                      setClientSearch(client.name)
                      setIsClientSearchOpen(false)

                      if (errors.clientName) {
                        setErrors((currentErrors) => ({
                          ...currentErrors,
                          clientName: '',
                        }))
                      }
                    }}
                  >
                    <span>{client.name}</span>

                    {client.phone && (
                      <small>{client.phone}</small>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
                {!editingAppointment && pendingClient && (
          <p role="status">
            Novi klijent: {pendingClient.name}.
            Podaci će se spremiti zajedno s terminom.
          </p>
        )}
        <div className="appointment-client-quick-add">
          <button
            type="button"
            className="appointment-client-quick-add-toggle"
            hidden={!canQuickAddClient}
            onClick={() => {
              setIsClientSearchOpen(false)

              setIsQuickAddClientOpen(
                (currentValue) => !currentValue
              )
            }}
          >
            {isQuickAddClientOpen
              ? 'Zatvori dodavanje klijenta'
              : '+ Novi klijent'}
          </button>

          {canQuickAddClient && isQuickAddClientOpen && (
            <div className="appointment-client-quick-add-form">
              {!editingAppointment && (
                <p>
                  Klikom na „Dodaj klijenta” odabirete ga
                  za ovaj termin. Klijent će biti spremljen
                  tek nakon uspješnog spremanja termina.
                </p>
              )}

              <ClientForm
                clientList={clientList}
                onAddClient={handleQuickAddClient}
              />

              <button
                type="button"
                className="appointment-client-quick-add-cancel"
                onClick={() =>
                  setIsQuickAddClientOpen(false)
                }
              >
                Odustani
              </button>
            </div>
          )}
        </div>
        <p
          className={
            errors.clientName
              ? 'form-error form-error-visible'
              : 'form-error'
          }
        >
          {errors.clientName || '\u00A0'}
        </p>
      </div>

      <div ref={serviceInputRef} tabIndex={-1}>
        {editingAppointment ? (
          <div className="appointment-saved-services">
            <h3>Usluge termina</h3>
            <ol>{editingAppointment.items?.map(item => <li key={item.service_id}>
              {item.name} — {item.duration_minutes} min · {formatServicePrice(item.price_cents)}
            </li>)}</ol>
            <strong>Ukupno: {selectedServiceDuration} min · {formatServicePrice(editingAppointment.priceCents)}</strong>
          </div>
        ) : <ServiceSelection ids={selectedServiceIds} onChange={handleServicesChange}
            services={serviceList} disabled={!canCreate || isCreating} />}
        {errors.service && <p className="form-error form-error-visible" role="alert">{errors.service}</p>}
      </div>

      <div className="form-field">
        <label htmlFor="appointment-employee">
          Zaposlenik
        </label>

        <select
          id="appointment-employee"
          ref={employeeInputRef}
          className={
            errors.employee
              ? 'input-error'
              : ''
          }
          value={employeeId}
          onChange={(event) => {
            setEmployeeId(event.target.value)
            setTime('')

            if (errors.employee) {
              setErrors((currentErrors) => ({
                ...currentErrors,
                employee: '',
              }))
            }
          }}
          disabled={
            Boolean(editingAppointment) ||
            !canCreate ||
            !selectedServiceForEmployee
          }
        >
          <option value="">
            {!selectedServiceForEmployee
              ? 'Prvo odaberite uslugu'
              : availableEmployees.length === 0
                ? 'Nema dostupnih zaposlenika'
                : 'Odaberite zaposlenika'}
          </option>

          {availableEmployees.map(
            (employee) => (
              <option
                key={employee.id}
                value={String(employee.id)}
              >
                {employee.name}
              </option>
            )
          )}
        </select>

        <p
          className={
            errors.employee
              ? 'form-error form-error-visible'
              : 'form-error'
          }
        >
          {errors.employee || '\u00A0'}
        </p>
      </div>


      <div className="form-field">
        <label htmlFor="appointment-time">
          Vrijeme
        </label>

        <select
          id="appointment-time"
          ref={timeInputRef}
          className={
            errors.time
              ? 'input-error'
              : ''
          }
          value={time}
          onChange={handleTimeChange}
          disabled={
            isUpdating || isCreating ||
            !canEditScheduleFields ||
            !selectedServiceForEmployee ||
            !employeeId
          }
        >
          <option value="">
            {timeOptionsMessage}
          </option>

          {editingAppointment && !availableTimeOptions.includes(time) && time && (
            <option value={time}>{time} — spremljeno vrijeme</option>
          )}
          {availableTimeOptions.map(
            (timeOption) => (
              <option
                key={timeOption}
                value={timeOption}
              >
                {timeOption}
              </option>
            )
          )}
        </select>
        <p
          className={
            errors.time
              ? 'form-error form-error-visible'
              : 'form-error'
          }
        >
          {errors.time || '\u00A0'}
        </p>
      </div>

      {!editingAppointment && availability.error && availability.key === availabilityKey && (
        <div role="alert">
          <p>{availability.error}</p>
          <button type="button" onClick={() => { setTime(''); setAvailabilityVersion(value => value + 1) }}>Ponovi provjeru dostupnosti</button>
        </div>
      )}

      {appointmentEndTime && (
        <div className="appointment-duration-preview">
          <span>
            Predviđeni završetak
          </span>

          <strong>
            {appointmentEndTime}
          </strong>

          <small>
            Trajanje: {selectedServiceDuration} min
          </small>
        </div>
      )}

      {editingAppointment && onChangeServices && (
        <AppointmentServicesEditor
          key={String(editingAppointment.id) + ':' + (editingAppointment.serviceIds ?? []).join(',')}
          appointment={editingAppointment} services={serviceList}
          employee={selectedEmployeeForAvailability} authContext={authContext}
          disabled={isUpdating || isCreating}
          otherChanges={date !== editingAppointment.date || time !== editingAppointment.time ||
            String(clientId) !== String(editingAppointment.clientId)}
          onSave={onChangeServices} onDirtyChange={setServicesDirty}
        />
      )}

      {servicesDirty && <p role="status">Spremite ili poništite odabir usluga prije spremanja ostalih promjena.</p>}
      <div className="form-actions">
        <button
          type="button"
          className="primary-button"
          onClick={handleSubmit}
          disabled={
            !canSubmitForm || servicesDirty ||
            isUpdating ||
            isCreating
          }
        >
          {isUpdating || isCreating
            ? 'Spremanje...'
            : editingAppointment
              ? 'Spremi promjene'
              : 'Dodaj termin'}
        </button>

        {editingAppointment && (
          <button
            type="button"
            className="secondary-button"
            onClick={onCancelEdit}
            disabled={isUpdating}
          >
            Odustani
          </button>
        )}
      </div>
    </div>
  )
}

export default AppointmentForm
