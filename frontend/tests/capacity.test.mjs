import test from 'node:test'
import assert from 'node:assert/strict'
import {validateCapacity,fetchCapacity} from '../src/api/capacityApi.js'
import {createSalonApiContext} from '../src/api/salonApiContext.js'
const ctx={salonId:1,timeZone:'Europe/Zagreb',days:7}
function report(){
 const dates=Array.from({length:7},(_,i)=>`2030-01-${String(i+7).padStart(2,'0')}`)
 const totals={working_ms:3600000,blocked_ms:0,capacity_ms:3600000,occupied_ms:1800000,free_ms:1800000,outside_capacity_ms:0,overlapping_booking_ms:0,booking_count:1,unusual_status_count:0,utilization_percent:50}
 return {salon_id:'1',timezone:ctx.timeZone,as_of:'2030-01-07T07:00:00.000Z',range:{starts_at:'2030-01-07T07:00:00.000Z',ends_at:'2030-01-13T23:00:00.000Z'},days:7,dates,basis:'current_schedule_plan',active_employee_count:1,totals,
 employees:[{...totals,employee_id:'2',name:'Ana <literal>'}],heatmap:dates.flatMap(date=>Array.from({length:24},(_,hour)=>({date,hour,capacity_ms:date===dates[0]&&hour===8?3600000:0,occupied_ms:date===dates[0]&&hour===8?1800000:0,free_ms:date===dates[0]&&hour===8?1800000:0,utilization_percent:date===dates[0]&&hour===8?50:null})))}
}
test('capacity UI API: complete identities and conserved quantities accepted',()=>assert.equal(validateCapacity(report(),ctx).totals.utilization_percent,50))
test('capacity UI API: null capacity differs from empty booking capacity',()=>{
 const r=report();r.employees=[];r.active_employee_count=0
 for(const key of Object.keys(r.totals))r.totals[key]=key==='utilization_percent'?null:0
 r.heatmap=r.heatmap.map(c=>({...c,capacity_ms:0,occupied_ms:0,free_ms:0,utilization_percent:null}))
 assert.equal(validateCapacity(r,ctx).totals.utilization_percent,null)
 r.totals.utilization_percent=0;assert.throws(()=>validateCapacity(r,ctx))
})
test('capacity UI API: wrong salon timezone basis and horizon rejected',()=>{
 for(const [key,value]of [['salon_id',2],['timezone','UTC'],['basis','historical'],['days',30]]){const r=report();r[key]=value;assert.throws(()=>validateCapacity(r,ctx))}
})
test('capacity UI API: inconsistent times dates and incomplete cells rejected',()=>{
 for(const change of [r=>r.range.starts_at='2030-01-07T06:00:00.000Z',r=>r.range.ends_at='2030-01-14T01:00:00.000Z',r=>r.dates[1]=r.dates[0],r=>r.heatmap.pop(),r=>r.heatmap[1]=r.heatmap[0]]){const r=report();change(r);assert.throws(()=>validateCapacity(r,ctx))}
})
test('capacity UI API: inconsistent totals duplicate staff and malformed quantities rejected',()=>{
 for(const change of [r=>r.totals.free_ms++,r=>r.employees[0].capacity_ms++,r=>r.heatmap[8].occupied_ms++,r=>r.totals.utilization_percent=101,r=>r.employees.push(r.employees[0]),r=>r.totals.capacity_ms='3600000',r=>r.totals.blocked_ms=-1]){const r=report();change(r);assert.throws(()=>validateCapacity(r,ctx))}
})
test('capacity UI API: ordered request sends only horizon and abort signal',async()=>{
 const signal=new AbortController().signal;let call
 await fetchCapacity({...ctx,signal},async(...args)=>{call=args;return {ok:true,json:async()=>({data:report()})}})
 assert.equal(call[0],'/api/dashboard/capacity?days=7');assert.equal(call[1].signal,signal)
})
test('capacity UI API: invalid caller input sends no request',async()=>{
 let called=0;await assert.rejects(fetchCapacity({...ctx,days:365},async()=>{called++}));assert.equal(called,0)
})
test('capacity UI API: errors retain code and status and do not automatically retry',async()=>{
 let called=0;await assert.rejects(fetchCapacity(ctx,async()=>{called++;return {ok:false,status:403,json:async()=>({error:{code:'CAPACITY_FORBIDDEN'}})}}),{code:'CAPACITY_FORBIDDEN',status:403});assert.equal(called,1)
})
test('capacity UI API: switching salon rejects a delayed response',async()=>{
 let resolve;const api=createSalonApiContext({fetchImpl:()=>new Promise(r=>resolve=r)});api.setSalon(1)
 const pending=fetchCapacity(ctx,api.request);api.setSalon(2);resolve(new Response(JSON.stringify({data:report()})))
 await assert.rejects(pending,{code:'STALE_SALON_CONTEXT'})
})
test('capacity UI API: switching salon during body reading rejects stale content',async()=>{
 let finish,reading;const started=new Promise(r=>reading=r)
 const api=createSalonApiContext({fetchImpl:async()=>({ok:true,status:200,headers:new Headers(),text:()=>{reading();return new Promise(r=>finish=r)}})})
 api.setSalon(1);const pending=fetchCapacity(ctx,api.request);await started;api.setSalon(2);finish(JSON.stringify({data:report()}))
 await assert.rejects(pending,{code:'STALE_SALON_CONTEXT'})
})
