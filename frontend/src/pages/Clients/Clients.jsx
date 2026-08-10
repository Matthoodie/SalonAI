import { useState } from 'react'
import ClientForm from '../../components/ClientForm/ClientForm'
import ClientCard from '../../components/ClientCard/ClientCard'
import './Clients.css'

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

const clientsWithMetrics = clientList.map(
  (client) => {
    const completedAppointments =
      appointmentList.filter(
        (appointment) =>
          appointment.clientId === client.id &&
          appointment.status === 'Završen'
      )

    return {
      ...client,
      visits: completedAppointments.length,
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

      <ClientForm
        clientList={clientList}
        onAddClient={addClient}
        onUpdateClient={updateClient}
        onCancelEdit={cancelEdit}
        editingClient={editingClient}
      />

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
                onEdit={setEditingClient}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default Clients