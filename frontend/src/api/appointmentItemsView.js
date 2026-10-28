import { canUseAppointmentPermission } from './appointmentPermissions.js'

export const MAX_APPOINTMENT_SERVICES = 20

export function serviceIds(value) {
  if (!Array.isArray(value) || !value.length || value.length > MAX_APPOINTMENT_SERVICES) {
    throw new Error('Odaberite od 1 do 20 različitih usluga.')
  }
  const ids = value.map(id => {
    if (!['string', 'number'].includes(typeof id) || !/^[1-9]\d*$/.test(String(id)) ||
        !Number.isSafeInteger(Number(id))) throw new Error('Odabir usluge nije valjan.')
    return Number(id)
  })
  if (new Set(ids).size !== ids.length) throw new Error('Ista usluga ne može biti odabrana dvaput.')
  return ids
}

export function appointmentItems(row) {
  const raw = row.items
  const items = raw == null ? [{
    service_id: row.service_id ?? row.service?.id ?? row.serviceId,
    position: 1,
    name: row.service?.name ?? row.serviceName ?? 'Nepoznata usluga',
    category: row.service?.category ?? row.serviceCategory ?? 'Ostalo',
    price_cents: row.price_cents ?? row.priceCents,
    duration_minutes: row.duration_minutes ?? row.durationMinutes ?? row.serviceDurationMinutes,
  }] : raw
  if (!Array.isArray(items)) throw new Error('Stavke termina nisu ispravne.')
  serviceIds(items.map(item => item.service_id))
  const sorted = [...items].sort((a, b) => Number(a.position) - Number(b.position))
  for (const [index, item] of sorted.entries()) {
    if (Number(item.position) !== index + 1 || typeof item.name !== 'string' || !item.name.trim() ||
        item.price_cents == null || !Number.isSafeInteger(Number(item.price_cents)) || Number(item.price_cents) < 0 ||
        item.duration_minutes == null || !Number.isSafeInteger(Number(item.duration_minutes)) || Number(item.duration_minutes) < 1) {
      throw new Error('Stavke termina nisu ispravne.')
    }
  }
  return sorted.map(item => ({
    service_id: Number(item.service_id), position: Number(item.position), name: item.name,
    category: item.category || 'Ostalo', price_cents: Number(item.price_cents),
    duration_minutes: Number(item.duration_minutes),
  }))
}

export function serviceSummary(row) {
  const items = appointmentItems(row)
  if ((row.duration_minutes ?? row.durationMinutes) == null || (row.price_cents ?? row.priceCents) == null) throw new Error('Nedostaju ukupni podaci termina.')
  const durationMinutes = Number(row.duration_minutes ?? row.durationMinutes)
  const priceCents = Number(row.price_cents ?? row.priceCents)
  const firstId = row.service_id ?? row.service?.id ?? row.serviceId
  if (firstId != null && String(firstId) !== String(items[0].service_id)) throw new Error('Glavna usluga ne odgovara stavkama termina.')
  const totals = sumItems(items)
  if (totals.durationMinutes !== durationMinutes || totals.priceCents !== priceCents) {
    throw new Error('Ukupna cijena ili trajanje ne odgovaraju stavkama termina.')
  }
  return {
    items, serviceIds: items.map(item => item.service_id),
    serviceId: items[0].service_id,
    serviceName: items.map(item => item.name).join(' + '),
    service: items.map(item => item.name).join(' + '),
    serviceCategory: [...new Set(items.map(item => item.category))].join(', '),
    serviceDurationMinutes: durationMinutes, durationMinutes, priceCents,
    servicePrice: priceCents / 100,
  }
}

export function sumItems(items) {
  const totals = items.reduce((result, item) => ({
    durationMinutes: result.durationMinutes + Number(item.duration_minutes),
    priceCents: result.priceCents + Number(item.price_cents),
  }), { durationMinutes: 0, priceCents: 0 })
  if (!Number.isSafeInteger(totals.priceCents) || totals.priceCents < 0 || totals.priceCents > 2147483647 ||
      !Number.isSafeInteger(totals.durationMinutes) || totals.durationMinutes < 0 || totals.durationMinutes > 2147483647) {
    throw new Error('Ukupna cijena ili trajanje nisu valjani.')
  }
  return totals
}

export function draftItems(ids, catalog, previous = []) {
  return serviceIds(ids).map((id, index) => {
    const service = catalog.find(item => String(item.id) === String(id))
    if (!service || service.active !== true) throw new Error('Odabrana usluga više nije aktivna.')
    const saved = previous.find(item => String(item.service_id) === String(id))
    const item = {
      service_id: id, position: index + 1,
      name: saved?.name ?? service.name,
      category: saved?.category ?? service.category ?? 'Ostalo',
      price_cents: Number(saved?.price_cents ?? service.priceCents),
      duration_minutes: Number(saved?.duration_minutes ?? service.defaultDurationMinutes),
    }
    if (typeof item.name !== 'string' || !item.name.trim() ||
        (saved?.price_cents ?? service.priceCents) == null || !Number.isSafeInteger(item.price_cents) || item.price_cents < 0 ||
        !Number.isSafeInteger(item.duration_minutes) || item.duration_minutes < 1) {
      throw new Error('Usluga mora imati ispravnu cijenu i trajanje od najmanje 1 minute.')
    }
    return item
  })
}

export function employeeSupportsServices(employee, ids) {
  return employee?.active !== false && ids.length > 0 &&
    ids.every(id => employee?.serviceIds?.some(value => String(value) === String(id)))
}

export function canChangeAppointmentServices(auth, appointment) {
  return Boolean(appointment) && ['pending', 'confirmed'].includes(appointment.statusCode) &&
    ['owner', 'admin'].includes(auth?.membership?.role) &&
    canUseAppointmentPermission(auth, 'appointment.reschedule', appointment.employeeId)
}

export function sameServiceSelection(first, second) {
  return first.length === second.length && first.every((id, index) => String(id) === String(second[index]))
}

export const formatServicePrice = cents =>
  new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(cents / 100)
