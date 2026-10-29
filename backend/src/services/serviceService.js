import { withServiceCatalogTransaction } from './serviceCatalogTransaction.js'
import {
  findServicesBySalonId,
  insertService,
  updateServiceActiveById,
  updateServiceById,
} from '../repositories/serviceRepository.js'

export async function getServicesForSalon(
  salonId
) {
  return findServicesBySalonId(salonId)
}

export async function createService({
  salonId,
  name,
  category,
  priceCents,
  defaultDurationMinutes,
}) {
  return withServiceCatalogTransaction(salonId, db => insertService({
    salonId,
    name,
    category,
    priceCents,
    defaultDurationMinutes,
  }, db))
}

export async function updateService({
  serviceId,
  salonId,
  name,
  category,
  priceCents,
  defaultDurationMinutes,
}) {
  const updatedService =
    await withServiceCatalogTransaction(salonId, db => updateServiceById({
      serviceId,
      salonId,
      name,
      category,
      priceCents,
      defaultDurationMinutes,
    }, db))

  if (!updatedService) {
    return {
      error: {
        status: 404,
        code: 'SERVICE_NOT_FOUND',
        message: 'Service was not found.',
      },
    }
  }

  return {
    data: updatedService,
  }
}

export async function updateServiceActive({
  serviceId,
  salonId,
  active,
}) {
  const updatedService =
    await withServiceCatalogTransaction(salonId, db => updateServiceActiveById({
      serviceId,
      salonId,
      active,
    }, db))

  if (!updatedService) {
    return {
      error: {
        status: 404,
        code: 'SERVICE_NOT_FOUND',
        message: 'Service was not found.',
      },
    }
  }

  return {
    data: updatedService,
  }
}
