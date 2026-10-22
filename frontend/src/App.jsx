import {
  useEffect,
  useRef,
  useState,
} from 'react'

import { Route, Routes } from 'react-router-dom'

import { fetchCurrentAuth } from './api/authApi'
import { fetchAvailableWorkspaces } from './api/workspaceApi'

import {
  setActiveSalonForRequests,
} from './api/salonApiContext'

import { fetchCalendar } from './api/calendarApi'
import { fetchAppointments } from './api/appointmentApi'
import { fetchServices } from './api/serviceApi'
import { fetchEmployees } from './api/employeeApi'
import { fetchClients } from './api/clientApi'

import {
  mapAppointmentRowsToFrontend,
  mapCalendarResponseToAppointments,
} from './api/appointmentMapper'

import { mapClientToFrontend } from './api/clientMapper'
import { mapEmployeesToFrontend } from './api/employeeMapper'
import { mapServicesToFrontend } from './api/serviceMapper'

import Layout from './components/Layout/Layout'
import InvitationAcceptance from './components/Invitations/InvitationAcceptance'

import Services from './pages/Services/Services'
import Appointments from './pages/Appointments/Appointments'
import Calendar from './pages/Calendar/Calendar'
import Clients from './pages/Clients/Clients'
import Dashboard from './pages/Dashboard/Dashboard'
import Employees from './pages/Employees/Employees'

function formatDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getCalendarGridRange(displayedDate) {
  const firstDay = new Date(
    displayedDate.getFullYear(),
    displayedDate.getMonth(),
    1
  )

  const daysBeforeMonday =
    (firstDay.getDay() + 6) % 7

  const start = new Date(
    firstDay.getFullYear(),
    firstDay.getMonth(),
    1 - daysBeforeMonday
  )

  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 41
  )

  return {
    from: formatDateKey(start),
    to: formatDateKey(end),
  }
}

function storageKey(userId) {
  return `salonai:selected-salon:${userId}`
}

function readSavedSalon(userId) {
  try {
    return window.sessionStorage.getItem(
      storageKey(userId)
    )
  } catch {
    return null
  }
}

function saveSelectedSalon(userId, salonId) {
  try {
    window.sessionStorage.setItem(
      storageKey(userId),
      String(salonId)
    )
  } catch {
    // Aplikacija radi i kada preglednik zabrani pohranu.
  }
}

function clearSavedSalon(userId) {
  try {
    window.sessionStorage.removeItem(
      storageKey(userId)
    )
  } catch {
    // Nedostupna pohrana ne smije blokirati odabir.
  }
}

function isCancelledRequest(error) {
  return (
    error?.name === 'AbortError' ||
    error?.code === 'STALE_SALON_CONTEXT'
  )
}

function SalonWorkspace({ authContext }) {
  const salonId = authContext.current_salon.id
  const salonTimezone = authContext.current_salon.timezone

  const canManage =
    authContext.membership.role === 'owner' ||
    authContext.membership.role === 'admin'

  const [serviceList, setServiceList] = useState([])
  const [employeeList, setEmployeeList] = useState([])
  const [clientList, setClientList] = useState([])
  const [appointmentList, setAppointmentList] = useState([])

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [
    appointmentFormInitialDate,
    setAppointmentFormInitialDate,
  ] = useState('')

  const [
    appointmentFormEditingId,
    setAppointmentFormEditingId,
  ] = useState(null)

  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadSalonData() {
      setIsLoading(true)
      setLoadError(null)

      try {
        const [
          backendServices,
          backendEmployees,
          backendClients,
          backendAppointments,
        ] = await Promise.all([
          fetchServices(),
          fetchEmployees(),
          canManage ? fetchClients() : Promise.resolve([]),
          fetchAppointments(),
        ])

        if (cancelled) {
          return
        }

        const mappedServices =
          mapServicesToFrontend(backendServices)

        const mappedEmployees =
          mapEmployeesToFrontend(
            backendEmployees,
            salonTimezone
          )

        const mappedClients = backendClients.map(
          (client) => ({
            ...mapClientToFrontend(client),
            visits: 0,
          })
        )

        const mappedAppointments =
          mapAppointmentRowsToFrontend(
            backendAppointments,
            salonTimezone,
            backendClients,
            backendEmployees,
            backendServices
          )

        setServiceList(mappedServices)
        setEmployeeList(mappedEmployees)
        setClientList(mappedClients)
        setAppointmentList(mappedAppointments)
      } catch (error) {
        if (cancelled || isCancelledRequest(error)) {
          return
        }

        setLoadError(
          error.message ||
            'Podatke salona trenutno nije moguće učitati.'
        )
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadSalonData()

    return () => {
      cancelled = true
    }
  }, [salonId, salonTimezone, canManage, reloadToken])

  async function loadCalendarMonth(displayedDate) {
    const { from, to } =
      getCalendarGridRange(displayedDate)

    try {
      const calendarData = await fetchCalendar({ from, to })

      if (!mountedRef.current) {
        return
      }

      if (
        String(calendarData.salon.id) !== String(salonId)
      ) {
        throw new Error(
          'Kalendar ne pripada odabranom salonu.'
        )
      }

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
          const id = String(appointment.id)

          if (!appointmentsById.has(id)) {
            appointmentsById.set(id, appointment)
          }
        }

        return [...appointmentsById.values()]
      })
    } catch (error) {
      if (
        !mountedRef.current ||
        isCancelledRequest(error)
      ) {
        return
      }

      window.alert(
        error.message ||
          'Nije moguće učitati termine odabranog mjeseca.'
      )
    }
  }

  function exportSalonData() {
    if (!canManage || isLoading || loadError) {
      return
    }

    const salonData = {
      clients: clientList,
      services: serviceList,
      employees: employeeList,
      appointments: appointmentList,
      exportedAt: new Date().toISOString(),
      version: 1,
    }

    const blob = new Blob(
      [JSON.stringify(salonData, null, 2)],
      { type: 'application/json' }
    )

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download =
      `salonai-${salonId}-${formatDateKey(new Date())}.json`

    document.body.appendChild(link)
    link.click()
    link.remove()

    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <p role="status">
        Učitavanje podataka salona…
      </p>
    )
  }

  if (loadError) {
    return (
      <div>
        <p role="alert">{loadError}</p>

        <button
          type="button"
          onClick={() => setReloadToken((value) => value + 1)}
        >
          Pokušaj ponovno
        </button>
      </div>
    )
  }

  return (
    <>
      {canManage && (
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
            canManage ? (
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
              canManageServices={canManage}
              serviceList={serviceList}
              setServiceList={setServiceList}
              salonId={salonId}
            />
          }
        />

        <Route
          path="/employees"
          element={
            <Employees
              canManageEmployees={canManage}
              isLoading={false}
              loadError={null}
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
              appointmentList={appointmentList}
              setAppointmentList={setAppointmentList}
              salonTimezone={salonTimezone}
              salonId={salonId}
              serviceList={serviceList}
              clientList={clientList}
              setClientList={setClientList}
              employeeList={employeeList}
              initialAppointmentDate={appointmentFormInitialDate}
              clearInitialAppointmentDate={() =>
                setAppointmentFormInitialDate('')
              }
              initialEditingAppointmentId={appointmentFormEditingId}
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
              authContext={authContext}
              appointmentList={appointmentList}
              appointmentsLoading={false}
              appointmentsLoadError={null}
              onRequestNewAppointment={setAppointmentFormInitialDate}
              onRequestEditAppointment={setAppointmentFormEditingId}
              onRequestMonthChange={loadCalendarMonth}
            />
          }
        />
      </Routes>
    </>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  const [authContext, setAuthContext] = useState(null)

  const [isBusy, setIsBusy] = useState(true)
  const [workspaceError, setWorkspaceError] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  const generationRef = useRef(0)
  const switchingRef = useRef(false)

  async function activateWorkspace(
    salonId,
    expectedUserId,
    generation
  ) {
    setActiveSalonForRequests(salonId)

    const context = await fetchCurrentAuth()

    if (generationRef.current !== generation) {
      return
    }

    if (
      String(context.user.id) !== String(expectedUserId) ||
      String(context.current_salon.id) !== String(salonId) ||
      context.user.active !== true ||
      context.membership.active !== true ||
      context.current_salon.active !== true
    ) {
      throw new Error(
        'Poslužitelj nije potvrdio odabrani korisnički i salonski kontekst.'
      )
    }

    saveSelectedSalon(expectedUserId, salonId)
    setAuthContext(context)
  }

  useEffect(() => {
    const generation = ++generationRef.current
    const controller = new AbortController()

    switchingRef.current = true

    setActiveSalonForRequests(null)
    setAuthContext(null)
    setWorkspaces([])
    setUser(null)
    setWorkspaceError(null)
    setIsBusy(true)

    async function initializeWorkspaces() {
      try {
        const data = await fetchAvailableWorkspaces({
          signal: controller.signal,
        })

        if (generationRef.current !== generation) {
          return
        }

        setUser(data.user)
        setWorkspaces(data.workspaces)

        const savedId = readSavedSalon(data.user.id)

        const savedWorkspace = data.workspaces.find(
          (workspace) =>
            String(workspace.salon.id) === savedId
        )

        if (savedId && !savedWorkspace) {
          clearSavedSalon(data.user.id)
        }

        const initialWorkspace =
          savedWorkspace ||
          (
            data.workspaces.length === 1
              ? data.workspaces[0]
              : null
          )

        if (initialWorkspace) {
          await activateWorkspace(
            initialWorkspace.salon.id,
            data.user.id,
            generation
          )
        }
      } catch (error) {
        if (
          generationRef.current !== generation ||
          isCancelledRequest(error)
        ) {
          return
        }

        setActiveSalonForRequests(null)
        setAuthContext(null)

        setWorkspaceError(
          error.message ||
            'Nije moguće učitati dostupne salone.'
        )
      } finally {
        if (generationRef.current === generation) {
          switchingRef.current = false
          setIsBusy(false)
        }
      }
    }

    initializeWorkspaces()

    return () => {
      generationRef.current += 1
      controller.abort()
      setActiveSalonForRequests(null)
    }
  }, [reloadToken])

  async function changeWorkspace(salonId) {
    if (
      switchingRef.current ||
      !user ||
      !salonId ||
      String(authContext?.current_salon?.id) === String(salonId)
    ) {
      return
    }

    const selected = workspaces.find(
      (workspace) =>
        String(workspace.salon.id) === String(salonId)
    )

    if (!selected) {
      return
    }

    if (
      authContext &&
      !window.confirm(
        'Promjenom salona zatvaraju se otvoreni obrasci. Nespremljeni unosi neće se prenijeti. Nastaviti?'
      )
    ) {
      return
    }

    const generation = ++generationRef.current

    switchingRef.current = true

    setIsBusy(true)
    setWorkspaceError(null)
    setAuthContext(null)

    try {
      await activateWorkspace(
        selected.salon.id,
        user.id,
        generation
      )
    } catch (error) {
      if (
        generationRef.current !== generation ||
        isCancelledRequest(error)
      ) {
        return
      }

      setActiveSalonForRequests(null)
      clearSavedSalon(user.id)

      setWorkspaceError(
        error.message ||
          'Nije moguće otvoriti odabrani salon.'
      )
    } finally {
      if (generationRef.current === generation) {
        switchingRef.current = false
        setIsBusy(false)
      }
    }
  }

  const canAccessFullCrm =
    authContext?.membership?.role === 'owner' ||
    authContext?.membership?.role === 'admin'

  return (
    <Layout
      currentUser={authContext?.user || user}
      canAccessFullCrm={canAccessFullCrm}
    >
      {workspaces.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '20px',
          }}
        >
          <label htmlFor="active-salon">
            Salon
          </label>

          <select
            id="active-salon"
            value={
              authContext
                ? String(authContext.current_salon.id)
                : ''
            }
            disabled={isBusy}
            onChange={(event) =>
              changeWorkspace(event.target.value)
            }
          >
            <option value="" disabled>
              Odaberite salon
            </option>

            {workspaces.map((workspace) => (
              <option
                key={workspace.salon.id}
                value={String(workspace.salon.id)}
              >
                {workspace.salon.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {isBusy && (
        <p role="status">
          Učitavanje salonskog konteksta…
        </p>
      )}

      {!isBusy && workspaceError && (
        <div>
          <p role="alert">{workspaceError}</p>

          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
          >
            Ponovno učitaj salone
          </button>
        </div>
      )}

      {!isBusy && !workspaceError && !authContext && (
        <p role="status">
          {workspaces.length === 0
            ? 'Vaš račun trenutačno nema dostupnih salona. Obratite se administratoru salona radi dodjele pristupa.'
            : 'Odaberite salon za nastavak rada.'}
        </p>
      )}

      {!isBusy && user && (
        <InvitationAcceptance
          key={user.id}
          currentUser={user}
          onAccepted={(salonId) => {
            saveSelectedSalon(user.id, salonId)
            window.location.assign('/')
          }}
        />
      )}

      {!isBusy && authContext && (
        <SalonWorkspace
          key={
            `${authContext.user.id}:${authContext.current_salon.id}`
          }
          authContext={authContext}
        />
      )}
    </Layout>
  )
}

export default App