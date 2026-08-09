import './ClientCard.css'

function ClientCard({
  client,
  onEdit,
}) {
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

      <button
        type="button"
        onClick={() => onEdit(client)}
      >
        Uredi
      </button>
    </div>
  )
}

export default ClientCard