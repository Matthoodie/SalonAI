import { useLanguage } from '../../components/Language/LanguageProvider'
import { clientText, clientError, clientDynamic, clientMoney, clientCount } from '../../components/Language/clientText.js'
import { overviewLocale, overviewRecipient, overviewStatus } from '../../components/Language/overviewText.js'
import {
  useEffect,
  useRef,
  useState,
} from 'react'
import ClientForm from '../../components/ClientForm/ClientForm'
import ClientCard from '../../components/ClientCard/ClientCard'
import {
  createClient,
  updateClient as updateClientApi,
  updateClientActive,
} from '../../api/clientApi'
import './Clients.css'
import ClientPets from '../../components/Pets/ClientPets'

import {
  mapClientToFrontend,
  mapClientToPayload,
} from '../../api/clientMapper'

function formatClientAppointmentDate(date, language) {
  if (!date) {
    return ''
  }

  const [year, month, day] =
    date.split('-')

  const localDate = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  )

  return new Intl.DateTimeFormat(
    overviewLocale(language),
    {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    }
  ).format(localDate)
}

function Clients({
  clientList,
  setClientList,
  appointmentList = [],
  salonId,
}) {
  const {language}=useLanguage()
  const f=source=>clientText(language,source)
  const languageRef=useRef(language)
  languageRef.current=language

  const [editingClient, setEditingClient] =
    useState(null)

  const [searchQuery, setSearchQuery] =
    useState('')

  const [sortOption, setSortOption] =
  useState('name-asc')

  const [selectedClientId, setSelectedClientId] =
  useState(null)

  const [petBusy, setPetBusy] = useState(false)
  const clientFormRef = useRef(null)
  const clientDetailRef = useRef(null)

  useEffect(() => {
    if (!selectedClientId) return
    const previousFocus = document.activeElement
    clientDetailRef.current?.querySelector('button')?.focus()
    return () => { if (previousFocus?.isConnected) previousFocus.focus() }
  }, [selectedClientId])

  useEffect(() => {
  if (selectedClientId) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }

  return () => {
    document.body.style.overflow = ''
  }
}, [selectedClientId])

useEffect(() => {
  function handleKeyDown(event) {
    if (event.key === 'Tab') {
      const controls = [...(clientDetailRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') || [])].filter(element => element.getClientRects().length)
      const first = controls[0], last = controls[controls.length - 1]
      if (!first) { event.preventDefault(); clientDetailRef.current?.focus() }
      else if (event.shiftKey && (document.activeElement === first || !clientDetailRef.current?.contains(document.activeElement))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !clientDetailRef.current?.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    if (event.key === 'Escape' && !petBusy) {
      setSelectedClientId(null)
    }
  }

  if (selectedClientId) {
    window.addEventListener(
      'keydown',
      handleKeyDown
    )
  }

  return () => {
    window.removeEventListener(
      'keydown',
      handleKeyDown
    )
  }
}, [selectedClientId, petBusy])

  async function addClient(newClient) {
    if (!salonId) {
      throw new Error(
        'Salon još nije učitan. Pokušajte ponovno.'
      )
    }

    const savedClient = await createClient(
      mapClientToPayload(newClient)
    )

    setClientList((currentClients) => [
      ...currentClients,
      {
        ...mapClientToFrontend(savedClient),
        visits: 0,
      },
    ])
  }

  async function updateClient(updatedClient) {
    if (!salonId) {
      throw new Error(
        'Salon još nije učitan. Pokušajte ponovno.'
      )
    }

    const savedClient = await updateClientApi(
      updatedClient.id,
      mapClientToPayload(updatedClient)
    )

    setClientList((currentClients) =>
      currentClients.map((client) =>
        String(client.id) === String(savedClient.id)
          ? {
              ...client,
              ...mapClientToFrontend(savedClient),
            }
          : client
      )
    )

    setEditingClient(null)
  }

  async function changeClientActive(client) {
    if (!salonId) {
      throw new Error(
        'Salon još nije učitan. Pokušajte ponovno.'
      )
    }

    const nextActive = client.active === false

    if (!nextActive) {
      const confirmed = window.confirm(
        clientDynamic(language,'archiveClient',client.name)
      )

      if (!confirmed) {
        return
      }
    }

    try {
      const savedClient = await updateClientActive(
        client.id,
        nextActive
      )

      setClientList((currentClients) =>
        currentClients.map((currentClient) =>
          String(currentClient.id) === String(savedClient.id)
            ? {
                ...currentClient,
                ...mapClientToFrontend(savedClient),
              }
            : currentClient
        )
      )
    } catch (error) {
      console.error(
        'Neuspješna promjena statusa klijenta:',
        error
      )

      window.alert(
        clientError(languageRef.current,error)
      )
    }
  }

  function cancelEdit() {
    setEditingClient(null)
  }

  function startEditingClient(client) {
  setEditingClient(client)

  requestAnimationFrame(() => {
    clientFormRef.current?.querySelector('h2')?.focus({ preventScroll: true })
    clientFormRef.current?.scrollIntoView({
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start',
    })
  })
}

const clientsWithMetrics = clientList.map(
  (client) => {
    const completedAppointments =
      appointmentList.filter(
        (appointment) =>
          appointment.clientId === client.id &&
          appointment.status === 'Završen'
      )

    const scheduledAppointments =
      appointmentList.filter(
        (appointment) =>
          appointment.clientId === client.id &&
          appointment.status !== 'Završen'
      )

    const sortedCompletedAppointments = [
      ...completedAppointments,
    ].sort(
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

    const lastVisit =
      sortedCompletedAppointments[0] ||
      null

    const now = new Date()

    const futureScheduledAppointments =
      scheduledAppointments.filter(
        (appointment) => {
          const appointmentDateTime =
            new Date(
              `${appointment.date}T${appointment.time}`
            )

          return appointmentDateTime >= now
        }
      )

    const sortedFutureAppointments = [
      ...futureScheduledAppointments,
    ].sort(
      (
        firstAppointment,
        secondAppointment
      ) => {
        const firstDateTime = new Date(
          `${firstAppointment.date}T${firstAppointment.time}`
        )

        const secondDateTime = new Date(
          `${secondAppointment.date}T${secondAppointment.time}`
        )

        return (
          firstDateTime -
          secondDateTime
        )
      }
    )

    const nextAppointment =
      sortedFutureAppointments[0] ||
      null

    const totalSpent =
      completedAppointments.reduce(
        (total, appointment) =>
          total +
          (
            Number(
              appointment.servicePrice
            ) || 0
          ),
        0
      )

    const visits =
      completedAppointments.length

    const averageAppointmentValue =
      visits > 0
        ? totalSpent / visits
        : 0

    const serviceUsage =
      completedAppointments.reduce(
        (usage, appointment) => {
          const serviceName =
            appointment.serviceName ||
            appointment.service ||
            f('Nepoznata usluga')

          usage[serviceName] =
            (usage[serviceName] || 0) +
            1

          return usage
        },
        {}
      )

    const favoriteServiceEntry =
      Object.entries(serviceUsage).sort(
        (
          firstEntry,
          secondEntry
        ) =>
          secondEntry[1] -
          firstEntry[1]
      )[0]

    const favoriteService =
      favoriteServiceEntry
        ? favoriteServiceEntry[0]
        : ''

    return {
      ...client,
      visits,
      totalSpent,
      averageAppointmentValue,
      lastVisit,
      nextAppointment,
      favoriteService,
    }
  }
)

const filteredClients =
  clientsWithMetrics.filter(
  (client) => {
    const normalizedQuery =
      searchQuery
        .trim()
        .toLowerCase()

    if (!normalizedQuery) {
      return true
    }

    const matchesName =
      client.name
        .toLowerCase()
        .includes(normalizedQuery)

    const searchablePhone = [
      client.phone,
      client.phoneNumber,
      client.phoneNormalized,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    const matchesPhone =
      searchablePhone.includes(
        normalizedQuery
      )

    return matchesName || matchesPhone
  }
)

const filteredAndSortedClients = [
  ...filteredClients,
].sort((firstClient, secondClient) => {
  if (sortOption === 'name-asc') {
    return firstClient.name.localeCompare(
      secondClient.name,
      language === 'en' ? 'en' : 'hr'
    )
  }

  if (sortOption === 'name-desc') {
    return secondClient.name.localeCompare(
      firstClient.name,
      language === 'en' ? 'en' : 'hr'
    )
  }

  if (sortOption === 'visits-desc') {
    return (
      (secondClient.visits || 0) -
      (firstClient.visits || 0)
    )
  }

  if (sortOption === 'visits-asc') {
    return (
      (firstClient.visits || 0) -
      (secondClient.visits || 0)
    )
  }

  return 0
})

const selectedClient =
  clientsWithMetrics.find(
    (client) =>
      client.id === selectedClientId
  ) || null

const selectedClientHistory =
  selectedClient
    ? appointmentList
        .filter(
          (appointment) =>
            appointment.clientId ===
              selectedClient.id &&
            appointment.status ===
              'Završen'
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
    : []

const selectedClientUpcomingAppointments =
  selectedClient
    ? appointmentList
        .filter((appointment) => {
          if (
            appointment.clientId !==
              selectedClient.id ||
            appointment.status === 'Završen'
          ) {
            return false
          }

          const appointmentDateTime =
            new Date(
              `${appointment.date}T${appointment.time}`
            )

          return appointmentDateTime >= new Date()
        })
        .sort(
          (
            firstAppointment,
            secondAppointment
          ) => {
            const firstDateTime =
              new Date(
                `${firstAppointment.date}T${firstAppointment.time}`
              )

            const secondDateTime =
              new Date(
                `${secondAppointment.date}T${secondAppointment.time}`
              )

            return (
              firstDateTime -
              secondDateTime
            )
          }
        )
    : []

  return (
    <div className="clients-page">
      <div className="clients-header">
        <div>
          <span className="clients-eyebrow">
            CRM
          </span>

          <h1>{f("Klijenti")}</h1>

          <p>{f("Upravljajte klijentima i njihovim kontakt podacima.")} </p>
        </div>

        <div className="clients-count">
          <span>{f("Ukupno klijenata")}</span>

          <strong>
            {clientList.length}
          </strong>
        </div>
      </div>

     <div ref={clientFormRef}>
  <ClientForm
    clientList={clientList}
    onAddClient={addClient}
    onUpdateClient={updateClient}
    onCancelEdit={cancelEdit}
    editingClient={editingClient}
  />
</div>

   {selectedClient && (
<div
  className="client-detail-overlay"
  onClick={() => { if (!petBusy) setSelectedClientId(null) }}
>
  <section
  className="client-detail-panel"
  ref={clientDetailRef}
  tabIndex={-1}
  role="dialog"
  aria-modal="true"
  aria-labelledby="client-detail-title"
  onClick={(event) =>
    event.stopPropagation()
  }
>
     <div className="client-detail-header">
       <div>
        <span className="client-detail-eyebrow">{f("Profil klijenta")} </span>

        <h2 id="client-detail-title">
  {selectedClient.name}
</h2>

        <p>{selectedClient.phone || f('Telefon nije unesen')}</p>
<p>
  {selectedClient.isOccasional
    ? f('Povremeni klijent')
    : f('Stalni klijent')}
</p>
       </div>

       <button
  type="button"
  className="client-detail-close-button"
  disabled={petBusy}
  onClick={() => { if (!petBusy) setSelectedClientId(null) }}
  aria-label={f("Zatvori profil klijenta")}
>{f("Zatvori")} </button>
    </div>

    <ClientPets key={`${salonId}:${selectedClient.id}`} salonId={salonId} client={selectedClient} onBusyChange={setPetBusy} />

    <div className="client-detail-metrics">
      <div className="client-detail-metric">
        <span>{f("Ukupno posjeta")}</span>
        <strong>
          {selectedClient.visits}
        </strong>
      </div>

      <div className="client-detail-metric">
        <span>{f("Ukupno potrošeno")}</span>
        <strong>
          {clientMoney(language,selectedClient.totalSpent)}
        </strong>
      </div>

      <div className="client-detail-metric">
        <span>{f("Prosječna vrijednost")}</span>
        <strong>
          {clientMoney(language,selectedClient.averageAppointmentValue)}
        </strong>
      </div>

      <div className="client-detail-metric">
        <span>{f("Najčešća usluga")}</span>
        <strong>
          {selectedClient.favoriteService ||
            f('Nema podataka')}
        </strong>
      </div>

      <div className="client-detail-metric">
        <span>{f("Zadnji posjet")}</span>

  <strong>
    {selectedClient.lastVisit
      ? `${formatClientAppointmentDate(selectedClient.lastVisit.date, language)} ${language === 'en' ? 'at' : 'u'} ${
          selectedClient.lastVisit.time
        }`
      : f('Nema posjeta')}
  </strong>
</div>

<div className="client-detail-metric">
  <span>{f("Sljedeći termin")}</span>

  <strong>
    {selectedClient.nextAppointment
      ? `${formatClientAppointmentDate(selectedClient.nextAppointment.date, language)} ${language === 'en' ? 'at' : 'u'} ${
          selectedClient.nextAppointment.time
        }`
      : f('Nema termina')}
  </strong>
 </div>


</div>

<div className="client-history">
  <div className="client-history-header">
    <div>
      <span className="client-detail-eyebrow">{f("Povijest")} </span>

      <h3>{f("Povijest termina")}</h3>
    </div>

    <strong>
      {clientCount(language,selectedClientHistory.length,'visits')}
    </strong>
  </div>

  {selectedClientHistory.length === 0 ? (
    <div className="client-history-empty">{f("Ovaj klijent još nema završenih termina.")} </div>
  ) : (
    <div className="client-history-list">
      {selectedClientHistory.map(
        (appointment) => (
          <div
            key={appointment.id}
            className="client-history-item"
          >
            <div className="client-history-date">
              <strong>
                {formatClientAppointmentDate(appointment.date, language)}
              </strong>

              <span>
                {appointment.time}
              </span>
            </div>

            <div className="client-history-service">
              {appointment.petId && <p>{overviewRecipient(language,appointment)}</p>}
              <strong>
                {appointment.serviceName ||
                  appointment.service ||
                  f('Nepoznata usluga')}
              </strong>

              <span>{f("Završen termin")} </span>
            </div>

            <div className="client-history-price">
              {clientMoney(language,appointment.servicePrice)}
            </div>
          </div>
        )
      )}
     </div>
   )}
</div>

<div className="client-upcoming">
  <div className="client-history-header">
    <div>
      <span className="client-detail-eyebrow">{f("Nadolazeće")} </span>

      <h3>{f("Nadolazeći termini")}</h3>
    </div>

    <strong>
      {clientCount(language,selectedClientUpcomingAppointments.length,'appointments')}
    </strong>
  </div>

  {selectedClientUpcomingAppointments.length === 0 ? (
    <div className="client-history-empty">{f("Ovaj klijent nema nadolazećih termina.")} </div>
  ) : (
    <div className="client-history-list">
      {selectedClientUpcomingAppointments.map(
        (appointment) => (
          <div
            key={appointment.id}
            className="client-history-item"
          >
            <div className="client-history-date">
              <strong>
                {formatClientAppointmentDate(appointment.date, language)}
              </strong>

              <span>
                {appointment.time}
              </span>
            </div>

            <div className="client-history-service">
              {appointment.petId && <p>{overviewRecipient(language,appointment)}</p>}
              <strong>
                {appointment.serviceName ||
                  appointment.service ||
                  f('Nepoznata usluga')}
              </strong>

              <span>
                {overviewStatus(language,appointment)}
              </span>
            </div>

            <div className="client-history-price">
              {appointment.servicePrice != null
                ? `${clientMoney(language,appointment.servicePrice)}`
                : '—'}
            </div>
          </div>
        )
      )}
    </div>
  )}
</div>


    </section>
  </div>
)}





  <div className="clients-toolbar">
  <div className="clients-search">
    <label htmlFor="clients-search">{f("Pretraži klijente")} </label>

    <input
      id="clients-search"
      type="search"
      value={searchQuery}
      onChange={(event) =>
        setSearchQuery(
          event.target.value
        )
      }
      placeholder={f("Ime ili telefon...")}
    />
  </div>
<div className="clients-sort">
  <label htmlFor="clients-sort">{f("Sortiraj")} </label>

  <select
    id="clients-sort"
    value={sortOption}
    onChange={(event) =>
      setSortOption(event.target.value)
    }
  >
    <option value="name-asc">{f("Ime A–Ž")} </option>

    <option value="name-desc">{f("Ime Ž–A")} </option>

    <option value="visits-desc">{f("Najviše posjeta")} </option>

    <option value="visits-asc">{f("Najmanje posjeta")} </option>
  </select>
 </div>
</div>



      {clientList.length === 0 ? (
        <div className="clients-empty-state">
          <div className="clients-empty-icon">
            👥
          </div>

          <h2>{f("Još nema klijenata")}</h2>

          <p>{f("Dodajte prvog klijenta kako biste počeli graditi bazu klijenata salona.")} </p>
        </div>
      ) : (
        <>
          <div className="clients-list-header">
            <span>{f("Klijent")}</span>
            <span>{f("Telefon")}</span>
            <span>{f("Posjete")}</span>
            <span>{f("Akcije")}</span>
          </div>

          <div className="clients-list">
            {filteredAndSortedClients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                isEditing={String(editingClient?.id) === String(client.id)}
                onEdit={startEditingClient}
                onSelect={setSelectedClientId}
                onToggleActive={changeClientActive}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default Clients
