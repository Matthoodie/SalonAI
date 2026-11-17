import { salonFetch } from './salonApiContext.js'
const fail=()=>{throw Object.assign(new Error('Capacity response could not be verified.'),{code:'CAPACITY_INVALID_RESPONSE'})}
const id=x=>['string','number'].includes(typeof x)&&/^[1-9]\d*$/.test(String(x))&&Number.isSafeInteger(Number(x))
const integer=x=>Number.isSafeInteger(x)&&x>=0
const stamp=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x
const keys=['working_ms','blocked_ms','capacity_ms','occupied_ms','free_ms','outside_capacity_ms','overlapping_booking_ms','booking_count','unusual_status_count']
function quantities(r,full=true) {
  if(!r||!(full?keys:['capacity_ms','occupied_ms','free_ms']).every(k=>integer(r[k])))fail()
  if(r.occupied_ms+r.free_ms!==r.capacity_ms)fail()
  if(full&&(r.blocked_ms+r.capacity_ms!==r.working_ms||r.unusual_status_count>r.booking_count))fail()
  const expected=r.capacity_ms?r.occupied_ms/r.capacity_ms*100:null
  if(expected===null?r.utilization_percent!==null:typeof r.utilization_percent!=='number'||!Number.isFinite(r.utilization_percent)||Math.abs(r.utilization_percent-expected)>1e-8)fail()
}
export function validateCapacity(data,{salonId,timeZone,days}) {
  if(!id(salonId)||!id(data?.salon_id)||String(data.salon_id)!==String(salonId)||data.timezone!==timeZone||
    data.days!==days||![7,14,30].includes(days)||data.basis!=='current_schedule_plan'||!stamp(data.as_of)||
    data.range?.starts_at!==data.as_of||!stamp(data.range?.ends_at)||Date.parse(data.range.ends_at)<=Date.parse(data.as_of)||
    Date.parse(data.range.ends_at)-Date.parse(data.as_of)>32*86400000||!Array.isArray(data.dates)||data.dates.length!==days||
    !Array.isArray(data.employees)||data.employees.length>100||data.active_employee_count!==data.employees.length||
    !Array.isArray(data.heatmap)||data.heatmap.length!==days*24)fail()
  let dateFormatter
  try{dateFormatter=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'})}catch{fail()}
  const localDate=value=>{const p=Object.fromEntries(dateFormatter.formatToParts(new Date(value)).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}`}
  const first=localDate(data.as_of)
  for(let i=0;i<days;i++)if(data.dates[i]!==new Date(Date.parse(first+'T00:00:00Z')+i*86400000).toISOString().slice(0,10))fail()
  // The final instant is the next local date's midnight (not a fixed 24h duration).
  if(localDate(Date.parse(data.range.ends_at)-1)!==data.dates.at(-1)||localDate(data.range.ends_at)===data.dates.at(-1))fail()
  quantities(data.totals)
  const seen=new Set()
  for(const e of data.employees) {
    if(!id(e.employee_id)||seen.has(String(e.employee_id))||typeof e.name!=='string'||!e.name.trim()||e.name.length>1000)fail()
    seen.add(String(e.employee_id));quantities(e)
  }
  for(const k of keys)if(data.employees.reduce((n,e)=>n+e[k],0)!==data.totals[k])fail()
  const cells=new Set()
  for(const c of data.heatmap) {
    if(!data.dates.includes(c.date)||!Number.isInteger(c.hour)||c.hour<0||c.hour>23||cells.has(c.date+':'+c.hour))fail()
    cells.add(c.date+':'+c.hour);quantities(c,false)
  }
  for(const k of ['capacity_ms','occupied_ms','free_ms'])if(data.heatmap.reduce((n,c)=>n+c[k],0)!==data.totals[k])fail()
  return data
}
export async function fetchCapacity({salonId,timeZone,days=7,signal},request=salonFetch) {
  if(!id(salonId)||typeof timeZone!=='string'||!timeZone||![7,14,30].includes(days))fail()
  const response=await request(`/api/dashboard/capacity?days=${days}`,{signal})
  const body=await response.json()
  if(!response.ok)throw Object.assign(new Error('Capacity request failed.'),{code:body?.error?.code||'CAPACITY_REQUEST_FAILED',status:response.status})
  return validateCapacity(body?.data,{salonId,timeZone,days})
}
