import test from 'node:test'
import assert from 'node:assert/strict'
import {petId,petContext,validatePet,validatePetActive} from '../src/utils/petValidation.js'
import {createApp} from '../src/createApp.js'
const draft = extra => ({name:' Luna ',species:'dog',breed:' Mješanac ',notes:' Mirna. ',...extra})
const context = () => ({currentUser:{id:1,active:true},currentSalon:{id:2,active:true},currentMembership:{userId:1,salonId:2,role:'owner',active:true}})
test('pets: trims fields and preserves unknown breed as empty',()=>{
  assert.deepEqual(validatePet(draft()),{name:'Luna',species:'dog',breed:'Mješanac',notes:'Mirna.'})
  assert.equal(validatePet(draft({breed:''})).breed,'')
  for(const species of ['dog','cat','other'])assert.equal(validatePet(draft({species})).species,species)
})
test('pets: Unicode lengths and multiline notes',()=>{
  assert.equal([...validatePet(draft({name:'🐕'.repeat(100),notes:'Prvi red\nDrugi red'})).name].length,100)
  assert.throws(()=>validatePet(draft({name:'🐕'.repeat(101)})),{code:'PET_INVALID_INPUT'})
})
test('pets: required text, lengths, species and controls are validated',()=>{
  for(const fields of [{name:''},{name:'   '},{name:null},{name:4},{name:'x\t'}, {species:'bird'},
    {breed:'x'.repeat(151)},{notes:'x'.repeat(2001)},{notes:'a\u0000b'},{breed:'a\nb'}]) {
    assert.throws(()=>validatePet(draft(fields)),{code:'PET_INVALID_INPUT'})
  }
})
test('pets: full draft only and identity activation photo fields rejected',()=>{
  for(const body of [null,[],{},'x', {...draft(),salon_id:3},{...draft(),client_id:3},
    {...draft(),active:false},{...draft(),photo_url:'https://example.test/x'}, {...draft(),revision:8}]) {
    assert.throws(()=>validatePet(body),{code:'PET_INVALID_INPUT'})
  }
})
test('pets: positive canonical safe identifiers only',()=>{
  for(const id of [1,'123'])assert.equal(petId(id),Number(id))
  for(const id of [0,-1,'01','1.0','1e2',true,null,[],9007199254740992])assert.throws(()=>petId(id))
})
test('pets: updates require integer revision and explicit boolean status',()=>{
  assert.equal(validatePet(draft({expected_revision:1}),true).expected_revision,1)
  assert.deepEqual(validatePetActive({active:false,expected_revision:2}),{active:false,expected_revision:2})
  for(const r of [0,-1,1.1,'1',null,2147483647])assert.throws(()=>validatePet(draft({expected_revision:r}),true))
  for(const active of [0,1,'true',null])assert.throws(()=>validatePetActive({active,expected_revision:1}))
  assert.throws(()=>validatePetActive({active:true,expected_revision:1,client_id:8}))
})
test('pets: only matching active owner or admin context',()=>{
  for(const role of ['owner','admin'])assert.deepEqual(petContext({...context(),currentMembership:{...context().currentMembership,role}}),{salonId:2,userId:1})
  for(const fields of [{role:'employee'},{active:false},{salonId:3},{userId:8}])assert.throws(()=>petContext({...context(),currentMembership:{...context().currentMembership,...fields}}),{code:'PET_FORBIDDEN'})
  for(const req of [{},{...context(),currentUser:{id:1,active:false}},{...context(),currentSalon:{id:2,active:false}}])assert.throws(()=>petContext(req),{code:'PET_FORBIDDEN'})
})
test('pets API: employee denied on every route, invalid payloads rejected before DB',async()=>{
  for(const role of ['employee','owner','admin']){
    const app=createApp({privateRouteMiddleware:[(req,res,next)=>{Object.assign(req,context());req.currentMembership.role=role;next()}]})
    const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve))
    const base=`http://127.0.0.1:${server.address().port}/api/clients/1/pets`
    try{
      for(const [method,suffix,body] of [['POST','',{...draft(),salon_id:9}],['PUT','/1',draft()],['PATCH','/1/active',{active:'yes'}]]){
        const r=await fetch(base+suffix,{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)})
        assert.equal(r.status,role==='employee'?403:400)
      }
      if(role==='employee')assert.equal((await fetch(base)).status,403)
      else assert.equal((await fetch(base.replace('/1/pets','/bad/pets'))).status,400)
    }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
  }
})
