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

  const hours = Math.floor(
    defaultDurationMinutes / 60
  )

  const minutes =
    defaultDurationMinutes % 60

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

  const [searchQuery, setSearchQuery] =
    useState('')

  const [
    selectedCategory,
    setSelectedCategory,
  ] = useState('all')

  const [selectedStatus, setSelectedStatus] =
  useState('all')

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

  const activeServicesCount =
    serviceList.filter(
      (service) => service.active
    ).length

  const inactiveServicesCount =
    serviceList.length -
    activeServicesCount

  const categories = [
    ...new Set(
      serviceList.map(
        (service) =>
          service.category || 'Ostalo'
      )
    ),
  ].sort()

const filteredServices =
  serviceList.filter((service) => {
    const matchesSearch =
      service.name
        .toLowerCase()
        .includes(
          searchQuery.toLowerCase()
        )

    const matchesCategory =
      selectedCategory === 'all' ||
      (service.category || 'Ostalo') ===
        selectedCategory

    const matchesStatus =
      selectedStatus === 'all' ||
      (selectedStatus === 'active' &&
        service.active) ||
      (selectedStatus === 'inactive' &&
        !service.active)

    return (
      matchesSearch &&
      matchesCategory &&
      matchesStatus
    )
  })

  return (
    <div className="services-page">
      <div className="services-page-header">
        <div>
          <span className="services-eyebrow">
            Katalog ponude
          </span>

          <h1>Usluge</h1>

          <p>
            Upravljajte cijenama, zadanim
            trajanjem i dostupnošću usluga
            salona.
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
          <strong>
            {serviceList.length}
          </strong>
        </div>

        <div className="services-summary-item">
          <span>Aktivne</span>
          <strong>
            {activeServicesCount}
          </strong>
        </div>

        <div className="services-summary-item">
          <span>Neaktivne</span>
          <strong>
            {inactiveServicesCount}
          </strong>
        </div>
      </div>

      <div className="services-toolbar">
        <div className="services-search">
          <label htmlFor="services-search">
            Pretraži usluge
          </label>

          <input
            id="services-search"
            type="search"
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(
                event.target.value
              )
            }
            placeholder="Upišite naziv usluge..."
          />
        </div>

        <div className="services-filter">
          <label htmlFor="services-category-filter">
            Kategorija
          </label>

          <select
            id="services-category-filter"
            value={selectedCategory}
            onChange={(event) =>
              setSelectedCategory(
                event.target.value
              )
            }
          >
            <option value="all">
              Sve kategorije
            </option>

            {categories.map(
              (category) => (
                <option
                  key={category}
                  value={category}
                >
                  {category}
                </option>
              )
            )}
          </select>
        </div>

        <div className="services-filter">
  <label htmlFor="services-status-filter">
    Status
  </label>

  <select
    id="services-status-filter"
    value={selectedStatus}
    onChange={(event) =>
      setSelectedStatus(
        event.target.value
      )
    }
  >
    <option value="all">
      Sve
    </option>

    <option value="active">
      Aktivne
    </option>

    <option value="inactive">
      Neaktivne
    </option>
  </select>
</div>
      </div>

      {serviceList.length === 0 ? (
        <div className="services-empty-state">
          <span className="services-empty-icon">
            ✂️
          </span>

          <h2>Nema dodanih usluga</h2>

          <p>
            Dodajte prvu uslugu kako biste
            mogli povezati cijene i trajanje
            s terminima.
          </p>
        </div>
      ) : (
        <div className="services-list">
          {filteredServices.map(
            (service) => (
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

                    <p className="service-card-category">
                      {service.category ||
                        'Ostalo'}
                    </p>
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
                      {formatPrice(
                        service.price
                      )}
                    </strong>
                  </div>

                  <div className="service-card-detail">
                    <span>
                      Zadano trajanje
                    </span>

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
                      startEditingService(
                        service
                      )
                    }
                  >
                    Uredi
                  </button>

                  <button
                    type="button"
                    className="service-action-button"
                    onClick={() =>
                      toggleServiceActive(
                        service.id
                      )
                    }
                  >
                    {service.active
                      ? 'Deaktiviraj'
                      : 'Aktiviraj'}
                  </button>
                </div>
              </article>
            )
          )}
        </div>
      )}
    </div>
  )
}

export default Services