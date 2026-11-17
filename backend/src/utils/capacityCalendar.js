import { calculateCapacityPlan } from './capacityPlan.js'

export const capacityError = (code, statusCode = 409) => Object.assign(new Error(code), { code, statusCode })
const invalid = () => { throw capacityError('CAPACITY_INVALID_DATA') }
export function capacityDays(query = {}) {
  if (!query || typeof query !== 'object' || Array.isArray(query) || Object.keys(query).some(k => k !== 'days') ||
      (query.days !== undefined && !['7','14','30'].includes(query.days))) throw capacityError('CAPACITY_INVALID_QUERY',400)
  return Number(query.days ?? 7)
}
export function capacityId(value) {
  if (!['string','number'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw capacityError('CAPACITY_INVALID_QUERY',400)
  return String(value)
}
export function addCapacityDays(date, days) {
  const ms = Date.parse(date + 'T00:00:00Z')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(ms) || new Date(ms).toISOString().slice(0,10) !== date) invalid()
  const result = new Date(ms + days * 86400000).toISOString().slice(0,10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) invalid()
  return result
}
export function capacityCalendar(timezone) {
  let formatter
  try {
    if (typeof timezone !== 'string' || !timezone) invalid()
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23' })
  } catch { throw capacityError('CAPACITY_TIMEZONE_INVALID') }
  const parts = ms => Object.fromEntries(formatter.formatToParts(new Date(ms)).filter(p => p.type !== 'literal').map(p => [p.type,p.value]))
  const local = ms => { const p=parts(ms);return {date:`${p.year.padStart(4,'0')}-${p.month}-${p.day}`,hour:Number(p.hour),minute:Number(p.minute),second:Number(p.second)} }
  const offsets = new Map(), cache = new Map()
  function resolve(date,time) {
    addCapacityDays(date,0)
    if (time === '24:00:00' || time === '24:00') return resolve(addCapacityDays(date,1),'00:00:00')
    if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) invalid()
    const full=time.length===5?time+':00':time,key=date+'T'+full
    if (cache.has(key)) return cache.get(key)
    const guess=Date.parse(key+'Z')
    if (!offsets.has(date)) {
      const found=new Set(),mid=Date.parse(date+'T12:00:00Z')
      for(let n=-48;n<=48;n+=6) {
        const sample=mid+n*3600000,p=parts(sample)
        const offset=Date.parse(`${p.year.padStart(4,'0')}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`)-sample
        if(offset%60000!==0) throw capacityError('CAPACITY_TIMEZONE_UNSUPPORTED')
        found.add(offset)
      }
      offsets.set(date,found)
    }
    const candidates=[]
    for(const offset of offsets.get(date)) {
      const candidate=guess-offset,p=parts(candidate)
      if(`${p.year.padStart(4,'0')}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`===key)candidates.push(candidate)
    }
    if(candidates.length!==1)throw capacityError('CAPACITY_LOCAL_TIME_UNCLEAR')
    cache.set(key,candidates[0]);return candidates[0]
  }
  return { local, resolve }
}
export function capacityRange(timezone,asOf,days) {
  if(![7,14,30].includes(days)||!Number.isFinite(Date.parse(asOf)))invalid()
  const calendar=capacityCalendar(timezone),from=calendar.local(Date.parse(asOf)).date
  const dates=Array.from({length:days},(_,i)=>addCapacityDays(from,i))
  const end=calendar.resolve(addCapacityDays(from,days),'00:00:00')
  return {calendar,dates,range:{starts_at:new Date(asOf).toISOString(),ends_at:new Date(end).toISOString()}}
}
function indexByEmployee(rows, employees) {
  const map=new Map([...employees.keys()].map(id=>[id,[]]))
  for(const row of rows) {
    const id=capacityId(row.employee_id)
    if(!map.has(id))invalid()
    map.get(id).push(row)
  }
  return map
}
// All arrays must be complete, scoped data from one consistent read-only snapshot.
export function buildCapacityReport(snapshot,days,asOf) {
  const salonId=capacityId(snapshot.salon_id),{calendar,dates,range}=capacityRange(snapshot.timezone,asOf,days)
  const employees=new Map()
  if(!Array.isArray(snapshot.employees)||snapshot.employees.length>100)throw capacityError('CAPACITY_LIMIT_EXCEEDED')
  for(const e of snapshot.employees) {
    const id=capacityId(e.id)
    if(employees.has(id)||capacityId(e.salon_id)!==salonId||e.active!==true||typeof e.name!=='string'||!e.name.trim())invalid()
    employees.set(id,e)
  }
  const groups={}
  for(const key of ['weekly','overrides','timeOff','blocks','appointments']) {
    if(!Array.isArray(snapshot[key])||snapshot[key].length>25000)throw capacityError('CAPACITY_LIMIT_EXCEEDED')
    for(const r of snapshot[key])if(capacityId(r.salon_id)!==salonId)invalid()
    groups[key]=indexByEmployee(snapshot[key],employees)
  }
  const planned=[]
  for(const [id] of employees) {
    const weekly=new Map(),overrides=new Map(),timeOff=groups.timeOff.get(id)
    for(const row of groups.weekly.get(id)) {
      if(!Number.isInteger(row.day_of_week)||row.day_of_week<1||row.day_of_week>7||weekly.has(row.day_of_week))invalid()
      weekly.set(row.day_of_week,row)
    }
    for(const row of groups.overrides.get(id)) {
      addCapacityDays(row.date,0)
      if(overrides.has(row.date)||typeof row.enabled!=='boolean')invalid()
      overrides.set(row.date,row)
    }
    for(const r of timeOff) {addCapacityDays(r.start_date,0);addCapacityDays(r.end_date,0);if(r.start_date>r.end_date)invalid()}
    const windows=[]
    for(const date of dates) {
      if(timeOff.some(r=>r.start_date<=date&&r.end_date>=date))continue
      const override=overrides.get(date),weekday=new Date(date+'T00:00:00Z').getUTCDay()||7
      const row=override??weekly.get(weekday)
      if(!row||override?.enabled===false)continue
      const start=calendar.resolve(date,row.start_time),end=calendar.resolve(date,row.end_time)
      if(start>=end)invalid()
      windows.push({salon_id:salonId,employee_id:id,starts_at:new Date(start).toISOString(),ends_at:new Date(end).toISOString()})
    }
    planned.push({salon_id:salonId,employee_id:id,active:true,working_windows:windows,
      blocks:groups.blocks.get(id),appointments:groups.appointments.get(id)})
  }
  if(planned.reduce((n,e)=>n+e.working_windows.length+e.blocks.length+e.appointments.length,0)>25000)throw capacityError('CAPACITY_LIMIT_EXCEEDED')
  const plan=calculateCapacityPlan({salon_id:salonId,timezone:snapshot.timezone,as_of:range.starts_at,range,employees:planned})
  const heatmap=capacityHeatmap(plan,dates,calendar)
  return {salon_id:salonId,timezone:snapshot.timezone,as_of:plan.as_of,range,days,dates,basis:plan.basis,
    active_employee_count:plan.active_employee_count,totals:plan.totals,heatmap,
    employees:plan.employees.map(({capacity_intervals,occupied_intervals,...row})=>({...row,name:employees.get(row.employee_id).name}))}
}
export function capacityHeatmap(plan,dates,calendar) {
  const cells=new Map(dates.flatMap(date=>Array.from({length:24},(_,hour)=>[`${date}:${hour}`,{date,hour,capacity_ms:0,occupied_ms:0,free_ms:0,utilization_percent:null}])))
  const start=Date.parse(plan.range.starts_at),end=Date.parse(plan.range.ends_at),axis=[]
  // Build one shared axis. Modern supported zone offsets have whole-minute precision.
  // Minute boundaries catch half-hour transitions; adjacent equal labels are merged.
  // Two autumn occurrences add to the same labelled cell rather than overwriting it.
  for(let cursor=start;cursor<end;) {
    const aligned=Math.floor(cursor/60000)*60000,local=calendar.local(aligned)
    if(local.second!==0)throw capacityError('CAPACITY_TIMEZONE_UNSUPPORTED')
    const next=Math.min(end,aligned+60000),key=`${local.date}:${local.hour}`
    if(!cells.has(key))invalid()
    const last=axis.at(-1)
    if(last&&last.key===key)last.end=next
    else axis.push({start:cursor,end:next,key})
    cursor=next
  }
  for(const employee of plan.employees)for(const [field,intervals] of [['capacity_ms',employee.capacity_intervals],['occupied_ms',employee.occupied_intervals]]) {
    let j=0
    for(const [a,b] of intervals) {
      while(j<axis.length&&axis[j].end<=a)j++
      for(let k=j;k<axis.length&&axis[k].start<b;k++) {
        const overlap=Math.min(b,axis[k].end)-Math.max(a,axis[k].start)
        if(overlap>0)cells.get(axis[k].key)[field]+=overlap
      }
    }
  }
  return [...cells.values()].map(c=>({...c,free_ms:c.capacity_ms-c.occupied_ms,
    utilization_percent:c.capacity_ms?c.occupied_ms/c.capacity_ms*100:null}))
}
