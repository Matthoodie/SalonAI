import pool from '../database/pool.js'

export async function withAppointmentTransaction(operation) {
  const db = await pool.connect()
  let transactionOpen = false
  let releaseError

  try {
    await db.query('BEGIN')
    transactionOpen = true

    const result = await operation(db)

    if (result?.error) {
      await db.query('ROLLBACK')
    } else {
      await db.query('COMMIT')
    }

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
