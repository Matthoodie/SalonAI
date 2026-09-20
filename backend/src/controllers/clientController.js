import {
  getClientsForSalon,
  createClientForSalon,
  updateClientForSalon,
} from '../services/clientService.js'

export async function getClients(req, res, next) {
  try {
    const salonId = Number(req.query.salon_id)

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
      salonId: req.body?.salon_id,
      name: req.body?.name,
      phoneCountryCode: req.body?.phone_country_code,
      phoneNumber: req.body?.phone_number,
      phoneNormalized: req.body?.phone_normalized,
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
      salonId: req.body?.salon_id,
      name: req.body?.name,
      phoneCountryCode: req.body?.phone_country_code,
      phoneNumber: req.body?.phone_number,
      phoneNormalized: req.body?.phone_normalized,
    })

    return res.status(200).json({
      data: client,
    })
  } catch (error) {
    next(error)
  }
}