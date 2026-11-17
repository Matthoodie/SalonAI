import test from 'node:test'
import assert from 'node:assert/strict'
import {capacityCalendar,capacityRange,capacityDays,buildCapacityReport} from '../src/utils/capacityCalendar.js'
const H=3600000,asOf='2030-01-07T07:00:00.000Z'
function snapshot(){return {salon_id:1,timezone:'Europe/Zagreb',employees:[{id:2,salon_id:1,name:'Ana',active:true}],
 weekly:Array.from({length:7},(_,i)=>({employee_id:2,salon_id:1,day_of_week:i+1,start_time:'08:00:00',end_time:'16:00:00'})),overrides:[],timeOff:[],blocks:[],appointments:[]}}
const row=(extra)=>({employee_id:2,salon_id:1,...extra})
test('capacity calendar: only bounded server-selected horizon is accepted',()=>{
 assert.equal(capacityDays(),7);assert.equal(capacityDays({days:'30'}),30)
 for(const q of [{days:7},{days:'8'},{days:['7','14']},{days:'07'},{salon_id:'1'},{days:'7',as_of:asOf}])assert.throws(()=>capacityDays(q),{code:'CAPACITY_INVALID_QUERY'})
})
test('capacity calendar: winter summer and fractional offsets resolve exactly',()=>{
 const z=capacityCalendar('Europe/Zagreb')
 assert.equal(new Date(z.resolve('2026-01-10','08:00')).toISOString(),'2026-01-10T07:00:00.000Z')
 assert.equal(new Date(z.resolve('2026-07-10','08:00')).toISOString(),'2026-07-10T06:00:00.000Z')
 assert.equal(new Date(capacityCalendar('Asia/Kathmandu').resolve('2026-07-10','08:00')).toISOString(),'2026-07-10T02:15:00.000Z')
})
test('capacity calendar: missing and repeated local endpoints both fail closed',()=>{
 const z=capacityCalendar('Europe/Zagreb')
 for(const date of ['2026-03-29','2026-10-25'])assert.throws(()=>z.resolve(date,'02:30'),{code:'CAPACITY_LOCAL_TIME_UNCLEAR'})
 assert.throws(()=>capacityCalendar('Australia/Lord_Howe').resolve('2026-10-04','02:15'),{code:'CAPACITY_LOCAL_TIME_UNCLEAR'})
})
test('capacity calendar: impossible dates invalid hours and missing zone are rejected',()=>{
 const z=capacityCalendar('UTC')
 for(const d of ['2026-02-30','x'])assert.throws(()=>z.resolve(d,'08:00'))
 for(const t of ['25:00','08:60',null,'08:00:00.5'])assert.throws(()=>z.resolve('2026-01-01',t))
 for(const zone of ['',null,'No/Zone'])assert.throws(()=>capacityCalendar(zone))
 assert.equal(z.resolve('2026-01-01','24:00'),Date.parse('2026-01-02T00:00:00Z'))
})
test('capacity calendar: horizons follow local dates and preserve as-of milliseconds',()=>{
 const r=capacityRange('Europe/Zagreb','2026-03-28T23:30:15.123Z',7)
 assert.equal(r.dates[0],'2026-03-29');assert.equal(r.dates.at(-1),'2026-04-04')
 assert.equal(r.range.starts_at,'2026-03-28T23:30:15.123Z');assert.equal(r.range.ends_at,'2026-04-04T22:00:00.000Z')
})
test('capacity calendar: weekly schedule maps Monday and Sunday and clips today',()=>{
 const s=snapshot();s.weekly=s.weekly.filter(r=>[1,7].includes(r.day_of_week))
 const r=buildCapacityReport(s,7,'2030-01-07T09:00:00.000Z')
 assert.equal(r.totals.capacity_ms,14*H)
 assert.equal(r.heatmap.find(c=>c.date==='2030-01-07'&&c.hour===8).capacity_ms,0)
 assert.equal(r.heatmap.find(c=>c.date==='2030-01-13'&&c.hour===8).capacity_ms,H)
})
test('capacity calendar: date override replaces weekly shift and disabled override removes it',()=>{
 const s=snapshot();s.overrides=[row({date:'2030-01-07',enabled:true,start_time:'10:00:00',end_time:'12:00:00'}),row({date:'2030-01-08',enabled:false,start_time:null,end_time:null})]
 assert.equal(buildCapacityReport(s,7,asOf).totals.capacity_ms,42*H)
})
test('capacity calendar: approved effective absence wins over both override and weekly shift',()=>{
 const s=snapshot();s.overrides=[row({date:'2030-01-07',enabled:true,start_time:'10:00:00',end_time:'12:00:00'})]
 s.timeOff=[row({start_date:'2030-01-07',end_date:'2030-01-08'})]
 assert.equal(buildCapacityReport(s,7,asOf).totals.capacity_ms,40*H)
})
test('capacity calendar: blocks and saved appointment intervals produce heatmap conservation',()=>{
 const s=snapshot();s.blocks=[row({starts_at:'2030-01-07T10:30:00.000Z',ends_at:'2030-01-07T11:30:00.000Z'})]
 s.appointments=[row({id:5,status:'confirmed',starts_at:'2030-01-07T08:15:00.000Z',ends_at:'2030-01-07T09:45:00.000Z'})]
 const r=buildCapacityReport(s,7,asOf)
 assert.equal(r.totals.capacity_ms,55*H);assert.equal(r.totals.occupied_ms,1.5*H)
 for(const k of ['capacity_ms','occupied_ms','free_ms'])assert.equal(r.heatmap.reduce((n,c)=>n+c[k],0),r.totals[k])
 assert.equal(r.heatmap.length,168);assert.equal(r.employees[0].name,'Ana');assert.equal('capacity_intervals' in r.employees[0],false)
})
test('capacity calendar: DST spring missing cell is empty and autumn cell includes both hours',()=>{
 for(const [date,asOf,hours,cellHours]of [['2026-03-29','2026-03-28T23:00:00.000Z',3,0],['2026-10-25','2026-10-24T22:00:00.000Z',5,2]]){
  const s=snapshot();s.weekly=[];s.overrides=[row({date,enabled:true,start_time:'00:00:00',end_time:'04:00:00'})]
  const r=buildCapacityReport(s,7,asOf)
  assert.equal(r.totals.capacity_ms,hours*H);assert.equal(r.heatmap.find(c=>c.date===date&&c.hour===2).capacity_ms,cellHours*H)
 }
})
test('capacity calendar: half-hour DST transition and quarter offset heatmap conserve duration',()=>{
 const s=snapshot();s.timezone='Australia/Lord_Howe';s.weekly=[];s.overrides=[row({date:'2026-10-04',enabled:true,start_time:'00:00:00',end_time:'04:00:00'})]
 const r=buildCapacityReport(s,7,'2026-10-03T13:30:00.000Z')
 assert.equal(r.totals.capacity_ms,3.5*H);assert.equal(r.heatmap.find(c=>c.date==='2026-10-04'&&c.hour===2).capacity_ms,.5*H)
 s.timezone='Asia/Kathmandu';s.overrides=[row({date:'2026-10-04',enabled:true,start_time:'08:15:00',end_time:'09:45:00'})]
 assert.equal(buildCapacityReport(s,7,'2026-10-04T00:00:00.000Z').totals.capacity_ms,1.5*H)
})
test('capacity calendar: foreign rows duplicate schedules missing arrays and excessive staff fail',()=>{
 let s=snapshot();s.weekly[0].salon_id=99;assert.throws(()=>buildCapacityReport(s,7,asOf))
 s=snapshot();s.weekly.push(s.weekly[0]);assert.throws(()=>buildCapacityReport(s,7,asOf))
 s=snapshot();delete s.blocks;assert.throws(()=>buildCapacityReport(s,7,asOf))
 s=snapshot();s.employees=Array(101).fill(s.employees[0]);assert.throws(()=>buildCapacityReport(s,7,asOf),{code:'CAPACITY_LIMIT_EXCEEDED'})
})
test('capacity calendar: ambiguous working endpoint rejects entire report rather than partial totals',()=>{
 const s=snapshot();s.overrides=[row({date:'2026-10-25',enabled:true,start_time:'02:30:00',end_time:'04:00:00'})]
 assert.throws(()=>buildCapacityReport(s,7,'2026-10-24T22:00:00.000Z'),{code:'CAPACITY_LOCAL_TIME_UNCLEAR'})
})
test('capacity calendar: empty salon yields zero capacity and null utilization without fake data',()=>{
 const s=snapshot();s.employees=[];s.weekly=[];const r=buildCapacityReport(s,7,asOf)
 assert.equal(r.totals.utilization_percent,null);assert.equal(r.totals.capacity_ms,0)
 assert.ok(r.heatmap.every(c=>c.capacity_ms===0&&c.utilization_percent===null))
})
