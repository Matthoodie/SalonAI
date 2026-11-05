import {
  lazy,
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
import WelcomeScreen from './components/Welcome/WelcomeScreen'
import OnboardingWizard from './components/Onboarding/OnboardingWizard'
import {onboardingApi} from './api/onboardingApi.js'
import AccountSettings from './components/Settings/AccountSettings'
import SalonSetupWizard from './components/SalonSetup/SalonSetupWizard'
import './pages/Settings/Settings.css'
import InvitationAcceptance from './components/Invitations/InvitationAcceptance'

import PageBoundary from './components/PageBoundary/PageBoundary'
import Dashboard from './pages/Dashboard/Dashboard'

const Services = lazy(
  () => import('./pages/Services/Services')
)

const Appointments = lazy(
  () => import('./pages/Appointments/Appointments')
)

const Calendar = lazy(
  () => import('./pages/Calendar/Calendar')
)

const Clients = lazy(
  () => import('./pages/Clients/Clients')
)

const Employees = lazy(
  () => import('./pages/Employees/Employees')
)

const BlockedTimeRequests = lazy(() => import('./pages/BlockedTimeRequests/BlockedTimeRequests'))

const TimeOffRequests = lazy(
  () => import('./pages/TimeOffRequests/TimeOffRequests')
)

const Settings = lazy(
  () => import('./pages/Settings/Settings')
)

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

function SalonWorkspace({ authContext, onInvitationAccepted }) {
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

  async function refreshEmployeesAfterApproval() {
    const rows = await fetchEmployees()
    if (!mountedRef.current) return
    setEmployeeList(mapEmployeesToFrontend(rows, salonTimezone))
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
      <PageBoundary>
        <Routes>
        <Route
          path="/time-off-requests"
          element={
            <TimeOffRequests
              authContext={authContext}
              employeeList={employeeList}
              onApproved={refreshEmployeesAfterApproval}
            />
          }
        />
        <Route
          path="/blocked-time-requests"
          element={
            <BlockedTimeRequests
              authContext={authContext}
              employeeList={employeeList}
              onApproved={refreshEmployeesAfterApproval}
            />
          }
        />
        <Route
          path="/settings"
          element={
            <div className="settings-page">
              <AccountSettings
                authContext={authContext}
                onAccepted={onInvitationAccepted}
              />
              {authContext.membership.role === 'owner' && (
                <SalonSetupWizard key={`${authContext.user.id}:${salonId}`} salonId={salonId} />
              )}
              {canManage && (
                <Settings salonId={salonId} salonTimezone={salonTimezone} />
              )}
            </div>
          }
        />
        <Route
          path="/"
          element={
            <Dashboard
              salonTimezone={salonTimezone}
              canManage={canManage}
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
              userId={authContext.user.id}
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
              memberManagementContext={authContext}
              canManageEmployees={canManage}
              canManageAdminInvitations={
                authContext.membership.role === 'owner'
              }
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
      </PageBoundary>
    </>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  const [authContext, setAuthContext] = useState(null)
  const [onboarding, setOnboarding] = useState(null)

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

    const onboardingState = await onboardingApi.status(salonId)
    if (generationRef.current !== generation) return
    setOnboarding(onboardingState)
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

  // Business navigation is rendered only after active salon context is confirmed.
  if (isBusy || workspaceError || !authContext) {
    return (
      <WelcomeScreen
        key={user?.id || 'loading'}
        user={user}
        workspaces={workspaces}
        busy={isBusy}
        error={workspaceError}
        onRetry={() => setReloadToken((value) => value + 1)}
        onSelect={changeWorkspace}
        onAccepted={(salonId) => {
          saveSelectedSalon(user.id, salonId)
          window.location.assign('/')
        }}
      />
    )
  }

  if (onboarding?.requires_setup) {
    return <OnboardingWizard key={`${authContext.user.id}:${authContext.current_salon.id}`}
      authContext={authContext} workspaces={workspaces} onSelect={changeWorkspace} onRefresh={() => window.location.assign('/')} />
  }

  const canAccessFullCrm =
    authContext?.membership?.role === 'owner' ||
    authContext?.membership?.role === 'admin'

  return (
    <Layout
      currentUser={authContext?.user || user}
      canAccessFullCrm={canAccessFullCrm}
      role={authContext?.membership?.role}
      workspaceControl={workspaces.length > 0 && (
        <div className="workspace-select">
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
    >


      {!isBusy && authContext && (
        <SalonWorkspace
          key={
            `${authContext.user.id}:${authContext.current_salon.id}`
          }
          authContext={authContext}
          onInvitationAccepted={(salonId) => {
            saveSelectedSalon(user.id, salonId)
            window.location.assign('/')
          }}
        />
      )}
    </Layout>
  )
}

export default App
