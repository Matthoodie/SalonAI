import {dashboardAnalytics,percentChange} from './dashboardAnalytics.js'
import {salonDate} from './dashboardView.js'
import {capacityDay} from './capacityPresentation.js'

// Call only with the current salon's complete authorized appointment collection.
export function businessInsights(rows,range,zone,now){
 const a=dashboardAnalytics(rows,range,zone,now)
 const anomalous=rows.some(r=>r.statusCode==='completed'&&new Date(r.startsAt).getTime()>new Date(now).getTime())
 let trendState='ready'
 if(anomalous)trendState='anomaly'
 else if(a.partialCurrent)trendState='partial'
 else if(!a.prior||a.current.missing||a.prior.missing)trendState='missing'
 else if(!a.current.count&&!a.prior.count)trendState='empty'
 const trend={state:trendState,current:a.current.valueCents,previous:a.prior?.valueCents??null,previousRange:a.previous,change:trendState==='ready'?percentChange(a.current.valueCents,a.prior.valueCents):null}
 const completed=rows.filter(r=>r.statusCode==='completed'&&salonDate(r.startsAt,zone)<=range.to)
 const selected=completed.filter(r=>salonDate(r.startsAt,zone)>=range.from)
 const relevantMissing=completed.some(r=>! /^[1-9]\d*$/.test(String(r.clientId??'')))
 const priorIds=new Set(completed.filter(r=>salonDate(r.startsAt,zone)<range.from).map(r=>String(r.clientId)))
 const ids=new Set(selected.map(r=>String(r.clientId)))
 const returning={state:anomalous?'anomaly':relevantMissing?'missing':ids.size?'ready':'empty',total:ids.size,count:[...ids].filter(id=>priorIds.has(id)).length}
 return {trend,returning}
}

// The capacity API has already validated the current salon/report and quantities.
export function capacityInsight(data){
 if(data.totals.outside_capacity_ms>0||data.totals.overlapping_booking_ms>0||data.totals.unusual_status_count>0)return {state:'anomaly',days:[]}
 const days=data.dates.map(date=>({date,...capacityDay(data.heatmap,date)})).filter(d=>d.capacity_ms>0)
 if(!days.length)return {state:'empty',days:[]}
 const free=days.filter(d=>d.free_ms>0).sort((a,b)=>b.free_ms-a.free_ms||a.date.localeCompare(b.date))
 return {state:free.length?'ready':'full',days:free.slice(0,3)}
}
