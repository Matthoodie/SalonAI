import test from 'node:test'
import assert from 'node:assert/strict'
import { createPetPhotoApi, photoFileError } from '../src/api/petPhotoApi.js'
import { validatePetRow } from '../src/api/petApi.js'
import { createSalonApiContext } from '../src/api/salonApiContext.js'
const pet = { id: '4', client_id: '3', salon_id: '1', name: 'Luna', species: 'dog', breed: '', notes: '', active: true, revision: 2, has_photo: true, photo_version: 1, created_at: '2026-11-11T12:00:00Z', updated_at: '2026-11-11T12:00:00Z' }
const jpeg = new Blob([new Uint8Array([255,216,255,1])], { type: 'image/jpeg' })
const headers = () => new Headers({ 'content-type': 'image/jpeg', 'X-Salon-Id': '1', 'X-Client-Id': '3', 'X-Pet-Id': '4', 'X-Pet-Photo-Version': '1' })
const binary = (extra={}) => ({ ok:true, status:200, headers:headers(), blob:async()=>jpeg, ...extra })
const json = row => ({ ok:true, status:200, json:async()=>({data:row}) })
test('photo UI: empty oversized and unsupported files are rejected', () => {
  assert.equal(photoFileError(jpeg), '')
  for (const file of [null, { size:0,type:'image/jpeg' }, {size:8388609,type:'image/jpeg'}, {size:12,type:'image/svg+xml'}, {size:12,type:'image/heic'}]) assert.ok(photoFileError(file))
})
test('photo API: binary response checks all identity headers before displaying', async () => {
  const api=createPetPhotoApi({request:async(url,opts)=>{assert.equal(url,'/api/clients/3/pets/4/photo?version=1');assert.equal(opts.responseType,'blob');return binary()}})
  assert.equal(await api.load(1,3,pet),jpeg)
  for (const name of ['X-Salon-Id','X-Client-Id','X-Pet-Id','X-Pet-Photo-Version']) {
    const h=headers();h.set(name,'999')
    await assert.rejects(createPetPhotoApi({request:async()=>binary({headers:h})}).load(1,3,pet),{code:'PET_PHOTO_INVALID_RESPONSE'})
  }
})
test('photo API: unsupported MIME invalid signature and oversized response are rejected', async () => {
  for (const blob of [new Blob(['bad!'],{type:'image/jpeg'}),new Blob([jpeg],{type:'image/png'}),new Blob([new Uint8Array(524289)],{type:'image/jpeg'})]) {
    await assert.rejects(createPetPhotoApi({request:async()=>binary({blob:async()=>blob})}).load(1,3,pet),{code:'PET_PHOTO_INVALID_RESPONSE'})
  }
})
test('photo API: upload uses raw file and If-Match without client-supplied metadata', async () => {
  let calls=0
  const api=createPetPhotoApi({request:async(url,opts)=>{
    calls++;assert.equal(opts.method,'PUT');assert.equal(opts.headers['If-Match'],'"2"');assert.equal(opts.body,jpeg)
    assert.equal(opts.headers['Content-Type'],'application/octet-stream')
    return json({...pet,revision:3,photo_version:2})
  }})
  assert.equal((await api.upload(1,3,pet,jpeg)).revision,3);assert.equal(calls,1)
})
test('photo API: invalid upload never sends network request', async () => {
  let calls=0;const api=createPetPhotoApi({request:async()=>{calls++}})
  await assert.rejects(api.upload(1,3,pet,new Blob(['svg'],{type:'image/svg+xml'})))
  await assert.rejects(api.upload(1,3,{...pet,id:'04'},jpeg));assert.equal(calls,0)
})
test('photo API: delete validates revision and photo removal while absent delete is a no-op', async () => {
  const api=createPetPhotoApi({request:async(url,opts)=>{assert.equal(opts.method,'DELETE');assert.equal(opts.body,undefined);return json({...pet,revision:3,photo_version:2,has_photo:false})}})
  assert.equal((await api.remove(1,3,pet)).has_photo,false)
  const absent={...pet,has_photo:false}
  assert.equal((await createPetPhotoApi({request:async()=>json(absent)}).remove(1,3,absent)).revision,2)
})
test('photo API: mismatched mutation response and absent photo metadata fail closed', async () => {
  for (const row of [{...pet,revision:3,photo_version:2,id:'99'}, {...pet,revision:3,photo_version:2,salon_id:'9'}, {...pet,revision:3,photo_version:1}, {...pet,revision:3,photo_version:2,has_photo:false}, {...pet,revision:3,photo_version:undefined}]) {
    await assert.rejects(createPetPhotoApi({request:async()=>json(row)}).upload(1,3,pet,jpeg),{code:'PET_PHOTO_INVALID_RESPONSE'})
  }
})
test('photo API: conflict is explicit and uncertain write is never automatically retried', async () => {
  let calls=0
  await assert.rejects(createPetPhotoApi({request:async()=>{calls++;throw Error('network lost')}}).upload(1,3,pet,jpeg),/network lost/);assert.equal(calls,1)
  await assert.rejects(createPetPhotoApi({request:async()=>({ok:false,status:409,json:async()=>({error:{code:'PET_VERSION_CONFLICT'}})})}).remove(1,3,pet),{code:'PET_VERSION_CONFLICT',statusCode:409})
})
test('photo mapper: metadata excludes bytes and rejects inconsistent types', () => {
  assert.equal(Object.hasOwn(validatePetRow({...pet,photo_data:'secret'},1,3),'photo_data'),false)
  for (const bad of [{has_photo:'true'},{has_photo:null},{photo_version:-1},{photo_version:null},{photo_version:0}]) assert.throws(()=>validatePetRow({...pet,...bad},1,3))
})
test('photo transport: salon switch during binary body read rejects old image', async () => {
  let release,started
  const waiting=new Promise(resolve=>{started=resolve})
  const context=createSalonApiContext({fetchImpl:async()=>({ok:true,status:200,headers:headers(),arrayBuffer:async()=>{started();await new Promise(resolve=>{release=resolve});return jpeg.arrayBuffer()}})})
  context.setSalon(1)
  const loading=createPetPhotoApi({request:context.request}).load(1,3,pet)
  await waiting;context.setSalon(2);release()
  await assert.rejects(loading,{code:'STALE_SALON_CONTEXT'})
})
test('photo transport: delayed blob access after salon switch rejects old image', async () => {
  const context=createSalonApiContext({fetchImpl:async()=>new Response(jpeg,{headers:headers()})})
  context.setSalon(1);const response=await context.request('/api/clients/3/pets/4/photo?version=1',{responseType:'blob'})
  context.setSalon(2);await assert.rejects(response.blob(),{code:'STALE_SALON_CONTEXT'})
})
test('photo transport: JSON errors remain readable for binary requests and custom option is not sent', async () => {
  const context=createSalonApiContext({fetchImpl:async(url,opts)=>{assert.equal(Object.hasOwn(opts,'responseType'),false);return new Response(JSON.stringify({error:{code:'PET_PHOTO_NOT_FOUND'}}),{status:404})}})
  context.setSalon(1);await assert.rejects(createPetPhotoApi({request:context.request}).load(1,3,pet),{statusCode:404,code:'PET_PHOTO_NOT_FOUND'})
})
