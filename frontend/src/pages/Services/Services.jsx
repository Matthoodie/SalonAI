import { useState } from 'react'

import ServiceForm from '../../components/ServiceForm/ServiceForm'

import {
  createService,
  updateService as updateServiceApi,
  updateServiceActive,
} from '../../api/serviceApi'

import {
  mapServiceToFrontend,
} from '../../api/serviceMapper'

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
  salonId,
}) {
  const [isFormOpen, setIsFormOpen] =
    useState(false)

  const [editingService, setEditingService] =
    useState(null)

  const [
    isCreatingService,
    setIsCreatingService,
  ] = useState(false)

  const [
    isUpdatingService,
    setIsUpdatingService,
  ] = useState(false)

  const [
    updatingServiceActiveId,
    setUpdatingServiceActiveId,
  ] = useState(null)

  const [searchQuery, setSearchQuery] =
    useState('')

  const [
    selectedCategory,
    setSelectedCategory,
  ] = useState('all')

  const [selectedStatus, setSelectedStatus] =
    useState('all')

  async function addService(newService) {
    if (!salonId) {
      window.alert(
        'Podaci salona nisu učitani. Pokušajte ponovno.'
      )

      return false
    }

    if (isCreatingService) {
      return false
    }

    setIsCreatingService(true)

    try {
      const backendService =
        await createService({
          salonId,
          name: newService.name,
          category: newService.category,
          priceCents:
            Math.round(
              newService.price * 100
            ),
          defaultDurationMinutes:
            newService.defaultDurationMinutes,
        })

      const createdService =
        mapServiceToFrontend(
          backendService
        )

      setServiceList(
        (currentServices) => [
          ...currentServices,
          createdService,
        ]
      )

      setIsFormOpen(false)
      setEditingService(null)

      return true
    } catch (error) {
      console.error(
        'Neuspješno kreiranje usluge:',
        error
      )

      window.alert(
        error.message ||
        'Uslugu trenutno nije moguće kreirati.'
      )

      return false
    } finally {
      setIsCreatingService(false)
    }
  }

  function startEditingService(service) {
    setEditingService(service)
    setIsFormOpen(true)
  }

  async function updateService(updatedService) {
    if (!salonId) {
      window.alert(
        'Podaci salona nisu učitani. Pokušajte ponovno.'
      )

      return false
    }

    if (isUpdatingService) {
      return false
    }

    setIsUpdatingService(true)

    try {
      const backendService =
        await updateServiceApi({
          serviceId: updatedService.id,
          salonId,
          name: updatedService.name,
          category: updatedService.category,
          priceCents:
            Math.round(
              updatedService.price * 100
            ),
          defaultDurationMinutes:
            updatedService.defaultDurationMinutes,
        })

      const mappedService =
        mapServiceToFrontend(
          backendService
        )

      setServiceList(
        (currentServices) =>
          currentServices.map((service) =>
            service.id === mappedService.id
              ? mappedService
              : service
          )
      )

      setEditingService(null)
      setIsFormOpen(false)

      return true
    } catch (error) {
      console.error(
        'Neuspješno uređivanje usluge:',
        error
      )

      window.alert(
        error.message ||
        'Uslugu trenutno nije moguće urediti.'
      )

      return false
    } finally {
      setIsUpdatingService(false)
    }
  }

  function cancelServiceForm() {
    setEditingService(null)
    setIsFormOpen(false)
  }

  async function toggleServiceActive(
    serviceId
  ) {
    if (!salonId) {
      window.alert(
        'Podaci salona nisu učitani. Pokušajte ponovno.'
      )

      return
    }

    if (updatingServiceActiveId !== null) {
      return
    }

    const serviceToUpdate =
      serviceList.find(
        (service) =>
          service.id === serviceId
      )

    if (!serviceToUpdate) {
      return
    }

    setUpdatingServiceActiveId(
      serviceId
    )

    try {
      const backendService =
        await updateServiceActive({
          serviceId,
          salonId,
          active:
            !serviceToUpdate.active,
        })

      const mappedService =
        mapServiceToFrontend(
          backendService
        )

      setServiceList(
        (currentServices) =>
          currentServices.map(
            (service) =>
              service.id ===
                mappedService.id
                ? mappedService
                : service
          )
      )

      if (
        editingService?.id ===
        mappedService.id
      ) {
        setEditingService(
          mappedService
        )
      }
    } catch (error) {
      console.error(
        'Neuspješna promjena statusa usluge:',
        error
      )

      window.alert(
        error.message ||
        'Status usluge trenutno nije moguće promijeniti.'
      )
    } finally {
      setUpdatingServiceActiveId(
        null
      )
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
          isCreating={isCreatingService}
          isUpdating={isUpdatingService}
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
                    disabled={
                      updatingServiceActiveId !== null
                    }
                  >
                    {updatingServiceActiveId ===
                      service.id
                      ? 'Spremanje...'
                      : service.active
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