export const MAX_APPOINTMENT_SERVICES = 20

export function parseAppointmentServiceIds({ service_id, service_ids }) {
  const fail = (message) => ({ error: { status: 400, code: 'VALIDATION_ERROR', message } })
  if (service_id !== undefined && service_ids !== undefined) {
    return fail('Provide either service_id or service_ids, but not both.')
  }
  const values = service_ids === undefined ? [service_id] : service_ids
  if (!Array.isArray(values) || values.length < 1 || values.length > MAX_APPOINTMENT_SERVICES) {
    return fail(`Select between 1 and ${MAX_APPOINTMENT_SERVICES} services.`)
  }
  if (values.some((value) =>
    !['number', 'string'].includes(typeof value) ||
    (typeof value === 'string' && !/^[1-9]\d*$/.test(value)) ||
    !Number.isSafeInteger(Number(value)) || Number(value) <= 0
  )) return fail(service_ids === undefined ? 'service_id must be a positive integer.' : 'service_ids must contain positive integer IDs.')
  const ids = values.map(Number)
  if (new Set(ids).size !== ids.length) return fail('Duplicate services are not allowed.')
  return { data: ids }
}

export function sumAppointmentServices(items) {
  let priceCents = 0
  let durationMinutes = 0
  for (const item of items) {
    const price = Number(item.price_cents)
    const duration = Number(item.duration_minutes)
    if (!Number.isSafeInteger(price) || price < 0 ||
        !Number.isSafeInteger(duration) || duration <= 0) {
      throw new Error('Invalid appointment service snapshot.')
    }
    priceCents += price
    durationMinutes += duration
  }
  if (priceCents > 2147483647 || durationMinutes > 2147483647) {
    return { error: { status: 400, code: 'APPOINTMENT_TOTAL_TOO_LARGE', message: 'Combined price or duration is too large.' } }
  }
  return { data: { price_cents: priceCents, duration_minutes: durationMinutes } }
}
