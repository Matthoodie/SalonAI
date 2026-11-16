import { salonDate, validDate } from './dashboardView.js'
const DAY=86400000
const epoch=date=>Date.parse(`${date}T00:00:00Z`)
function dateAt(ms){const value=new Date(ms).toISOString().slice(0,10);return validDate(value)?value:null}
export function comparisonRange(range){
  if(!range||!validDate(range.from)||!validDate(range.to)||range.from>range.to)throw Error('Invalid analytics range')
  const days=Math.round((epoch(range.to)-epoch(range.from))/DAY)+1
  const from=dateAt(epoch(range.from)-days*DAY),to=dateAt(epoch(range.from)-DAY)
  return {days,previous:from&&to?{from,to}:null}
}
export function cents(value){
  if(typeof value!=='number'&&!(typeof value==='string'&&/^\d+$/.test(value)))return null
  const n=Number(value);return Number.isSafeInteger(n)&&n>=0?n:null
}
function add(a,b){const n=a+b;if(!Number.isSafeInteger(n))throw Error('Analytics amount exceeds safe integer range');return n}
function values(rows){
  let valueCents=0,missing=0
  for(const row of rows){const n=cents(row.priceCents);if(n===null)missing++;else valueCents=add(valueCents,n)}
  return {count:rows.length,priced:rows.length-missing,missing,valueCents,averageCents:rows.length&&!missing?valueCents/rows.length:null}
}
export function percentChange(current,previous){
  if(current===null||previous===null)return null
  if(previous===0)return current===0?0:null
  return (current-previous)/previous*100
}
function topServices(rows){
  const map=new Map();let missing=0
  for(const row of [...rows].sort((a,b)=>a.instant-b.instant||String(a.id).localeCompare(String(b.id)))){
    const items=row.items==null?[{service_id:row.serviceId,name:row.serviceName,price_cents:row.priceCents}]:row.items
    const seen=new Set();let sum=0
    if(!Array.isArray(items)||!items.length){missing++;continue}
    const valid=items.every(item=>{
      const id=String(item?.service_id??'');const amount=cents(item?.price_cents)
      if(!/^[1-9]\d*$/.test(id)||seen.has(id)||typeof item.name!=='string'||!item.name.trim()||amount===null)return false
      seen.add(id);sum=add(sum,amount);return true
    })
    if(!valid||cents(row.priceCents)===null||sum!==cents(row.priceCents)){missing++;continue}
    for(const item of items){const id=String(item.service_id),current=map.get(id)||{id,count:0,valueCents:0};current.name=item.name;current.count++;current.valueCents=add(current.valueCents,cents(item.price_cents));map.set(id,current)}
  }
  const all=[...map.values()]
  const byValue=[...all].sort((a,b)=>b.valueCents-a.valueCents||b.count-a.count||a.id.localeCompare(b.id)).slice(0,5)
  const byCount=[...all].sort((a,b)=>b.count-a.count||b.valueCents-a.valueCents||a.id.localeCompare(b.id)).slice(0,5)
  return {byValue,byCount,missing}
}
export function dashboardAnalytics(rows,range,zone,now){
  const {days,previous}=comparisonRange(range)
  const time=new Date(now).getTime();if(!Number.isFinite(time))throw Error('Invalid analytics time')
  const today=salonDate(now,zone),futureTo=dateAt(epoch(today)+29*DAY)
  if(!futureTo)throw Error('Invalid future analytics range')
  const seen=new Set()
  const entries=rows.map(row=>{
    const id=String(row.id??''),instant=new Date(row.startsAt).getTime()
    if(!/^[1-9]\d*$/.test(id)||seen.has(id)||typeof row.startsAt!=='string'||!validDate(row.startsAt.slice(0,10))||!/[T].*(Z|[+-]\d{2}:\d{2})$/.test(row.startsAt)||!Number.isFinite(instant))throw Error('Invalid or duplicate appointment')
    seen.add(id);return {...row,instant,day:salonDate(row.startsAt,zone)}
  })
  const inRange=(row,r)=>r&&row.day>=r.from&&row.day<=r.to
  const completed=entries.filter(row=>row.statusCode==='completed'&&inRange(row,range))
  const before=entries.filter(row=>row.statusCode==='completed'&&inRange(row,previous))
  const current=values(completed),prior=previous?values(before):null
  const future=values(entries.filter(row=>['pending','confirmed'].includes(row.statusCode)&&row.instant>=time&&row.day<=futureTo))
  const bucketDays=Math.ceil(days/12),buckets=[]
  for(let offset=0;offset<days;offset+=bucketDays){
    const length=Math.min(bucketDays,days-offset)
    const from=dateAt(epoch(range.from)+offset*DAY),to=dateAt(epoch(from)+(length-1)*DAY)
    const priorFrom=previous?dateAt(epoch(previous.from)+offset*DAY):null
    const priorTo=priorFrom?dateAt(epoch(priorFrom)+(length-1)*DAY):null
    buckets.push({from,to,priorFrom,priorTo,current:values(completed.filter(row=>inRange(row,{from,to}))),previous:previous?values(before.filter(row=>inRange(row,{from:priorFrom,to:priorTo}))):null})
  }
  return {current,prior,previous,range,days,future,futureFrom:today,futureTo,buckets,services:topServices(completed),partialCurrent:range.to>=today}
}
