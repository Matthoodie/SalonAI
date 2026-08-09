import { useState } from 'react'
import ClientForm from '../../components/ClientForm/ClientForm'
import ClientCard from '../../components/ClientCard/ClientCard'
import './Clients.css'

function Clients({
  clientList,
  setClientList,
}) {
  const [editingClient, setEditingClient] =
    useState(null)

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
            {clientList.map((client) => (
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