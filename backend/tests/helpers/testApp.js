import {
  createApp,
} from '../../src/createApp.js'

import pool from '../../src/database/pool.js'

async function attachLegacyTestSalonContext(
  req,
  res,
  next
) {
  try {
    const rawSalonId =
      req.headers['x-test-salon-id'] ??
      req.query?.salon_id ??
      req.query?.salonId ??
      req.body?.salon_id

    if (rawSalonId !== undefined) {
      req.currentSalon = {
        id: Number(rawSalonId),
      }

      return next()
    }

    const result = await pool.query(
      `
        SELECT id
        FROM salons
        WHERE name = 'SalonAI Demo Salon'
        ORDER BY id
        LIMIT 1
      `
    )

    if (result.rows[0]) {
      req.currentSalon = {
        id: Number(result.rows[0].id),
      }
    }

    return next()
  } catch (error) {
    return next(error)
  }
}

const app =
  createApp({
    privateRouteMiddleware: [
      attachLegacyTestSalonContext,
    ],
  })

export default app