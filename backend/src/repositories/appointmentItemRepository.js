import pool from '../database/pool.js'

export const appointmentItemsSql = `(SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'service_id', ai.service_id, 'position', ai.position,
  'name', ai.service_name, 'category', ai.service_category,
  'price_cents', ai.price_cents, 'duration_minutes', ai.duration_minutes
) ORDER BY ai.position), '[]'::jsonb)
FROM appointment_items ai WHERE ai.appointment_id = a.id AND ai.salon_id = a.salon_id)`

export async function findAppointmentItems(appointmentId, salonId, db = pool) {
  const result = await db.query(`
    SELECT service_id, position, service_name AS name, service_category AS category,
           price_cents, duration_minutes
    FROM appointment_items WHERE appointment_id = $1 AND salon_id = $2
    ORDER BY position
  `, [appointmentId, salonId])
  return result.rows
}

// Caller owns the transaction and employee schedule lock.
export async function replaceAppointmentItems(db, appointment, items) {
  await db.query('DELETE FROM appointment_items WHERE appointment_id = $1 AND salon_id = $2',
    [appointment.id, appointment.salon_id])
  for (const [index, item] of items.entries()) {
    await db.query(`
      INSERT INTO appointment_items (
        appointment_id, salon_id, employee_id, service_id, position,
        service_name, service_category, price_cents, duration_minutes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `, [appointment.id, appointment.salon_id, appointment.employee_id, item.service_id,
      index + 1, item.name, item.category, item.price_cents, item.duration_minutes])
  }
}
