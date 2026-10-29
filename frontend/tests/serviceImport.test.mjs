import test from 'node:test'
import assert from 'node:assert/strict'
import { newDraftRow, selectedPayload, editDraftRow, applyDuration, fingerprint, reviewIsCurrent, createPendingStore, cents } from '../src/components/ServiceImport/pricelistDraft.js'
import { createServiceImportApi } from '../src/api/serviceImportApi.js'
import { createSalonApiContext } from '../src/api/salonApiContext.js'
const requestId='12345678-1234-4234-8234-123456789abc'
const row=(extra={})=>({...newDraftRow('r1'),name:'Kupanje',category:'Njega',price_eur:'25,50',default_duration_minutes:'30',...extra})
const payload=(rows=[row()])=>selectedPayload(rows)
const confirmed=()=>({...payload(),request_id:requestId})
function preview(extra={}) {
  return {currency:'EUR',rows:[{row_id:'r1',name:'Kupanje',category:'Njega',price_cents:2550,default_duration_minutes:30,
    allow_duplicate:false,ready:true,issues:[],duplicates:[],duplicate_count:0,duplicate_row_ids:[]}],ready_count:1,needs_review_count:0,...extra}
}
function saved(extra={}) {
  return {request_id:requestId,currency:'EUR',created_count:1,replayed:false,
    services:[{id:'50',salon_id:'10',name:'Kupanje',category:'Njega',price_cents:2550,default_duration_minutes:30,active:true}],
    row_service_ids:[{row_id:'r1',service_id:'50'}],...extra}
}
const response=(data,status=200)=>({status,ok:status<400,json:async()=>({data})})
function memory() {const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}}
test('import draft: missing duration stays blank and only selected rows are sent',()=>{
  assert.equal(newDraftRow().default_duration_minutes,'')
  const p=payload([row(),row({row_id:'r2',selected:false})])
  assert.equal(p.items.length,1)
  assert.equal(p.items[0].selected,undefined)
})
test('import draft: injected identity and activation fields are never sent',()=>{
  const p=payload([row({salon_id:99,user_id:88,active:false,id:77})])
  assert.deepEqual(Object.keys(p.items[0]),['row_id','name','category','price_eur','default_duration_minutes','allow_duplicate'])
})
test('import draft: selection bounds and unique row IDs are enforced',()=>{
  assert.throws(()=>payload([]))
  assert.throws(()=>payload([row(),row()]))
  assert.throws(()=>payload(Array.from({length:101},(_,i)=>row({row_id:`r${i}`}))))
  assert.equal(payload(Array.from({length:100},(_,i)=>row({row_id:`r${i}`}))).items.length,100)
})
test('import draft: bulk duration targets selected missing rows by default',()=>{
  const rows=[row({default_duration_minutes:''}),row({row_id:'r2'}),row({row_id:'r3',selected:false,default_duration_minutes:''})]
  assert.deepEqual(applyDuration(rows,'45').map(r=>r.default_duration_minutes),['45','30',''])
  assert.deepEqual(applyDuration(rows,'45',false).map(r=>r.default_duration_minutes),['45','45',''])
  assert.equal(rows[0].default_duration_minutes,'')
})
test('import draft: bulk duration rejects invalid and fractional input',()=>{
  for(const value of ['','0','-1','1.5','1e2','2147483648']) assert.throws(()=>applyDuration([row()],value))
})
test('import draft: editing identity resets duplicate acknowledgement',()=>{
  for(const key of ['name','category']) assert.equal(editDraftRow([row({allow_duplicate:true})],'r1',key,'New')[0].allow_duplicate,false)
  assert.equal(editDraftRow([row({allow_duplicate:true})],'r1','price_eur','20')[0].allow_duplicate,true)
})
test('import draft: every payload change invalidates the previous review',()=>{
  const p=payload(),review={fingerprint:fingerprint(p),data:preview()}
  assert.equal(reviewIsCurrent(review,p),true)
  for(const [field,value] of [['name','New'],['category','New'],['price_eur','26'],['default_duration_minutes','45'],['allow_duplicate',true]]) {
    assert.equal(reviewIsCurrent(review,payload(editDraftRow([row()],'r1',field,value))),false)
  }
})
test('import draft: any row needing review disables confirmation',()=>{
  const data=preview();data.rows[0].ready=false
  assert.equal(reviewIsCurrent({fingerprint:fingerprint(payload()),data},payload()),false)
})
test('import pending: confirmation survives remount and is isolated by account and salon',()=>{
  const storage=memory(),store=createPendingStore(storage,1,10)
  store.write(confirmed())
  assert.deepEqual(createPendingStore(storage,'1','10').read(),confirmed())
  assert.equal(createPendingStore(storage,2,10).read(),null)
  assert.equal(createPendingStore(storage,1,11).read(),null)
  store.clear();assert.equal(store.read(),null)
})
test('import pending: corrupt storage fails closed',()=>{
  const storage={getItem:()=>'{broken'}
  assert.throws(()=>createPendingStore(storage,1,10).read())
  assert.throws(()=>createPendingStore(memory(),null,10))
})
test('import pending: storage failure prevents preparation of confirmation',()=>{
  const storage={getItem:()=>null,setItem:()=>{throw new Error('quota')}}
  assert.throws(()=>createPendingStore(storage,1,10).write(confirmed()),/quota/)
})
test('import prices: no currency conversion or invented price',()=>{
  assert.equal(cents('25,50'),2550)
  for(const v of ['','od 20','20-30','1.234,50','20 EUR'])assert.equal(cents(v),null)
})
test('import API: preview allows incomplete values for backend review',async()=>{
  const data=preview();data.rows[0].default_duration_minutes=null;data.rows[0].ready=false
  data.rows[0].issues=[{field:'default_duration_minutes',code:'INVALID_DURATION',message:'Dopunite trajanje'}];data.ready_count=0;data.needs_review_count=1
  const api=createServiceImportApi({request:async(path,options)=>{
    assert.equal(path,'/api/services/import/preview')
    assert.equal(JSON.parse(options.body).items[0].default_duration_minutes,'')
    return response(data)
  }})
  assert.equal((await api.preview(payload([row({default_duration_minutes:''})]))).rows[0].ready,false)
})
test('import API: valid preview preserves abort signal and counts',async()=>{
  const signal=new AbortController().signal
  const api=createServiceImportApi({request:async(path,options)=>{assert.equal(options.signal,signal);return response(preview())}})
  assert.equal((await api.preview(payload(),signal)).ready_count,1)
})
test('import API: malformed preview, mismatched rows and unsafe ready claims fail closed',async()=>{
  const cases=[preview({ready_count:9}),preview({rows:[]})]
  for(const patch of [{row_id:'other'},{name:'Other'},{price_cents:1},{default_duration_minutes:60},{duplicate_count:1},{ready:true,issues:[{field:'name',code:'x',message:'x'}]}]) {
    const data=preview();Object.assign(data.rows[0],patch);cases.push(data)
  }
  for(const data of cases)await assert.rejects(createServiceImportApi({request:async()=>response(data)}).preview(payload()))
})
test('import API: confirmed response must match row mapping, salon and exact service values',async()=>{
  const cases=[saved({request_id:'wrong'}),saved({created_count:2}),saved({row_service_ids:[]}),saved({replayed:true})]
  for(const patch of [{salon_id:11},{name:'Other'},{price_cents:1},{default_duration_minutes:60},{active:false}]) {
    const data=saved();Object.assign(data.services[0],patch);cases.push(data)
  }
  for(const data of cases)await assert.rejects(createServiceImportApi({request:async()=>response(data,201)}).confirm(confirmed(),10))
})
test('import API: successful confirmation and replay are accepted',async()=>{
  for(const replayed of [false,true]) {
    const api=createServiceImportApi({request:async(path,options)=>{
      assert.equal(path,'/api/services/import/confirm')
      assert.deepEqual(JSON.parse(options.body),confirmed())
      return response(saved({replayed}),replayed?200:201)
    }})
    assert.equal((await api.confirm(confirmed(),10)).replayed,replayed)
  }
})
test('import API: invalid request ID never reaches the network',async()=>{
  let calls=0;const api=createServiceImportApi({request:async()=>{calls++;return response(saved(),201)}})
  await assert.rejects(api.confirm({...confirmed(),request_id:'invalid'},10));assert.equal(calls,0)
})
test('import API: duplicate conflict is a recognized rejection',async()=>{
  const api=createServiceImportApi({request:async()=>({ok:false,status:409,json:async()=>({error:{code:'SERVICE_IMPORT_REVIEW_REQUIRED',message:'Pregledajte duplikate'}})})})
  await assert.rejects(api.confirm(confirmed(),10),e=>e.status===409 && e.definitive===true)
})
test('import API: network failures never retry automatically',async()=>{
  let calls=0;const api=createServiceImportApi({request:async()=>{calls++;throw new Error('offline')}})
  await assert.rejects(api.confirm(confirmed(),10),e=>!e.definitive)
  assert.equal(calls,1)
})
test('import API: server errors are uncertain rather than proof of rollback',async()=>{
  const api=createServiceImportApi({request:async()=>({ok:false,status:500,json:async()=>({error:{code:'INTERNAL_ERROR'}})})})
  await assert.rejects(api.confirm(confirmed(),10),e=>!e.definitive)
})
test('import API: explicit retry retains exact request ID and body',async()=>{
  const bodies=[];const api=createServiceImportApi({request:async(path,options)=>{
    bodies.push(options.body);if(bodies.length===1)throw new Error('lost response');return response(saved({replayed:true}),200)
  }})
  const store=createPendingStore(memory(),1,10);store.write(confirmed())
  await assert.rejects(api.confirm(store.read(),10))
  assert.equal((await api.confirm(store.read(),10)).replayed,true)
  assert.equal(bodies[0],bodies[1])
})
test('import API: salon change discards stale confirmation response',async()=>{
  let release
  const gate=new Promise(resolve=>{release=resolve})
  const context=createSalonApiContext({fetchImpl:async()=>{await gate;return new Response(JSON.stringify({data:saved()}),{status:201})}})
  context.setSalon(10)
  const api=createServiceImportApi({request:context.request})
  const pending=api.confirm(confirmed(),10)
  context.setSalon(11);release()
  await assert.rejects(pending,e=>e.code==='STALE_SALON_CONTEXT')
})

test('import API: oversized UTF8 payload is rejected before reaching the network',async()=>{
  let calls=0
  const api=createServiceImportApi({request:async()=>{calls++;return response(preview())}})
  const rows=Array.from({length:100},(_,i)=>row({row_id:`r${i}`,name:'😀'.repeat(150),category:'😀'.repeat(100)}))
  await assert.rejects(api.preview(payload(rows)),/previše teksta/)
  assert.equal(calls,0)
})
