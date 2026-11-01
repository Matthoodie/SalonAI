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
  isEditing = false,
  onEdit,
  onSelect,
  onToggleActive,
}) {
  const isArchived = client.active === false

  return (
    <div
      className={
        `client-card${isArchived ? ' client-card-archived' : ''}${isEditing ? ' client-card-editing' : ''}`
      }
    >
      <div className="client-card-person">
        <div className="client-avatar">
          {getInitials(client.name)}
        </div>

        <div className="client-card-name">
          <h3>{client.name}</h3>
          {isEditing && <span className="client-editing-label">Uređivanje u tijeku</span>}

          <span>
            {isArchived
  ? 'Arhiviran'
  : client.isOccasional
    ? 'Povremeni klijent'
    : 'Stalni klijent'}
          </span>
        </div>
      </div>

      <div className="client-card-phone">
        <span className="client-mobile-label">
          Telefon
        </span>

        <strong>
         {client.phone || 'Telefon nije unesen'}
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
          className="client-details-button"
          onClick={() => onSelect(client.id)}
        >
          Detalji
        </button>

        <button
          type="button"
          className="client-edit-button"
          onClick={() => onEdit(client)}
        >
          Uredi
        </button>

        <button
          type="button"
          className={
            isArchived
              ? 'client-reactivate-button'
              : 'client-archive-button'
          }
          onClick={() => onToggleActive(client)}
        >
          {isArchived
            ? 'Ponovno aktiviraj'
            : 'Arhiviraj'}
        </button>
      </div>
    </div>
  )
}
export default ClientCard
