import { useLanguage } from '../Language/LanguageProvider'
import { clientText } from '../Language/clientText.js'
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
  const {language}=useLanguage()
  const f=source=>clientText(language,source)

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
          {isEditing && <span className="client-editing-label">{f("Uređivanje u tijeku")}</span>}

          <span>
            {isArchived
  ? f('Arhiviran')
  : client.isOccasional
    ? f('Povremeni klijent')
    : f('Stalni klijent')}
          </span>
        </div>
      </div>

      <div className="client-card-phone">
        <span className="client-mobile-label">{f("Telefon")} </span>

        <strong>
         {client.phone || f('Telefon nije unesen')}
        </strong>
      </div>

      <div className="client-card-visits">
        <span className="client-mobile-label">{f("Posjete")} </span>

        <strong>
          {client.visits}
        </strong>
      </div>

      <div className="client-card-actions">
        <button
          type="button"
          className="client-details-button"
          onClick={() => onSelect(client.id)}
        >{f("Detalji")} </button>

        <button
          type="button"
          className="client-edit-button"
          onClick={() => onEdit(client)}
        >{f("Uredi")} </button>

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
            ? f('Ponovno aktiviraj')
            : f('Arhiviraj')}
        </button>
      </div>
    </div>
  )
}
export default ClientCard
