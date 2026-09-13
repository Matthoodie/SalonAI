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
  return insertService({
    salonId,
    name,
    category,
    priceCents,
    defaultDurationMinutes,
  })
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
    await updateServiceById({
      serviceId,
      salonId,
      name,
      category,
      priceCents,
      defaultDurationMinutes,
    })

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
    await updateServiceActiveById({
      serviceId,
      salonId,
      active,
    })

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