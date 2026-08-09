import './ClientCard.css'

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((namePart) =>
      namePart.charAt(0).toUpperCase()
    )
    .join('')
}

function ClientCard({
  client,
  onEdit,
}) {
  return (
    <div className="client-card">
      <div className="client-card-person">
        <div className="client-avatar">
          {getInitials(client.name)}
        </div>

        <div className="client-card-name">
          <h3>{client.name}</h3>

          <span>
            Klijent
          </span>
        </div>
      </div>

      <div className="client-card-phone">
        <span className="client-mobile-label">
          Telefon
        </span>

        <strong>
          {client.phone}
        </strong>
      </div>

      <div className="client-card-visits">
        <span className="client-mobile-label">
          Posjete
        </span>

        <strong>
          {client.visits}
        </strong>
      </div>

      <div className="client-card-actions">
        <button
          type="button"
          className="client-edit-button"
          onClick={() => onEdit(client)}
        >
          Uredi
        </button>
      </div>
    </div>
  )
}

export default ClientCard