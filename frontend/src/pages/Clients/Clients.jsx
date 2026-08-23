import {
  useEffect,
  useRef,
  useState,
} from 'react'
import ClientForm from '../../components/ClientForm/ClientForm'
import ClientCard from '../../components/ClientCard/ClientCard'
import './Clients.css'

function formatClientAppointmentDate(date) {
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
    'hr-HR',
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
}) {
  const [editingClient, setEditingClient] =
    useState(null)

  const [searchQuery, setSearchQuery] =
    useState('')

  const [sortOption, setSortOption] =
  useState('name-asc')

  const [selectedClientId, setSelectedClientId] =
  useState(null)

  const clientFormRef = useRef(null)

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
    if (event.key === 'Escape') {
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
}, [selectedClientId])

  function addClient(newClient) {
    setClientList([
      ...clientList,
      newClient,
    ])
  }

  function updateClient(updatedClient) {
    setClientList((currentClients) =>
      currentClients.map((client) =>
        client.id === updatedClient.id
          ? updatedClient
          : client
      )
    )

    setEditingClient(null)
  }

  function cancelEdit() {
    setEditingClient(null)
  }

  function startEditingClient(client) {
  setEditingClient(client)

  requestAnimationFrame(() => {
    clientFormRef.current?.scrollIntoView({
      behavior: 'smooth',
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
            'Nepoznata usluga'

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
      'hr'
    )
  }

  if (sortOption === 'name-desc') {
    return secondClient.name.localeCompare(
      firstClient.name,
      'hr'
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

          <h1>Klijenti</h1>

          <p>
            Upravljajte klijentima i njihovim
            kontakt podacima.
          </p>
        </div>

        <div className="clients-count">
          <span>Ukupno klijenata</span>

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
  onClick={() =>
    setSelectedClientId(null)
  }
>
  <section
  className="client-detail-panel"
  role="dialog"
  aria-modal="true"
  aria-labelledby="client-detail-title"
  onClick={(event) =>
    event.stopPropagation()
  }
>
     <div className="client-detail-header">
       <div>
        <span className="client-detail-eyebrow">
          Profil klijenta
        </span>

        <h2 id="client-detail-title">
  {selectedClient.name}
</h2>

        <p>{selectedClient.phone}</p>
       </div>

       <button
  type="button"
  className="client-detail-close-button"
  onClick={() =>
    setSelectedClientId(null)
  }
  aria-label="Zatvori profil klijenta"
>
  Zatvori
</button>
    </div>

    <div className="client-detail-metrics">
      <div className="client-detail-metric">
        <span>Ukupno posjeta</span>
        <strong>
          {selectedClient.visits}
        </strong>
      </div>

      <div className="client-detail-metric">
        <span>Ukupno potrošeno</span>
        <strong>
          {selectedClient.totalSpent.toFixed(2)} €
        </strong>
      </div>

      <div className="client-detail-metric">
        <span>Prosječna vrijednost</span>
        <strong>
          {selectedClient.averageAppointmentValue.toFixed(2)} €
        </strong>
      </div>

      <div className="client-detail-metric">
        <span>Najčešća usluga</span>
        <strong>
          {selectedClient.favoriteService ||
            'Nema podataka'}
        </strong>
      </div>
  
      <div className="client-detail-metric">
        <span>Zadnji posjet</span>

  <strong>
    {selectedClient.lastVisit
      ? `${formatClientAppointmentDate(
          selectedClient.lastVisit.date
        )} u ${
          selectedClient.lastVisit.time
        }`
      : 'Nema posjeta'}
  </strong>
</div>

<div className="client-detail-metric">
  <span>Sljedeći termin</span>

  <strong>
    {selectedClient.nextAppointment
      ? `${formatClientAppointmentDate(
          selectedClient.nextAppointment.date
        )} u ${
          selectedClient.nextAppointment.time
        }`
      : 'Nema termina'}
  </strong>
 </div>


</div>

<div className="client-history">
  <div className="client-history-header">
    <div>
      <span className="client-detail-eyebrow">
        Povijest
      </span>

      <h3>Povijest termina</h3>
    </div>

    <strong>
      {selectedClientHistory.length}
      {' '}
      {selectedClientHistory.length === 1
        ? 'posjet'
        : 'posjeta'}
    </strong>
  </div>

  {selectedClientHistory.length === 0 ? (
    <div className="client-history-empty">
      Ovaj klijent još nema završenih termina.
    </div>
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
                {formatClientAppointmentDate(
                  appointment.date
                )}
              </strong>

              <span>
                {appointment.time}
              </span>
            </div>

            <div className="client-history-service">
              <strong>
                {appointment.serviceName ||
                  appointment.service ||
                  'Nepoznata usluga'}
              </strong>

              <span>
                Završen termin
              </span>
            </div>

            <div className="client-history-price">
              {Number(
                appointment.servicePrice
              ).toFixed(2)} €
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
      <span className="client-detail-eyebrow">
        Nadolazeće
      </span>

      <h3>Nadolazeći termini</h3>
    </div>

    <strong>
      {selectedClientUpcomingAppointments.length}
      {' '}
      {selectedClientUpcomingAppointments.length === 1
        ? 'termin'
        : 'termina'}
    </strong>
  </div>

  {selectedClientUpcomingAppointments.length === 0 ? (
    <div className="client-history-empty">
      Ovaj klijent nema nadolazećih termina.
    </div>
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
                {formatClientAppointmentDate(
                  appointment.date
                )}
              </strong>

              <span>
                {appointment.time}
              </span>
            </div>

            <div className="client-history-service">
              <strong>
                {appointment.serviceName ||
                  appointment.service ||
                  'Nepoznata usluga'}
              </strong>

              <span>
                {appointment.status}
              </span>
            </div>

            <div className="client-history-price">
              {appointment.servicePrice != null
                ? `${Number(
                    appointment.servicePrice
                  ).toFixed(2)} €`
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
    <label htmlFor="clients-search">
      Pretraži klijente
    </label>

    <input
      id="clients-search"
      type="search"
      value={searchQuery}
      onChange={(event) =>
        setSearchQuery(
          event.target.value
        )
      }
      placeholder="Ime ili telefon..."
    />
  </div>
<div className="clients-sort">
  <label htmlFor="clients-sort">
    Sortiraj
  </label>

  <select
    id="clients-sort"
    value={sortOption}
    onChange={(event) =>
      setSortOption(event.target.value)
    }
  >
    <option value="name-asc">
      Ime A–Ž
    </option>

    <option value="name-desc">
      Ime Ž–A
    </option>

    <option value="visits-desc">
      Najviše posjeta
    </option>

    <option value="visits-asc">
      Najmanje posjeta
    </option>
  </select>
 </div>
</div>



      {clientList.length === 0 ? (
        <div className="clients-empty-state">
          <div className="clients-empty-icon">
            👥
          </div>

          <h2>Još nema klijenata</h2>

          <p>
            Dodajte prvog klijenta kako biste
            počeli graditi bazu klijenata salona.
          </p>
        </div>
      ) : (
        <>
          <div className="clients-list-header">
            <span>Klijent</span>
            <span>Telefon</span>
            <span>Posjete</span>
            <span>Akcije</span>
          </div>

          <div className="clients-list">
            {filteredAndSortedClients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                onEdit={startEditingClient}
                onSelect={setSelectedClientId}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default Clients