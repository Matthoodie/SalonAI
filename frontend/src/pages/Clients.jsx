import { clients } from '../data/clients'
import '../styles/clients.css'
import ClientCard from '../components/ClientCard'


function Clients() {


  return (
    <div className="clients-page">

      <h1>
        Klijenti
      </h1>


      {clients.map((client) => (

        <ClientCard
          key={client.id}
          client={client}
        />

      ))}

    </div>
  )

}


export default Clients