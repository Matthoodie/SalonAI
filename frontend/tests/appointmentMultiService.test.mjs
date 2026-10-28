import test from 'node:test'
import assert from 'node:assert/strict'
import { serviceIds, appointmentItems, serviceSummary, draftItems, sumItems, employeeSupportsServices, canChangeAppointmentServices, sameServiceSelection } from '../src/api/appointmentItemsView.js'
import { mapCalendarAppointmentToFrontend, mapAppointmentRowsToFrontend } from '../src/api/appointmentMapper.js'
import { createAppointmentServicesApi } from '../src/api/appointmentServicesApi.js'
import { createAppointment } from '../src/api/appointmentApi.js'
import { createSalonApiContext, setActiveSalonForRequests } from '../src/api/salonApiContext.js'
import { isEmployeeAvailable } from '../src/utils/availability.js'
import { summarizeAppointments } from '../src/pages/Dashboard/dashboardView.js'
const items = [
  { service_id: '1', position: 1, name: 'Šišanje', category: 'Kosa', price_cents: 1800, duration_minutes: 20 },
  { service_id: '2', position: 2, name: 'Feniranje', category: 'Kosa', price_cents: 1800, duration_minutes: 30 },
]
const row = (extra = {}) => ({
  id: '90', employee_id: '7', client_id: '8', salon_id: '10', service_id: '1',
  starts_at: '2030-01-09T09:00:00.000Z', ends_at: '2030-01-09T09:50:00.000Z',
  price_cents: 3600, duration_minutes: 50, status: 'confirmed', items,
  client: { id: '8', name: 'Klijent' }, employee: { id: '7', name: 'Ana' },
  service: { id: '1', name: 'Promijenjen naziv', category: 'Novo', default_duration_minutes: 90 },
  ...extra,
})
const catalog = [
  { id: 1, name: 'Novo šišanje', category: 'Kosa', active: true, priceCents: 9000, defaultDurationMinutes: 90 },
  { id: 2, name: 'Feniranje', category: 'Kosa', active: true, priceCents: 2000, defaultDurationMinutes: 35 },
  { id: 3, name: 'Dodatak', category: 'Kosa', active: true, priceCents: 500, defaultDurationMinutes: 10 },
]
const response = (data, status = 200) => ({ ok: status < 400, status, async json() { return { data } } })
const available = () => ({
  employeeId: 7, serviceIds: [1, 2], serviceId: 1, date: '2030-01-09',
  timezone: 'Europe/Zagreb', durationMinutes: 50, slotIntervalMinutes: 15, availableSlots: ['08:00','08:15'],
})
const query = { employeeId: 7, ids: [1, 2], date: '2030-01-09', timezone: 'Europe/Zagreb' }
const auth = (role = 'owner', permission = 'all') => ({
  authenticated: true, membership: { role, active: true, employee_id: 7 },
  permissions: { 'appointment.reschedule': permission },
})
test('multi UI: selection normalizes IDs and preserves order', () => {
  assert.deepEqual(serviceIds(['2', 1]), [2, 1])
  assert.equal(sameServiceSelection([1, 2], ['1', '2']), true)
  assert.equal(sameServiceSelection([1, 2], [2, 1]), false)
})
test('multi UI: duplicates invalid IDs and selection limits are rejected', () => {
  for (const value of [[], [1,'1'], [0], [-1], [true], [1.5], ['1e2'], ['01'], Array.from({ length: 21 }, (_, i) => i + 1)]) assert.throws(() => serviceIds(value))
  assert.equal(serviceIds(Array.from({ length: 20 }, (_, i) => i + 1)).length, 20)
})
test('multi UI: new selection totals use each service once', () => {
  assert.deepEqual(sumItems(draftItems([2, 3], catalog)), { priceCents: 2500, durationMinutes: 45 })
})
test('multi UI: equal service names remain distinct by ID', () => {
  const result = draftItems([1, 2], catalog.map(item => ({ ...item, name: 'Isti naziv' })))
  assert.deepEqual(result.map(item => item.service_id), [1, 2])
})
test('multi UI: retained snapshots preserve names prices and durations', () => {
  const result = draftItems([1, 3], catalog, items)
  assert.equal(result[0].name, 'Šišanje')
  assert.deepEqual(sumItems(result), { priceCents: 2300, durationMinutes: 30 })
})
test('multi UI: removal to one item preserves original duration', () => {
  assert.deepEqual(sumItems(draftItems([2], catalog, items)), { priceCents: 1800, durationMinutes: 30 })
})
test('multi UI: inactive unknown and zero-duration services cannot be submitted', () => {
  assert.throws(() => draftItems([99], catalog))
  assert.throws(() => draftItems([1], [{ ...catalog[0], active: false }], items))
  assert.throws(() => draftItems([1], [{ ...catalog[0], defaultDurationMinutes: 0 }]))
  assert.throws(() => draftItems([1], [{ ...catalog[0], priceCents: null }]))
})
test('multi UI: sums reject PostgreSQL integer overflow', () => {
  assert.throws(() => sumItems([{ price_cents: 2147483647, duration_minutes: 20 }, { price_cents: 1, duration_minutes: 20 }]))
})
test('multi UI: employee must provide every service regardless of ID string type', () => {
  assert.equal(employeeSupportsServices({ active: true, serviceIds: ['1', 2] }, [1, '2']), true)
  assert.equal(employeeSupportsServices({ active: true, serviceIds: [1] }, [1, 2]), false)
  assert.equal(employeeSupportsServices({ active: false, serviceIds: [1, 2] }, [1, 2]), false)
  assert.equal(employeeSupportsServices({ active: true, serviceIds: [1] }, []), false)
})
test('multi UI: owner admin permission and active appointment are all required', () => {
  const appointment = { employeeId: 7, statusCode: 'confirmed' }
  assert.equal(canChangeAppointmentServices(auth(), appointment), true)
  assert.equal(canChangeAppointmentServices(auth('admin'), appointment), true)
  for (const denied of [auth('employee','self'), auth('employee','all'), auth('owner','deny'), { ...auth(), authenticated: false }]) assert.equal(canChangeAppointmentServices(denied, appointment), false)
  for (const statusCode of ['completed', 'cancelled', 'no_show']) assert.equal(canChangeAppointmentServices(auth(), { ...appointment, statusCode }), false)
  assert.equal(canChangeAppointmentServices(auth('admin','self'), { ...appointment, employeeId: 9 }), false)
})
test('multi mapper: calendar uses snapshot names and aggregate duration', () => {
  const mapped = mapCalendarAppointmentToFrontend(row(), 'Europe/Zagreb')
  assert.equal(mapped.serviceName, 'Šišanje + Feniranje')
  assert.equal(mapped.time, '10:00')
  assert.equal(mapped.serviceDurationMinutes, 50)
  assert.equal(mapped.priceCents, 3600)
  assert.deepEqual(mapped.serviceIds, [1, 2])
})
test('multi mapper: list response is one reservation without multiplying statistics', () => {
  const mapped = mapAppointmentRowsToFrontend([row({ status: 'completed' })], 'Europe/Zagreb', [], [], catalog)
  assert.equal(mapped.length, 1)
  const summary = summarizeAppointments(mapped, { from: '2030-01-09', to: '2030-01-09' }, 'Europe/Zagreb')
  assert.equal(summary.total, 1)
  assert.equal(summary.valueCents, 3600)
})
test('multi mapper: legacy single appointment falls back to saved parent totals', () => {
  const mapped = mapCalendarAppointmentToFrontend(row({ items: undefined }), 'Europe/Zagreb')
  assert.equal(mapped.items.length, 1)
  assert.equal(mapped.items[0].duration_minutes, 50)
  assert.equal(mapped.serviceDurationMinutes, 50)
})
test('multi mapper: empty duplicate malformed or mismatched items fail closed', () => {
  for (const extra of [
    { items: [] }, { items: [...items, items[0]] }, { price_cents: 3700 },
    { duration_minutes: 51 }, { items: [{ ...items[0], position: 0 }, items[1]] },
    { items: [{ ...items[0], price_cents: null }, items[1]] },
    { items: [{ ...items[0], duration_minutes: 0 }, items[1]] },
  ]) assert.throws(() => serviceSummary(row(extra)))
})
test('multi mapper: stored position controls displayed order', () => {
  assert.deepEqual(appointmentItems(row({ items: [...items].reverse() })).map(item => item.name), ['Šišanje', 'Feniranje'])
})
test('multi availability: saved aggregate blocks collision in the second service', () => {
  const options = { employeeId: 7, date: '2030-01-09', startTime: '10:30', durationMinutes: 10,
    workingHours: { wednesday: { enabled: true, startTime: '08:00', endTime: '18:00' } },
    appointments: [{ id: 90, employeeId: 7, date: '2030-01-09', time: '10:00', statusCode: 'confirmed', status: 'Zakazano', durationMinutes: 50, serviceDurationMinutes: 20 }],
  }
  assert.equal(isEmployeeAvailable(options), false)
  assert.equal(isEmployeeAvailable({ ...options, startTime: '10:50' }), true)
  assert.equal(isEmployeeAvailable({ ...options, excludeAppointmentId: 90 }), true)
})
test('multi API: availability sends ordered service IDs quarter-hour interval and abort signal', async () => {
  const controller = new AbortController()
  const api = createAppointmentServicesApi({ request: async (path, options) => {
    const params = new URL(path, 'http://localhost').searchParams
    assert.equal(params.get('serviceIds'), '1,2')
    assert.equal(params.has('serviceId'), false)
    assert.equal(params.get('slotIntervalMinutes'), '15')
    assert.equal(options.signal, controller.signal)
    return response(available())
  } })
  assert.deepEqual((await api.availability({ ...query, signal: controller.signal })).availableSlots, ['08:00','08:15'])
})
test('multi API: mismatched availability identity date zone duration and slots are rejected', async () => {
  for (const extra of [{ employeeId: 8 }, { date: '2030-01-10' }, { timezone: 'UTC' }, { serviceIds: [2, 1] }, { durationMinutes: 0 }, { availableSlots: ['25:00'] }, { slotIntervalMinutes: 30 }]) {
    const api = createAppointmentServicesApi({ request: async () => response({ ...available(), ...extra }) })
    await assert.rejects(api.availability(query))
  }
})
test('multi API: empty free slots are valid', async () => {
  const api = createAppointmentServicesApi({ request: async () => response({ ...available(), availableSlots: [] }) })
  assert.deepEqual((await api.availability(query)).availableSlots, [])
})
test('multi API: composition mutation sends only service_ids', async () => {
  const api = createAppointmentServicesApi({ request: async (path, options) => {
    assert.equal(path, '/api/appointments/90/services')
    assert.equal(options.method, 'PATCH')
    assert.deepEqual(JSON.parse(options.body), { service_ids: [1, 2] })
    return response(row())
  } })
  assert.equal((await api.change(90, ['1', 2])).id, '90')
})
test('multi API: invalid selections never send requests', async () => {
  let calls = 0
  const api = createAppointmentServicesApi({ request: async () => { calls++; return response(row()) } })
  await assert.rejects(api.change(90, [1, 1]))
  await assert.rejects(api.change(-1, [1]))
  await assert.rejects(api.availability({ ...query, ids: [] }))
  assert.equal(calls, 0)
})
test('multi API: conflict retains HTTP status and error code', async () => {
  const api = createAppointmentServicesApi({ request: async () => ({
    ok: false, status: 409, json: async () => ({ error: { code: 'APPOINTMENT_CONFLICT', message: 'Conflict' } }),
  }) })
  await assert.rejects(api.change(90, [1, 2]), { code: 'APPOINTMENT_CONFLICT', status: 409 })
})
test('multi API: uncertain mutation is never automatically retried', async () => {
  let calls = 0
  const api = createAppointmentServicesApi({ request: async () => { calls++; throw new TypeError('Disconnected') } })
  await assert.rejects(api.change(90, [1, 2]))
  assert.equal(calls, 1)
})
test('multi API: wrong response identity or composition is rejected', async () => {
  const wrongId = createAppointmentServicesApi({ request: async () => response(row({ id: 91 })) })
  await assert.rejects(wrongId.change(90, [1, 2]))
  const wrongSelection = createAppointmentServicesApi({ request: async () => response(row()) })
  await assert.rejects(wrongSelection.change(90, [2, 1]))
})
test('multi API: changing salon discards a late availability response', async () => {
  let release
  const transport = createSalonApiContext({ fetchImpl: () => new Promise(resolve => { release = resolve }) })
  transport.setSalon(10)
  const api = createAppointmentServicesApi({ request: transport.request })
  const pending = api.availability(query)
  transport.setSalon(20)
  release({ ok: true, status: 200, text: async () => JSON.stringify({ data: available() }) })
  await assert.rejects(pending, { code: 'STALE_SALON_CONTEXT' })
})
test('multi API: changing salon while reading mutation body rejects response', async () => {
  let releaseBody
  const transport = createSalonApiContext({ fetchImpl: async () => ({
    ok: true, status: 200, text: () => new Promise(resolve => { releaseBody = resolve }),
  }) })
  transport.setSalon(10)
  const api = createAppointmentServicesApi({ request: transport.request })
  const pending = api.change(90, [1, 2])
  await new Promise(resolve => setImmediate(resolve))
  transport.setSalon(20)
  releaseBody(JSON.stringify({ data: row() }))
  await assert.rejects(pending, { code: 'STALE_SALON_CONTEXT' })
})
test('multi API: create sends service_ids and never submits preview totals', async () => {
  const original = globalThis.fetch
  setActiveSalonForRequests(10)
  globalThis.fetch = async (path, options) => {
    const body = JSON.parse(options.body)
    assert.equal(path, '/api/appointments')
    assert.deepEqual(body.service_ids, [1, 2])
    assert.equal(body.service_id, undefined)
    assert.equal(body.duration_minutes, undefined)
    assert.equal(body.price_cents, undefined)
    assert.equal(options.headers.get('X-Salon-Id'), '10')
    return { ok: true, status: 201, text: async () => JSON.stringify({ data: row() }) }
  }
  try {
    await createAppointment({ clientId: 8, employeeId: 7, serviceIds: [1, 2], startsAt: row().starts_at, price_cents: 1, duration_minutes: 1 })
  } finally { globalThis.fetch = original; setActiveSalonForRequests(null) }
})
