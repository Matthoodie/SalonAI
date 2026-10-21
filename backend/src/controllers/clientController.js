import {
  getClientsForSalon,
  createClientForSalon,
  updateClientForSalon,
  updateClientActiveForSalon,
  searchBookingClientsForSalon,
} from '../services/clientService.js'

export async function getClients(req, res, next) {
  try {
const salonId =
  Number(req.currentSalon?.id)

    if (
      !Number.isSafeInteger(salonId) ||
      salonId <= 0
    ) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'salon_id must be a positive integer.',
        },
      })
    }

    const clients = await getClientsForSalon(salonId)

    return res.status(200).json({
      data: clients,
    })
  } catch (error) {
    next(error)
  }
}

export async function createClient(req, res, next) {
  try {
    const client = await createClientForSalon({
      salonId: req.currentSalon?.id,
      name: req.body?.name,
      phoneCountryCode: req.body?.phone_country_code,
      phoneNumber: req.body?.phone_number,
      phoneNormalized: req.body?.phone_normalized,
      isOccasional: req.body?.is_occasional,
    })

    return res.status(201).json({
      data: client,
    })
  } catch (error) {
    next(error)
  }
}

export async function updateClient(req, res, next) {
  try {
     const client = await updateClientForSalon({
      clientId: req.params.id,
      salonId: req.currentSalon?.id,
      name: req.body?.name,
      phoneCountryCode: req.body?.phone_country_code,
      phoneNumber: req.body?.phone_number,
      phoneNormalized: req.body?.phone_normalized,
      isOccasional: req.body?.is_occasional,
    })

    return res.status(200).json({
      data: client,
    })
  } catch (error) {
    next(error)
  }
}

export async function updateClientActive(
  req,
  res,
  next
) {
  try {
const client = await updateClientActiveForSalon({
  clientId: req.params.id,
  salonId: req.currentSalon?.id,
  active: req.body?.active,
})
    return res.status(200).json({
      data: client,
    })
  } catch (error) {
    next(error)
  }
}

export async function searchBookingClients(req, res, next) {
  res.set('Cache-Control', 'no-store')

  try {
    const clients = await searchBookingClientsForSalon({
      salonId: req.currentSalon?.id,
      query: req.query.q,
    })

    return res.status(200).json({
      data: clients,
    })
  } catch (error) {
    next(error)
  }
}