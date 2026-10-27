import test from 'node:test'
import assert from 'node:assert/strict'
import { validDate, salonDate, periodRange, summarizeAppointments, scheduleView, appointmentCount, formatMoney } from '../src/pages/Dashboard/dashboardView.js'
const zone = 'Europe/Zagreb'
const row = (id, startsAt, statusCode = 'confirmed', priceCents = 2500) => ({ id, startsAt, statusCode, priceCents })
test('dashboard: actual calendar dates and leap years', () => {
  assert.equal(validDate('2024-02-29'), true)
  for (const value of ['', '2026-02-29', '2026-04-31', '2026-13-01', '2026-1-02', '0000-01-01', null]) assert.equal(validDate(value), false)
})
test('dashboard: salon date crosses UTC midnight', () => {
  assert.equal(salonDate('2026-01-01T23:30:00Z', zone), '2026-01-02')
  assert.equal(salonDate('2026-01-01T01:30:00Z', 'America/New_York'), '2025-12-31')
})
test('dashboard: timezone cannot silently fall back to browser', () => assert.throws(() => salonDate('2026-01-01T00:00:00Z', undefined)))
test('dashboard: seven and thirty day ranges include today', () => {
  assert.deepEqual(periodRange('last7', '2026-03-02'), { from: '2026-02-24', to: '2026-03-02' })
  assert.deepEqual(periodRange('last30', '2026-03-02'), { from: '2026-02-01', to: '2026-03-02' })
})
test('dashboard: yesterday crosses year boundary', () => assert.deepEqual(periodRange('yesterday', '2026-01-01'), { from: '2025-12-31', to: '2025-12-31' }))
test('dashboard: arbitrary multi-month and single-day intervals', () => {
  assert.deepEqual(periodRange('range', '2026-10-27', '2026-01-10', '2026-05-15'), { from: '2026-01-10', to: '2026-05-15' })
  assert.deepEqual(periodRange('custom', '2026-10-27', '2026-05-15', ''), { from: '2026-05-15', to: '2026-05-15' })
  assert.deepEqual(periodRange('range', '2026-10-27', '2026-05-15', '2026-05-15'), { from: '2026-05-15', to: '2026-05-15' })
})
test('dashboard: invalid or reversed ranges are rejected', () => {
  for (const [from,to] of [['','2026-01-01'],['2026-01-01',''],['2026-05-15','2026-01-10'],['2026-02-30','2026-03-01']]) assert.throws(() => periodRange('range','2026-10-27',from,to))
  assert.throws(() => periodRange('unknown', '2026-10-27'))
})
test('dashboard: both end dates are included by salon start date', () => {
  const rows = [row(1,'2026-01-09T22:59:59Z'),row(2,'2026-01-09T23:00:00Z'),row(3,'2026-05-15T21:59:59Z'),row(4,'2026-05-15T22:00:00Z')]
  assert.equal(summarizeAppointments(rows,{from:'2026-01-10',to:'2026-05-15'},zone).total,2)
})
test('dashboard: DST spring date includes correct local boundaries', () => {
  const rows = ['2026-03-28T22:59:59Z','2026-03-28T23:00:00Z','2026-03-29T21:59:59Z','2026-03-29T22:00:00Z'].map((value,index)=>row(index,value))
  assert.equal(summarizeAppointments(rows,{from:'2026-03-29',to:'2026-03-29'},zone).total,2)
})
test('dashboard: repeated autumn hour counts distinct appointments', () => {
  const rows = [row(1,'2026-10-25T00:30:00Z'),row(2,'2026-10-25T01:30:00Z')]
  assert.equal(summarizeAppointments(rows,{from:'2026-10-25',to:'2026-10-25'},zone).total,2)
})
test('dashboard: value uses completed appointment snapshot prices only', () => {
  const rows = ['pending','confirmed','completed','cancelled','no_show'].map((status,index)=>row(index,'2026-05-15T10:00:00Z',status,3100))
  assert.deepEqual(summarizeAppointments(rows,{from:'2026-05-15',to:'2026-05-15'},zone),{total:5,active:2,completed:1,cancelled:1,noShow:1,valueCents:3100,missingPrices:0})
})
test('dashboard: unavailable prices are reported; free appointments stay valid', () => {
  const rows = [0,'1200',null,undefined,'',-1,'bad',1.5].map((price,index)=>({...row(index,'2026-05-15T10:00:00Z','completed'),priceCents:price}))
  const stats=summarizeAppointments(rows,{from:'2026-05-15',to:'2026-05-15'},zone)
  assert.equal(stats.valueCents,1200);assert.equal(stats.missingPrices,6)
})
test('dashboard: empty range is zero, never fabricated data', () => assert.equal(summarizeAppointments([],{from:'2026-01-01',to:'2026-01-01'},zone).total,0))
test('dashboard: upcoming uses instants during repeated autumn hour', () => {
  const rows=[row(2,'2026-10-25T01:15:00Z'),row(1,'2026-10-25T00:45:00Z'),row(3,'2026-10-25T02:00:00Z','cancelled')]
  const view=scheduleView(rows,'2026-10-25T01:00:00Z',zone)
  assert.deepEqual(view.upcoming.map(item=>item.id),[2]);assert.equal(view.today.length,3)
  assert.equal(rows[0].id,2)
})
test('dashboard: upcoming sorts and caps at five active future appointments', () => {
  const rows=Array.from({length:8},(_,i)=>row(i,`2026-11-${String(10-i).padStart(2,'0')}T10:00:00Z`))
  assert.deepEqual(scheduleView(rows,'2026-11-01T00:00:00Z',zone).upcoming.map(item=>item.id),[7,6,5,4,3])
})
test('dashboard: Croatian appointment count handles 1, 11 and 21', () => {
  assert.equal(appointmentCount(1),'1 termin');assert.equal(appointmentCount(11),'11 termina');assert.equal(appointmentCount(21),'21 termin');assert.equal(appointmentCount(0),'0 termina')
})
test('dashboard: money shows Croatian decimals', () => assert.match(formatMoney(123456), /1\.234,56/))
