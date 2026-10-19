import pool from '../database/pool.js'

import {
  createClientForSalon,
} from './clientService.js'

import {
  prepareAppointmentCreation,
} from './appointmentService.js'

export async function createAppointmentBooking({
  newClient,
  ...appointmentInput
}) {
  if (newClient === undefined) {
    return prepareAppointmentCreation(appointmentInput)
  }

  const db = await pool.connect()
  let transactionOpen = false
  let releaseError

  try {
    await db.query('BEGIN')
    transactionOpen = true

    const client = await createClientForSalon(
      {
        salonId: appointmentInput.salon_id,
        name: newClient.name,
        isOccasional: newClient.is_occasional,
        phoneCountryCode: newClient.phone_country_code,
        phoneNumber: newClient.phone_number,
        phoneNormalized: newClient.phone_normalized,
      },
      db
    )

    const result = await prepareAppointmentCreation(
      {
        ...appointmentInput,
        client_id: Number(client.id),
      },
      db
    )

    if (result.error) {
      await db.query('ROLLBACK')
      transactionOpen = false
      return result
    }

    await db.query('COMMIT')
    transactionOpen = false

    return result
  } catch (error) {
    if (transactionOpen) {
      try {
        await db.query('ROLLBACK')
      } catch (rollbackError) {
        releaseError = rollbackError
      }
    }

    throw error
  } finally {
    db.release(releaseError)
  }
}