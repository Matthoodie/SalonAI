import test from 'node:test'
import assert from 'node:assert/strict'
import {validatePet} from '../src/utils/petValidation.js'
import {savePet,insertPet} from '../src/repositories/petRepository.js'
const draft={name:'Luna',species:'dog',breed:'',notes:''}
test('measurements: optional omission and explicit null remain distinct',()=>{
  assert.deepEqual(validatePet(draft),draft)
  assert.deepEqual(validatePet({...draft,size_category:null,weight_grams:null}),{...draft,size_category:null,weight_grams:null})
})
test('measurements: categories and exact integer gram boundaries',()=>{
  for(const size_category of ['small','medium','large','giant'])for(const weight_grams of [1,12500,200000]){
    const out=validatePet({...draft,size_category,weight_grams});assert.equal(out.size_category,size_category);assert.equal(out.weight_grams,weight_grams)
  }
})
test('measurements: strings, decimals, zero, nonfinite and unknown fields rejected',()=>{
  for(const weight_grams of [0,-1,0.5,200001,'12500',true,[],{},NaN,Infinity])assert.throws(()=>validatePet({...draft,weight_grams}),{code:'PET_INVALID_INPUT'})
  for(const size_category of ['',0,[],['small'],{},'toString','unknown'])assert.throws(()=>validatePet({...draft,size_category}),{code:'PET_INVALID_INPUT'})
  assert.throws(()=>validatePet({...draft,weight_kg:12.5}),{code:'PET_INVALID_INPUT'})
})
test('measurements repository: omitted fields are not overwritten; explicit clear parameterized',async()=>{
  const calls=[],db={query:async(sql,args)=>{calls.push({sql,args});return{rows:[{}]}}}
  await savePet(db,1,2,3,draft,false)
  assert.doesNotMatch(calls[0].sql.split('RETURNING')[0],/size_category=|weight_grams=/)
  await savePet(db,1,2,3,{...draft,size_category:'large',weight_grams:null},false)
  assert.match(calls[1].sql,/size_category=\$8,weight_grams=\$9/)
  assert.deepEqual(calls[1].args,[1,2,3,'Luna','dog','','','large',null])
  await savePet(db,1,2,3,{...draft,weight_grams:12500},false)
  assert.match(calls[2].sql,/weight_grams=\$8/);assert.equal(calls[2].args.at(-1),12500)
})
test('measurements repository: archive leaves data unchanged and old creation stores null',async()=>{
  const calls=[],db={query:async(sql,args)=>{calls.push({sql,args});return{rows:[{}]}}}
  await savePet(db,1,2,3,{active:false,size_category:null,weight_grams:null},true)
  assert.doesNotMatch(calls[0].sql.split('RETURNING')[0],/size_category=|weight_grams=/)
  await insertPet(db,1,2,draft);assert.deepEqual(calls[1].args.slice(-2),[null,null])
})
