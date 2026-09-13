import {
  createService,
  getServicesForSalon,
  updateService,
  updateServiceActive,
} from '../services/serviceService.js'

export async function getServices(
  req,
  res,
  next
) {
  try {
    const salonId = Number(
      req.query.salon_id
    )

    if (
      !Number.isSafeInteger(salonId) ||
      salonId <= 0
    ) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'salon_id must be a positive integer.',
        },
      })
    }

    const services =
      await getServicesForSalon(salonId)

    res.status(200).json({
      data: services,
    })
  } catch (error) {
    next(error)
  }
}

export async function createServiceController(
  req,
  res,
  next
) {
  try {
    const {
      salon_id,
      name,
      category,
      price_cents,
      default_duration_minutes,
    } = req.body

    const salonId = Number(salon_id)
    const priceCents = Number(price_cents)
    const defaultDurationMinutes =
      Number(default_duration_minutes)

    if (
      !Number.isSafeInteger(salonId) ||
      salonId <= 0
    ) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'salon_id must be a positive integer.',
        },
      })
    }

    if (
      typeof name !== 'string' ||
      !name.trim()
    ) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'name must be a non-empty string.',
        },
      })
    }

    if (
      typeof category !== 'string' ||
      !category.trim()
    ) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'category must be a non-empty string.',
        },
      })
    }

    if (
      !Number.isSafeInteger(priceCents) ||
      priceCents < 0
    ) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'price_cents must be a non-negative integer.',
        },
      })
    }

    if (
      !Number.isSafeInteger(
        defaultDurationMinutes
      ) ||
      defaultDurationMinutes <= 0
    ) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'default_duration_minutes must be a positive integer.',
        },
      })
    }

    const service =
      await createService({
        salonId,
        name: name.trim(),
        category: category.trim(),
        priceCents,
        defaultDurationMinutes,
      })

    res.status(201).json({
      data: service,
    })
  } catch (error) {
    next(error)
  }
}

export async function updateServiceController(
  req,
  res,
  next
) {
  try {
    const serviceId = Number(req.params.id)

    const {
      salon_id,
      name,
      category,
      price_cents,
      default_duration_minutes,
    } = req.body

    const salonId = Number(salon_id)
    const priceCents = Number(price_cents)
    const defaultDurationMinutes =
      Number(default_duration_minutes)

    if (
      !Number.isSafeInteger(serviceId) ||
      serviceId <= 0
    ) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'service id must be a positive integer.',
        },
      })
    }

    if (
      !Number.isSafeInteger(salonId) ||
      salonId <= 0
    ) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'salon_id must be a positive integer.',
        },
      })
    }

    if (
      typeof name !== 'string' ||
      !name.trim()
    ) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'name must be a non-empty string.',
        },
      })
    }

    if (
      typeof category !== 'string' ||
      !category.trim()
    ) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'category must be a non-empty string.',
        },
      })
    }

    if (
      !Number.isSafeInteger(priceCents) ||
      priceCents < 0
    ) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'price_cents must be a non-negative integer.',
        },
      })
    }

    if (
      !Number.isSafeInteger(
        defaultDurationMinutes
      ) ||
      defaultDurationMinutes <= 0
    ) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'default_duration_minutes must be a positive integer.',
        },
      })
    }

    const result =
      await updateService({
        serviceId,
        salonId,
        name: name.trim(),
        category: category.trim(),
        priceCents,
        defaultDurationMinutes,
      })

    if (result.error) {
      return res
        .status(result.error.status)
        .json({
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        })
    }

    res.status(200).json({
      data: result.data,
    })
  } catch (error) {
    next(error)
  }
}

export async function updateServiceActiveController(
  req,
  res,
  next
) {
  try {
    const serviceId = Number(req.params.id)

    const {
      salon_id,
      active,
    } = req.body

    const salonId = Number(salon_id)

    if (
      !Number.isSafeInteger(serviceId) ||
      serviceId <= 0
    ) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'service id must be a positive integer.',
        },
      })
    }

    if (
      !Number.isSafeInteger(salonId) ||
      salonId <= 0
    ) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'salon_id must be a positive integer.',
        },
      })
    }

    if (typeof active !== 'boolean') {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'active must be a boolean.',
        },
      })
    }

    const result =
      await updateServiceActive({
        serviceId,
        salonId,
        active,
      })

    if (result.error) {
      return res
        .status(result.error.status)
        .json({
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        })
    }

    res.status(200).json({
      data: result.data,
    })
  } catch (error) {
    next(error)
  }
}