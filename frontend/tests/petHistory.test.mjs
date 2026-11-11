import test from 'node:test'
import assert from 'node:assert/strict'
import {createPetHistoryApi,validateHistory} from '../src/api/petHistoryApi.js'
import {createSalonApiContext} from '../src/api/salonApiContext.js'
const ctx={salonId:1,clientId:2,petId:3}
const row=()=>({id:'4',salon_id:'1',client_id:'2',pet_id:'3',pet_name:'Luna',pet_species:'dog',pet_breed:'Pudl',starts_at:'2030-01-01T09:00:00.000Z',ends_at:'2030-01-01T09:30:00.000Z',status:'completed',duration_minutes:30,price_cents:1200,employee_name:'Ana',items:[{service_id:'5',position:1,name:'Šišanje',price_cents:1200,duration_minutes:30}],notes:'not returned'})
const page=()=>({salon_id:1,client_id:2,pet_id:3,timezone:'Europe/Zagreb',appointments:[row()],next_cursor:null})
test('pet history UI: snapshot fields and totals accepted; extras discarded',()=>{
  const result=validateHistory(page(),ctx)
  assert.equal(result.appointments[0].pet_name,'Luna');assert.equal(result.appointments[0].items[0].name,'Šišanje')
  assert.equal(Object.hasOwn(result.appointments[0],'notes'),false)
})
test('pet history UI: foreign salon, owner and same-name pet are rejected',()=>{
  for(const field of ['salon_id','client_id','pet_id']){
    const outer=page();outer[field]=99;assert.throws(()=>validateHistory(outer,ctx))
    const inner=page();inner.appointments[0][field]=99;assert.throws(()=>validateHistory(inner,ctx))
  }
})
test('pet history UI: invalid timezone, duplicates, totals and dates rejected',()=>{
  for(const mutate of [p=>p.timezone='',p=>p.timezone='Unknown/Zone',p=>p.appointments.push(row()),p=>p.appointments[0].price_cents=99,p=>p.appointments[0].starts_at='bad',p=>p.appointments[0].ends_at=p.appointments[0].starts_at,p=>p.appointments[0].status='unknown',p=>p.next_cursor='!']){
    const p=page();mutate(p);assert.throws(()=>validateHistory(p,ctx))
  }
})
test('pet history UI: empty and legacy nameless service history remain explicit',()=>{
  const p=page();p.appointments=[];assert.deepEqual(validateHistory(p,ctx).appointments,[])
  p.appointments=[{...row(),items:[]}];assert.deepEqual(validateHistory(p,ctx).appointments[0].items,[])
})
test('pet history API: exact scoped path, GET, abort signal and no-store',async()=>{
  let call;const signal=new AbortController().signal
  const api=createPetHistoryApi({request:async(url,options)=>{call={url,options};return{ok:true,json:async()=>({data:page()})}}})
  await api.list(1,2,3,{signal,cursor:'abc'})
  assert.equal(call.url,'/api/clients/2/pets/3/appointments?cursor=abc');assert.equal(call.options.method,'GET');assert.equal(call.options.signal,signal);assert.equal(call.options.cache,'no-store')
})
test('pet history API: invalid IDs or cursor never send requests; failed reads do not retry',async()=>{
  let calls=0;const api=createPetHistoryApi({request:async()=>{calls++;throw Error('offline')}})
  for(const args of [[0,2,3],[1,2,'3/4'],[1,2,3,{cursor:[]}],[1,2,3,{cursor:'!'}]])await assert.rejects(api.list(...args))
  assert.equal(calls,0);await assert.rejects(api.list(1,2,3),/offline/);assert.equal(calls,1)
})
test('pet history API: revoked access retains status for caller',async()=>{
  const api=createPetHistoryApi({request:async()=>({ok:false,status:403,json:async()=>({error:{code:'PET_FORBIDDEN'}})})})
  await assert.rejects(api.list(1,2,3),{statusCode:403,code:'PET_FORBIDDEN'})
})
test('pet history API: delayed body from previous salon is rejected',async()=>{
  let finish,started;const ready=new Promise(resolve=>started=resolve)
  const context=createSalonApiContext({fetchImpl:async()=>({ok:true,status:200,headers:new Headers(),text:()=>{started();return new Promise(resolve=>finish=resolve)}})})
  context.setSalon(1);const api=createPetHistoryApi({request:context.request}),pending=api.list(1,2,3)
  await ready;context.setSalon(9);finish(JSON.stringify({data:page()}))
  await assert.rejects(pending,{code:'STALE_SALON_CONTEXT'})
})
