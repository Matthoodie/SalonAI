import test from 'node:test'
import assert from 'node:assert/strict'
import { createPricelistRecognitionApi,validateRecognitionResponse,MAX_RECOGNITION_BYTES } from '../src/api/pricelistRecognitionApi.js'
import { appendRecognizedRows } from '../src/components/ServiceImport/recognitionDraft.js'
import { newDraftRow,selectedPayload } from '../src/components/ServiceImport/pricelistDraft.js'
const item={name:'Šišanje',category:'Kosa',price_eur:'20,50',default_duration_minutes:'',recognition_note:'Dopunite trajanje.'}
const data={items:[item],warnings:[],salon_id:'7'}
test('recognition UI: missing duration remains blank and review note stays visible',()=>{
  const rows=appendRecognizedRows([newDraftRow()],validateRecognitionResponse(data,7).items)
  assert.equal(rows.length,1);assert.equal(rows[0].default_duration_minutes,'');assert.equal(rows[0].recognition_note,item.recognition_note)
})
test('recognition UI: append preserves manual draft and never merges by name',()=>{
  const old={...newDraftRow(),name:'Šišanje',price_eur:'12'}
  const rows=appendRecognizedRows([old],[item]);assert.equal(rows.length,2);assert.deepEqual(rows[0],old);assert.notEqual(rows[0].row_id,rows[1].row_id)
})
test('recognition UI: over-limit append preserves original draft',()=>{
  const rows=Array.from({length:100},()=>({...newDraftRow(),name:'Test'}))
  assert.throws(()=>appendRecognizedRows(rows,[item]));assert.equal(rows.length,100)
})
test('recognition UI: response from another salon or malformed rows rejected',()=>{
  assert.throws(()=>validateRecognitionResponse(data,8))
  assert.throws(()=>validateRecognitionResponse({...data,items:[{...item,price_eur:'20-30'}]},7))
  assert.throws(()=>validateRecognitionResponse({...data,items:[{...item,default_duration_minutes:'0'}]},7))
})
test('recognition UI: notes and provider extras never enter confirmed import payload',()=>{
  const rows=appendRecognizedRows([], [{...item,default_duration_minutes:'30',allow_duplicate:true}])
  const payload=selectedPayload(rows);assert.equal(payload.items[0].recognition_note,undefined);assert.equal(payload.items[0].allow_duplicate,false)
})
test('recognition UI: one raw request; failure never retries',async()=>{
  let calls=0
  const api=createPricelistRecognitionApi({request:async(url,options)=>{calls++;assert.equal(options.headers['Content-Type'],'application/octet-stream');return {ok:false,json:async()=>({error:{message:'Limit'}})}}})
  await assert.rejects(api(new Blob(['x']),7),/Limit/);assert.equal(calls,1)
})
test('recognition UI: invalid size does not send request',async()=>{
  let calls=0;const api=createPricelistRecognitionApi({request:async()=>{calls++}})
  await assert.rejects(api({size:MAX_RECOGNITION_BYTES+1},7));await assert.rejects(api(new Blob([]),7));assert.equal(calls,0)
})
test('recognition UI: successful response returns only validated fields',async()=>{
  const api=createPricelistRecognitionApi({request:async()=>({ok:true,json:async()=>({data})})})
  assert.deepEqual(await api(new Blob(['x']),7),{items:[item],warnings:[]})
})
