function ClientCard({ client }) {

  return (
    <div className="client-card">

      <h3>
        {client.name}
      </h3>

      <p>
        {client.phone}
      </p>

      <p>
        Posjete: {client.visits}
      </p>

    </div>
  )
}

export default ClientCard