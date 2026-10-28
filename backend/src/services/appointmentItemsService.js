import pool from '../database/pool.js'
import { parseAppointmentServiceIds, sumAppointmentServices } from '../utils/appointmentServices.js'

export async function resolveAppointmentItems(input, db = pool, previous = []) {
  const parsed = parseAppointmentServiceIds(input)
  if (parsed.error) return parsed
  const ids = parsed.data
  const result = await db.query(`
    SELECT id, salon_id, name, category, price_cents, default_duration_minutes, active
    FROM services WHERE id = ANY($1::bigint[]) ORDER BY id
  `, [ids])
  const fail = (code, message, status = 400) => ({ error: { status, code, message } })
  const items = []
  for (const id of ids) {
    const service = result.rows.find((row) => Number(row.id) === id)
    if (!service) return fail('SERVICE_NOT_FOUND', 'Service was not found.', 404)
    if (Number(service.salon_id) !== Number(input.salon_id)) {
      return fail('SERVICE_SALON_MISMATCH', 'Service does not belong to the selected salon.')
    }
    if (!service.active) return fail('SERVICE_INACTIVE', 'Service is not active.')
    const old = previous.find((item) => Number(item.service_id) === id)
    items.push(old ? { ...old, service_id: id } : {
      service_id: id, name: service.name, category: service.category,
      price_cents: Number(service.price_cents),
      duration_minutes: Number(service.default_duration_minutes),
    })
  }
  const qualification = await db.query(`
    SELECT service_id FROM employee_services
    WHERE employee_id = $1 AND salon_id = $2 AND service_id = ANY($3::bigint[])
  `, [input.employee_id, input.salon_id, ids])
  if (qualification.rows.length !== ids.length) {
    return fail('EMPLOYEE_NOT_QUALIFIED', 'Employee is not qualified for the selected service.')
  }
  const total = sumAppointmentServices(items)
  if (total.error) return total
  return { data: { items, ...total.data } }
}
