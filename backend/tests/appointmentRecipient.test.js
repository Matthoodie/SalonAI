import test from 'node:test'
import assert from 'node:assert/strict'
import {parseRecipient,parseRecipientChange,recipientId,validateRecipientBusiness,recipientView} from '../src/utils/appointmentRecipient.js'
import {prepareRecipient} from '../src/services/appointmentRecipientService.js'
import {mapDatabaseError} from '../src/errors/databaseErrorMapper.js'
const change=extra=>({client_id:2,recipient_type:'pet',pet_id:3,expected_recipient_revision:1,...extra})
test('recipient: legacy only when fields omitted, never by explicit null or coercion',()=>{
  assert.deepEqual(parseRecipient({}, {allowLegacy:true}),{recipient_type:null,pet_id:null})
  for(const b of [{},{recipient_type:null},{pet_id:null},{recipient_type:''},{recipient_type:'dog'}])assert.throws(()=>parseRecipient(b))
  for(const b of [{recipient_type:null},{pet_id:null}])assert.throws(()=>parseRecipient(b,{allowLegacy:true}))
})
test('recipient: explicit person/pet normalize and cannot contradict each other',()=>{
  assert.deepEqual(parseRecipient({recipient_type:'pet',pet_id:'3'}),{recipient_type:'pet',pet_id:3})
  assert.deepEqual(parseRecipient({recipient_type:'person'}),{recipient_type:'person',pet_id:null})
  assert.throws(()=>parseRecipient({recipient_type:'person',pet_id:3}))
  assert.throws(()=>parseRecipient({recipient_type:'pet'}))
})
test('recipient: IDs reject coercions fractions overflow leading zero and whitespace',()=>{
  for(const id of [null,undefined,true,false,{},[],0,-1,1.5,'01',' 1','1 ','1e2',Number.MAX_SAFE_INTEGER+1])assert.throws(()=>recipientId(id))
  assert.equal(recipientId('12'),12)
})
test('recipient: update requires integer version and rejects tenant/snapshot injection',()=>{
  assert.deepEqual(parseRecipientChange(change()),change())
  for(const v of [undefined,null,0,-1,1.5,'1',2147483647])assert.throws(()=>parseRecipientChange(change({expected_recipient_revision:v})))
  for(const k of ['salon_id','pet_name','pet_species','pet_breed','employee_id','active'])assert.throws(()=>parseRecipientChange(change({[k]:1})))
})
test('recipient: grooming requires a pet, mixed supports both, hair forbids pets',()=>{
  for(const business of ['grooming','mixed'])assert.doesNotThrow(()=>validateRecipientBusiness('pet',business))
  for(const business of ['hair','other',null,undefined])assert.throws(()=>validateRecipientBusiness('pet',business),{code:'PET_BUSINESS_DISABLED'})
  assert.throws(()=>validateRecipientBusiness('person','grooming'),{code:'APPOINTMENT_PET_REQUIRED'})
  for(const b of ['hair','mixed','other',null])assert.doesNotThrow(()=>validateRecipientBusiness('person',b))
})
function mock({business='grooming',client={id:2,active:true},pet={id:3,name:'Siri',species:'dog',breed:'Ptičar',active:true}}={}) {
  const calls=[]
  return {calls,query:async(sql,args)=>{calls.push({sql,args});return {rows:sql.includes('salon_setup')?(business===undefined?[]:[{business_type:business}]):sql.includes('FROM clients')?(client?[client]:[]):pet?[pet]:[]}}}
}
test('recipient: server snapshot ignores caller labels and locks owner/pet within exact salon',async()=>{
  const db=mock();const r=await prepareRecipient(db,1,2,{recipient_type:'pet',pet_id:3,pet_name:'Injected'})
  assert.deepEqual(r,{recipient_type:'pet',pet_id:3,pet_name:'Siri',pet_species:'dog',pet_breed:'Ptičar'})
  assert.deepEqual(db.calls.at(-1).args,[1,2,3]);assert.match(db.calls.at(-1).sql,/FOR SHARE/)
  assert.ok(db.calls.some(c=>c.sql.includes('FROM clients')&&c.sql.includes('FOR SHARE')))
})
test('recipient: foreign or missing pet, inactive pet/owner cannot be selected',async()=>{
  for(const [config,code] of [[{pet:null},'PET_NOT_FOUND'],[{pet:{active:false}},'PET_INACTIVE'],[{client:null},'CLIENT_NOT_FOUND'],[{client:{active:false}},'CLIENT_INACTIVE']]) {
    await assert.rejects(prepareRecipient(mock(config),1,2,{recipient_type:'pet',pet_id:3}),{code})
  }
})
test('recipient: business gate stops before client and pet reads',async()=>{
  const db=mock({business:'hair'})
  await assert.rejects(prepareRecipient(db,1,2,{recipient_type:'pet',pet_id:3}),{code:'PET_BUSINESS_DISABLED'})
  assert.equal(db.calls.length,1)
})
test('recipient: omitted fields cannot bypass grooming requirement',async()=>{
  const db=mock()
  await assert.rejects(prepareRecipient(db,1,2,{}),{code:'APPOINTMENT_PET_REQUIRED'})
  assert.equal(db.calls.length,1)
})
test('recipient: legacy non-grooming callers remain compatible',async()=>{
  for(const business of ['hair','mixed','other',null]) {
    const db=mock({business});const r=await prepareRecipient(db,1,2,{})
    assert.equal(r.recipient_type,null);assert.equal(r.pet_id,null);assert.equal(db.calls.length,1)
  }
})
test('recipient: person clears all pet fields and does not look up animals',async()=>{
  const db=mock({business:'mixed'});const r=await prepareRecipient(db,1,2,{recipient_type:'person'})
  assert.equal(r.pet_name,null);assert.equal(r.pet_id,null)
  assert.equal(db.calls.some(c=>c.sql.includes('FROM client_pets')),false)
})
test('recipient: calendar projection carries immutable pet labels and revision, no notes',()=>{
  const row={recipient_type:'pet',recipient_revision:2,pet_id:'3',pet_name:'Siri',pet_species:'dog',pet_breed:'Ptičar',notes:'private'}
  assert.deepEqual(recipientView(row),Object.fromEntries(Object.entries(row).filter(([k])=>k!=='notes')))
})
test('recipient: pet overlap and wrong owner map to stable API failures',()=>{
  assert.equal(mapDatabaseError({constraint:'appointments_pet_no_overlap'}).code,'PET_APPOINTMENT_CONFLICT')
  assert.equal(mapDatabaseError({constraint:'appointments_pet_owner_salon_fk'}).status,400)
})
