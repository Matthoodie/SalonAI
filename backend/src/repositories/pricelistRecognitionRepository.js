import pool from '../database/pool.js'
import { recognitionError } from '../utils/pricelistRecognition.js'
export async function reservePricelistRecognition(salonId,{salonLimit=20,globalLimit=100,database=pool}={}) {
  const client=await database.connect()
  try {
    await client.query('BEGIN')
    // Shared across processes; this short lock only covers reserving an attempt.
    await client.query('SELECT pg_advisory_xact_lock(1793556000, 1)')
    const result=await client.query(`SELECT COALESCE(SUM(attempts),0)::integer AS total,
      COALESCE(SUM(attempts) FILTER (WHERE salon_id=$1),0)::integer AS salon
      FROM pricelist_recognition_usage WHERE usage_date=(clock_timestamp() AT TIME ZONE 'UTC')::date`,[salonId])
    if(result.rows[0].total>=globalLimit || result.rows[0].salon>=salonLimit)
      throw recognitionError('Dosegnuto je dnevno ograničenje prepoznavanja. Pokušajte sutra ili unesite stavke ručno.',429,'PRICELIST_RECOGNITION_LIMIT')
    await client.query(`INSERT INTO pricelist_recognition_usage (salon_id,usage_date,attempts)
      VALUES ($1,(clock_timestamp() AT TIME ZONE 'UTC')::date,1)
      ON CONFLICT (salon_id,usage_date) DO UPDATE SET attempts=pricelist_recognition_usage.attempts+1`,[salonId])
    await client.query('COMMIT')
  } catch(error) {await client.query('ROLLBACK');throw error}
  finally {client.release()}
}
