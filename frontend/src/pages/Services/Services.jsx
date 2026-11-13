import {useLanguage} from '../../components/Language/LanguageProvider'
import {serviceText,serviceError,servicePrice} from '../../components/Language/serviceText.js'
import { useState } from 'react'
import ServiceImport from '../../components/ServiceImport/ServiceImport.jsx'

import ServiceForm from '../../components/ServiceForm/ServiceForm'

import {
  fetchServices,
  createService,
  updateService as updateServiceApi,
  updateServiceActive,
} from '../../api/serviceApi'

import {
  mapServiceToFrontend,
  mapServicesToFrontend,
} from '../../api/serviceMapper'

import './Services.css'

function formatDuration(defaultDurationMinutes, language) {
  if (!defaultDurationMinutes) {
    return serviceText(language,'Nije definirano')
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
  userId,
  canManageServices = false,
  businessType,
}) {
  const {language}=useLanguage()
  const f=source=>serviceText(language,source)

  const [isImportOpen, setIsImportOpen] = useState(false)

  async function refreshImportedServices() {
    const services = await fetchServices()
    setServiceList(mapServicesToFrontend(services))
  }

  const [formFocusRequest, setFormFocusRequest] = useState(0)

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
    if (!canManageServices) {
      return false
    }

    if (!salonId) {
      window.alert(serviceError(language, 'Podaci salona nisu učitani. Pokušajte ponovno.'))

      return false
    }

    if (isCreatingService) {
      return false
    }

    setIsCreatingService(true)

    try {
      const backendService =
        await createService({
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

      window.alert(serviceError(language, error || 'Uslugu trenutno nije moguće kreirati.'))

      return false
    } finally {
      setIsCreatingService(false)
    }
  }

  function startEditingService(service) {
    if (!canManageServices) {
      return
    }

    setEditingService(service)
    setIsFormOpen(true)
    setFormFocusRequest(value => value + 1)
  }

  async function updateService(updatedService) {
    if (!canManageServices) {
      return false
    }

    if (!salonId) {
      window.alert(serviceError(language, 'Podaci salona nisu učitani. Pokušajte ponovno.'))

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

      window.alert(serviceError(language, error || 'Uslugu trenutno nije moguće urediti.'))

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
    if (!canManageServices) {
      return
    }

    if (!salonId) {
      window.alert(serviceError(language, 'Podaci salona nisu učitani. Pokušajte ponovno.'))

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

      window.alert(serviceError(language, error || 'Status usluge trenutno nije moguće promijeniti.'))
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
          <span className="services-eyebrow">{f("Katalog ponude")} </span>

          <h1>{f("Usluge")}</h1>

          <p>
            {canManageServices
              ? f('Upravljajte cijenama, zadanim trajanjem i dostupnošću usluga salona.')
              : f('Pregled usluga salona, njihovih cijena i zadanog trajanja.')}
          </p>
        </div>

        {canManageServices && (
          <button
            type="button"
            className="services-add-button"
            onClick={() => {
              setEditingService(null)
              setIsFormOpen(true)
              setFormFocusRequest(value => value + 1)
            }}
          >{f("+ Nova usluga")} </button>
        )}
      </div>

      {canManageServices && (
        <div className="services-import-entry">
          <button type="button" className="service-action-button"
            onClick={() => setIsImportOpen(true)} disabled={isImportOpen}>{f("Pripremi uvoz cjenika")} </button>
        </div>
      )}
      {canManageServices && isImportOpen && (
        <ServiceImport key={`${userId}:${salonId}`} userId={userId} salonId={salonId}
          onImported={refreshImportedServices} onClose={() => setIsImportOpen(false)} />
      )}

      {canManageServices && isFormOpen && (
        <ServiceForm
          businessType={businessType}
          onAddService={addService}
          onUpdateService={updateService}
          onCancel={cancelServiceForm}
          editingService={editingService}
          focusRequest={formFocusRequest}
          isCreating={isCreatingService}
          isUpdating={isUpdatingService}
        />
      )}

      <div className="services-summary">
        <div className="services-summary-item">
          <span>{f("Ukupno")}</span>
          <strong>
            {serviceList.length}
          </strong>
        </div>

        <div className="services-summary-item">
          <span>{f("Aktivne")}</span>
          <strong>
            {activeServicesCount}
          </strong>
        </div>

        <div className="services-summary-item">
          <span>{f("Neaktivne")}</span>
          <strong>
            {inactiveServicesCount}
          </strong>
        </div>
      </div>

      <div className="services-toolbar">
        <div className="services-search">
          <label htmlFor="services-search">{f("Pretraži usluge")} </label>

          <input
            id="services-search"
            type="search"
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(
                event.target.value
              )
            }
            placeholder={f("Upišite naziv usluge...")}
          />
        </div>

        <div className="services-filter">
          <label htmlFor="services-category-filter">{f("Kategorija")} </label>

          <select
            id="services-category-filter"
            value={selectedCategory}
            onChange={(event) =>
              setSelectedCategory(
                event.target.value
              )
            }
          >
            <option value="all">{f("Sve kategorije")} </option>

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
          <label htmlFor="services-status-filter">{f("Status")} </label>

          <select
            id="services-status-filter"
            value={selectedStatus}
            onChange={(event) =>
              setSelectedStatus(
                event.target.value
              )
            }
          >
            <option value="all">{f("Sve")} </option>

            <option value="active">{f("Aktivne")} </option>

            <option value="inactive">{f("Neaktivne")} </option>
          </select>
        </div>
      </div>

      {serviceList.length === 0 ? (
        <div className="services-empty-state">
          <span className="services-empty-icon">
            ✂️
          </span>

          <h2>{f("Nema dodanih usluga")}</h2>

          <p>
            {canManageServices
              ? f('Dodajte prvu uslugu kako biste mogli povezati cijene i trajanje s terminima.')
              : f('Usluge salona još nisu dostupne. Obratite se administratoru salona.')}
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
                    <span className="service-card-label">{f("Usluga")} </span>

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
                      ? f('Aktivna')
                      : f('Neaktivna')}
                  </span>
                </div>

                <div className="service-card-details">
                  <div className="service-card-detail">
                    <span>{f("Cijena")}</span>

                    <strong>
                      {servicePrice(language,service.price)}
                    </strong>
                  </div>

                  <div className="service-card-detail">
                    <span>{f("Zadano trajanje")} </span>

                    <strong>
                      {formatDuration(
                        service.defaultDurationMinutes, language
                      )}
                    </strong>
                  </div>
                </div>

                {canManageServices && (
                  <div className="service-card-actions">
                    <button
                      type="button"
                      className="service-action-button"
                      onClick={() => startEditingService(service)}
                    >{f("Uredi")} </button>

                    <button
                      type="button"
                      className="service-action-button"
                      onClick={() => toggleServiceActive(service.id)}
                      disabled={updatingServiceActiveId !== null}
                    >
                      {updatingServiceActiveId === service.id
                        ? f('Spremanje...')
                        : service.active
                          ? f('Deaktiviraj')
                          : f('Aktiviraj')}
                    </button>
                  </div>
                )}
              </article>
            )
          )}
        </div>
      )}
    </div>
  )
}

export default Services
