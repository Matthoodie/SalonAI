import { useState } from 'react'
import ServiceForm from '../../components/ServiceForm/ServiceForm'
import './Services.css'

function formatPrice(price) {
  return new Intl.NumberFormat('hr-HR', {
    style: 'currency',
    currency: 'EUR',
  }).format(price)
}

function formatDuration(defaultDurationMinutes) {
  if (!defaultDurationMinutes) {
    return 'Nije definirano'
  }

  const hours = Math.floor(defaultDurationMinutes / 60)
  const minutes = defaultDurationMinutes % 60

  if (hours === 0) {
    return `${minutes} min`
  }

  if (minutes === 0) {
    return `${hours} h`
  }

  return `${hours} h ${minutes} min`
}
function Services({
  serviceList = [],
  setServiceList,
}) {

const [isFormOpen, setIsFormOpen] =
  useState(false)

const [editingService, setEditingService] =
  useState(null)

function addService(newService) {
  setServiceList((currentServices) => [
    ...currentServices,
    newService,
  ])

  setIsFormOpen(false)
  setEditingService(null)
}

function startEditingService(service) {
  setEditingService(service)
  setIsFormOpen(true)
}

function updateService(updatedService) {
  setServiceList((currentServices) =>
    currentServices.map((service) =>
      service.id === updatedService.id
        ? updatedService
        : service
    )
  )

  setEditingService(null)
  setIsFormOpen(false)
}

function cancelServiceForm() {
  setEditingService(null)
  setIsFormOpen(false)
}

function toggleServiceActive(serviceId) {
  setServiceList((currentServices) =>
    currentServices.map((service) =>
      service.id === serviceId
        ? {
            ...service,
            active: !service.active,
          }
        : service
    )
  )

  if (editingService?.id === serviceId) {
    setEditingService((currentService) => ({
      ...currentService,
      active: !currentService.active,
    }))
  }
}

  const activeServicesCount = serviceList.filter(
    (service) => service.active
  ).length

  const inactiveServicesCount =
    serviceList.length - activeServicesCount

  return (
    <div className="services-page">
      <div className="services-page-header">
        <div>
          <span className="services-eyebrow">
            Katalog ponude
          </span>

          <h1>Usluge</h1>

          <p>
            Upravljajte cijenama, zadanim trajanjem i
            dostupnošću usluga salona.
          </p>
        </div>

      <button
  type="button"
  className="services-add-button"
  onClick={() => {
  setEditingService(null)
  setIsFormOpen(true)
}}
>
  + Nova usluga
</button>
      </div>

  {isFormOpen && (
  <ServiceForm
    onAddService={addService}
    onUpdateService={updateService}
    onCancel={cancelServiceForm}
    editingService={editingService}
  />
)}

      <div className="services-summary">
        <div className="services-summary-item">
          <span>Ukupno</span>
          <strong>{serviceList.length}</strong>
        </div>

        <div className="services-summary-item">
          <span>Aktivne</span>
          <strong>{activeServicesCount}</strong>
        </div>

        <div className="services-summary-item">
          <span>Neaktivne</span>
          <strong>{inactiveServicesCount}</strong>
        </div>
      </div>

      {serviceList.length === 0 ? (
        <div className="services-empty-state">
          <span className="services-empty-icon">
            ✂️
          </span>

          <h2>Nema dodanih usluga</h2>

          <p>
            Dodajte prvu uslugu kako biste mogli povezati
            cijene i trajanje s terminima.
          </p>
        </div>
      ) : (
        <div className="services-list">
          {serviceList.map((service) => (
            <article
              key={service.id}
              className={
                service.active
                  ? 'service-card'
                  : 'service-card service-card-inactive'
              }
            >
              <div className="service-card-header">
                <div>
                  <span className="service-card-label">
                    Usluga
                  </span>

                  <h2>{service.name}</h2>
                </div>

                <span
                  className={
                    service.active
                      ? 'service-status service-status-active'
                      : 'service-status service-status-inactive'
                  }
                >
                  {service.active
                    ? 'Aktivna'
                    : 'Neaktivna'}
                </span>
              </div>

              <div className="service-card-details">
                <div className="service-card-detail">
                  <span>Cijena</span>

                  <strong>
                    {formatPrice(service.price)}
                  </strong>
                </div>

                <div className="service-card-detail">
                  <span>Zadano trajanje</span>

                  <strong>
                    {formatDuration(
                      service.defaultDurationMinutes
                    )}
                  </strong>
                </div>
              </div>

              <div className="service-card-actions">
                <button
  type="button"
  className="service-action-button"
  onClick={() =>
    startEditingService(service)
  }
>
  Uredi
</button>

               <button
  type="button"
  className="service-action-button"
  onClick={() =>
    toggleServiceActive(service.id)
  }
>
  {service.active
    ? 'Deaktiviraj'
    : 'Aktiviraj'}
</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

export default Services