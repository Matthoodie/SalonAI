import pool from './pool.js'

export async function checkDatabaseConnection() {
  const result = await pool.query(
    'SELECT NOW() AS database_time'
  )

  return result.rows[0]
}