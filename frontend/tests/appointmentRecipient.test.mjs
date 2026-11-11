import test from 'node:test'
import assert from 'node:assert/strict'
import {createAppointmentRecipientApi} from '../src/api/appointmentRecipientApi.js'
import {recipientPayload,recipientSummary,recipientChanged,recipientLabel,recipientUpdate} from '../src/api/appointmentRecipientView.js'
const pet={id:'3',salon_id:'1',client_id:'2',name:'Siri',species:'dog',breed:'Ptičar',notes:'Private'}
const data={salon_id:'1',client_id:'2',business_type:'grooming',pets:[pet],next_cursor:null}
const response=d=>({ok:true,status:200,json:async()=>({data:d})})
const opts={salonId:1,clientId:2}
test('recipient UI: legacy and person stay distinct from pet snapshots',()=>{
  assert.equal(recipientSummary({}).recipientType,null)
  assert.equal(recipientLabel({clientName:'Silvia'}),'Silvia')
  const a={...recipientSummary({recipient_type:'pet',pet_id:3,pet_name:'Siri',pet_species:'dog',pet_breed:'Ptičar'}),clientName:'Silvia'}
  assert.match(recipientLabel(a),/Siri.*Pas.*Ptičar.*Silvia/)
  assert.equal(recipientChanged(a,{...a,petId:'3'}),false)
  assert.equal(recipientChanged(a,{...a,petId:4}),true)
  assert.equal(recipientChanged(a,{...a,clientId:99}),true)
})
test('recipient UI: invalid type/id and contradictory person payload rejected',()=>{
  for(const v of [null,undefined,'',0,-1,true,'01',' 1',1.1])assert.throws(()=>recipientPayload('pet',v))
  assert.throws(()=>recipientPayload('person',3))
  assert.deepEqual(recipientPayload('pet','3'),{recipient_type:'pet',pet_id:3})
  assert.deepEqual(recipientPayload('person',null),{recipient_type:'person',pet_id:null})
})
test('recipient API: options allowlist strips notes and preserves abort/edit context',async()=>{
  let call;const api=createAppointmentRecipientApi(async(...args)=>{call=args;return response(data)})
  const controller=new AbortController()
  const r=await api.options({...opts,appointmentId:9,signal:controller.signal})
  assert.equal(call[0],'/api/appointments/pet-options?client_id=2&appointment_id=9');assert.equal(call[1].signal,controller.signal)
  assert.deepEqual(r,{pets:[{id:'3',name:'Siri',species:'dog',breed:'Ptičar'}],nextCursor:null})
})
test('recipient API: foreign owner/salon, duplicate ids, malformed cursor fail closed',async()=>{
  for(const d of [{...data,salon_id:2},{...data,client_id:3},{...data,pets:[pet,pet]},{...data,pets:[{...pet,client_id:4}]},{...data,next_cursor:'3'},{...data,pets:[{...pet,species:'invalid'}]}]) {
    await assert.rejects(createAppointmentRecipientApi(async()=>response(d)).options(opts))
  }
})
test('recipient API: empty list valid and same names stay separate by ID',async()=>{
  assert.equal((await createAppointmentRecipientApi(async()=>response({...data,pets:[]})).options(opts)).pets.length,0)
  assert.equal((await createAppointmentRecipientApi(async()=>response({...data,pets:[pet,{...pet,id:4}]})).options(opts)).pets.length,2)
})
test('recipient API: page cursor must advance and query carries it',async()=>{
  let path;const api=createAppointmentRecipientApi(async p=>{path=p;return response({...data,pets:[{...pet,id:51}]})})
  await api.options({...opts,after:50});assert.match(path,/after=50/)
  await assert.rejects(createAppointmentRecipientApi(async()=>response(data)).options({...opts,after:50}))
})
const mutation={salonId:1,appointmentId:8,clientId:2,type:'pet',petId:3,revision:1}
const saved={id:8,salon_id:1,client_id:2,recipient_type:'pet',pet_id:3,recipient_revision:2,pet_name:'Siri',pet_species:'dog',pet_breed:'Ptičar'}
test('recipient API: atomic mutation sends only owner pet type and expected version',async()=>{
  let call;await createAppointmentRecipientApi(async(...args)=>{call=args;return response(saved)}).change({...mutation,pet_name:'Forged',salon_id:9})
  assert.equal(call[0],'/api/appointments/8/recipient')
  assert.deepEqual(JSON.parse(call[1].body),{client_id:2,recipient_type:'pet',pet_id:3,expected_recipient_revision:1})
})
test('recipient API: malformed or foreign mutation response is not accepted',async()=>{
  for(const extra of [{id:9},{salon_id:2},{client_id:3},{pet_id:4},{recipient_type:'person'},{recipient_revision:1}])await assert.rejects(createAppointmentRecipientApi(async()=>response({...saved,...extra})).change(mutation))
})
test('recipient API: uncertain writes never retry and conflict retains code/status',async()=>{
  let n=0;await assert.rejects(createAppointmentRecipientApi(async()=>{n++;throw Error('network')}).change(mutation));assert.equal(n,1)
  await assert.rejects(createAppointmentRecipientApi(async()=>({ok:false,status:409,json:async()=>({error:{code:'APPOINTMENT_RECIPIENT_CONFLICT',message:'Refresh'}})})).change(mutation),{code:'APPOINTMENT_RECIPIENT_CONFLICT',statusCode:409})
})
test('recipient API: invalid mutation and context IDs never reach network',async()=>{
  let n=0;const api=createAppointmentRecipientApi(async()=>{n++;return response(saved)})
  await assert.rejects(api.change({...mutation,revision:0}));await assert.rejects(api.options({...opts,clientId:0}));await assert.rejects(api.context('01'));assert.equal(n,0)
})
test('recipient API: context rejects wrong salon and unknown business',async()=>{
  for(const d of [{salon_id:2,business_type:'grooming'},{salon_id:1,business_type:'invented'}])await assert.rejects(createAppointmentRecipientApi(async()=>response(d)).context(1))
})

test('recipient API: create forwards pet identity but never caller snapshot labels',async()=>{
  const {createAppointment}=await import('../src/api/appointmentApi.js')
  const {setActiveSalonForRequests}=await import('../src/api/salonApiContext.js')
  setActiveSalonForRequests(1)
  const previous=globalThis.fetch;let body
  globalThis.fetch=async(path,options)=>{body=JSON.parse(options.body);return new Response(JSON.stringify({data:saved}),{status:201})}
  try {
    await createAppointment({clientId:2,employeeId:4,serviceIds:[1],startsAt:'2030-01-09T09:00:00Z',recipientType:'pet',petId:3,pet_name:'Injected'})
    assert.equal(body.pet_id,3);assert.equal(body.recipient_type,'pet');assert.equal(body.pet_name,undefined)
  } finally {globalThis.fetch=previous}
})
test('recipient API: salon change during options body read rejects stale data',async()=>{
  const {createSalonApiContext}=await import('../src/api/salonApiContext.js')
  let release,started
  const ready=new Promise(r=>{started=r})
  const ctx=createSalonApiContext({fetchImpl:async()=>({ok:true,status:200,headers:new Headers(),text:async()=>{started();return new Promise(r=>{release=r})}})})
  ctx.setSalon(1)
  const pending=createAppointmentRecipientApi(ctx.request).options(opts)
  await ready;ctx.setSalon(2);release(JSON.stringify({data}))
  await assert.rejects(pending,{code:'STALE_SALON_CONTEXT'})
})

test('recipient UI: schedule/status response refreshes pet and never retains another owner name',()=>{
  const current={clientId:2,clientName:'Silvia',petId:3}
  const row={client_id:9,pet_id:4,pet_name:'Gigino',pet_species:'cat',pet_breed:'',recipient_type:'pet',recipient_revision:2}
  const updated=recipientUpdate(row,current,[{id:9,name:'Matej'}])
  assert.equal(updated.clientName,'Matej');assert.equal(updated.petName,'Gigino');assert.equal(updated.recipientRevision,2)
  assert.equal(recipientUpdate(row,current).clientName,'Nepoznat klijent')
  assert.equal(recipientUpdate({...row,client_id:2},current).clientName,'Silvia')
})
