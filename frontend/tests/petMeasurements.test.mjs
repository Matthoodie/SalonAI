import test from 'node:test'
import assert from 'node:assert/strict'
import {weightToGrams,weightInput} from '../src/api/petMeasurements.js'
import {petPayload,petDraftErrors,validatePetRow,createPetApi} from '../src/api/petApi.js'
const draft={name:'Luna',species:'dog',breed:'',notes:''}
const row=extra=>({id:3,salon_id:1,client_id:2,...draft,active:true,revision:1,created_at:'2026-11-11T10:00:00Z',updated_at:'2026-11-11T10:00:00Z',size_category:'medium',weight_grams:12500,...extra})
const response=data=>({ok:true,status:200,json:async()=>({data})})
test('measurements UI: comma and dot use exact grams without floating rounding',()=>{
  for(const [input,grams] of [['12,5',12500],['12.5',12500],['0,001',1],['200',200000],['1.007',1007],[' 2,010 ',2010],['',null],[' ',null]])assert.equal(weightToGrams(input),grams)
  for(const grams of [null,1,1007,2010,12500,200000])assert.equal(weightToGrams(weightInput(grams)),grams)
})
test('measurements UI: invalid precision, exponents, separators and bounds rejected',()=>{
  for(const input of ['0','-1','200,001','1e2','1,2345','12.5.0','1 000','12kg','.5','1.',null,5])assert.throws(()=>weightToGrams(input))
})
test('measurements UI: optional blanks clear and absent legacy draft preserves',()=>{
  assert.deepEqual(petPayload(draft),draft)
  assert.deepEqual(petPayload({...draft,sizeCategory:'',weightKg:''}),{...draft,size_category:null,weight_grams:null})
  assert.deepEqual(petPayload({...draft,sizeCategory:'large',weightKg:'12,5'}),{...draft,size_category:'large',weight_grams:12500})
  for(const sizeCategory of ['toString',[],['small'],true])assert.ok(petDraftErrors({...draft,sizeCategory}).sizeCategory)
  assert.ok(petDraftErrors({...draft,weightKg:'0'}).weightKg)
})
test('measurements UI: malformed server values rejected, legacy defaults empty',()=>{
  for(const bad of [{weight_grams:'12500'},{weight_grams:0},{weight_grams:200001},{weight_grams:1.5},{size_category:'unknown'},{size_category:['small']}])assert.throws(()=>validatePetRow(row(bad),1,2))
  const result=validatePetRow(row({size_category:undefined,weight_grams:undefined}),1,2)
  assert.equal(result.weight_grams,null);assert.equal(result.size_category,null)
})
test('measurements API: create sends exact grams and rejects mismatched saved value',async()=>{
  const body={...draft,sizeCategory:'medium',weightKg:'12,5'}
  const api=createPetApi({request:async(url,opts)=>{assert.equal(JSON.parse(opts.body).weight_grams,12500);return response(row())}})
  assert.equal((await api.create(1,2,body)).weight_grams,12500)
  await assert.rejects(createPetApi({request:async()=>response(row({weight_grams:12}))}).create(1,2,body))
})
test('measurements API: update clears explicitly; omitted values and archive must preserve',async()=>{
  const api=createPetApi({request:async()=>response(row({revision:2,weight_grams:null,size_category:null}))})
  assert.equal((await api.update(1,2,row(),{...draft,weightKg:'',sizeCategory:''})).weight_grams,null)
  await assert.rejects(api.update(1,2,row(),draft))
  await assert.rejects(createPetApi({request:async()=>response(row({revision:2,active:false,weight_grams:null}))}).setActive(1,2,row(),false))
})
test('measurements API: invalid draft cannot send request',()=>{
  let calls=0;const api=createPetApi({request:()=>{calls++;throw Error()}})
  assert.throws(()=>api.create(1,2,{...draft,weightKg:'200,001'}));assert.equal(calls,0)
})
