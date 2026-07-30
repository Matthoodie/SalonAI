import ClientForm from '../../components/ClientForm'
import ClientCard from '../../components/ClientCard/ClientCard'
import './Clients.css'


function Clients({ clientList, setClientList }) {


    function addClient(newClient) {

  setClientList([
    ...clientList,
    newClient
  ])

}


  return (
    <div className="clients-page">

      <h1>
        Klijenti
      </h1>
<ClientForm onAddClient={addClient} />

      {clientList.map((client) => (

        <ClientCard
          key={client.id}
          client={client}
        />

      ))}

    </div>
  )

}


export default Clients