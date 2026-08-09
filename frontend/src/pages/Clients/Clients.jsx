import { useState } from 'react'
import ClientForm from '../../components/ClientForm/ClientForm'
import ClientCard from '../../components/ClientCard/ClientCard'
import './Clients.css'


function Clients({ clientList, setClientList }) {

const [editingClient, setEditingClient] =
  useState(null)

function addClient(newClient) {

  setClientList([
    ...clientList,
    newClient
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

      <h1>
        Klijenti
      </h1>
<ClientForm
  onAddClient={addClient}
  onUpdateClient={updateClient}
  onCancelEdit={cancelEdit}
  editingClient={editingClient}
/>

      {clientList.map((client) => (

        <ClientCard
         key={client.id}
         client={client}
         onEdit={setEditingClient}
        />

      ))}

    </div>
  )

}


export default Clients