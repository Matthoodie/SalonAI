import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import pool from '../src/database/pool.js'
import { historyCursor, nextHistoryCursor } from '../src/utils/petHistory.js'
import { getPetHistory } from '../src/services/petHistoryService.js'
import { getHistory } from '../src/controllers/petHistoryController.js'
after(()=>pool.end())
const ctx = { salonId:1, userId:2, clientId:3, petId:4 }
const row = { id:'5', cursor_start:'2030-01-02T03:04:05.123456Z' }
test('pet history: cursor preserves microseconds and binds salon, owner and pet',()=>{
  const encoded = nextHistoryCursor(row,ctx)
  assert.deepEqual(historyCursor({cursor:encoded},ctx),{id:5,start:row.cursor_start})
  for(const key of ['salonId','clientId','petId'])assert.throws(()=>historyCursor({cursor:encoded},{...ctx,[key]:99}),{code:'PET_HISTORY_INVALID_CURSOR'})
  assert.equal(historyCursor({},ctx),null)
})
test('pet history: malformed, repeated, extra and impossible cursor values fail closed',()=>{
  for(const query of [{cursor:''},{cursor:[]},{cursor:'!'}, {cursor:'a'.repeat(601)}, {limit:100}, {cursor:Buffer.from('{}').toString('base64url')}]) {
    assert.throws(()=>historyCursor(query,ctx),{code:'PET_HISTORY_INVALID_CURSOR'})
  }
  for(const start of ['2030-02-30T03:04:05.000000Z','2030-01-02T24:04:05.000000Z','2030-01-02T03:04:05Z']) {
    assert.throws(()=>historyCursor({cursor:nextHistoryCursor({...row,start,cursor_start:start},ctx)},ctx),{code:'PET_HISTORY_INVALID_CURSOR'})
  }
})
async function mocked(run, { access=true, business='grooming', client=true, pet=true, rows=[] }={}) {
  const original=pool.connect, calls=[]; let released=0
  pool.connect=async()=>({release(){released++},async query(sql,args){
    calls.push({sql,args})
    if(sql.includes('JOIN salon_memberships'))return {rows:access?[{}]:[]}
    if(sql.includes('FROM salon_setup'))return {rows:[{business_type:business}]}
    if(sql.includes('FROM clients'))return {rows:client?[{active:false}]:[]}
    if(sql.includes('FROM client_pets'))return {rows:pet?[{id:4,active:false}]:[]}
    if(sql.includes('SELECT timezone'))return {rows:[{timezone:'Europe/Zagreb'}]}
    if(sql.includes('FROM appointments a'))return {rows}
    return {rows:[]}
  }})
  try{await run(calls,()=>released)}finally{pool.connect=original}
}
test('pet history: archived owner and pet remain readable; 21st row becomes next cursor',()=>mocked(async(calls,released)=>{
  const result=await getPetHistory(ctx)
  assert.equal(result.appointments.length,20);assert.ok(result.next_cursor)
  assert.equal(historyCursor({cursor:result.next_cursor},ctx).id,20)
  assert.equal(Object.hasOwn(result.appointments[0],'cursor_start'),false)
  const read=calls.find(c=>c.sql.includes('FROM appointments a'))
  assert.deepEqual(read.args,[1,3,4,null,null,21]);assert.match(read.sql,/a.client_id = \$2/)
  assert.equal(calls.at(-1).sql,'COMMIT');assert.equal(released(),1)
},{rows:Array.from({length:21},(_,i)=>({...row,id:String(i+1)}))}))
test('pet history: revoked permission, business, owner or pet stops before history query',async()=>{
  for(const [state,code] of [[{access:false},'PET_FORBIDDEN'],[{business:'hair'},'PET_BUSINESS_DISABLED'],[{client:false},'CLIENT_NOT_FOUND'],[{pet:false},'PET_NOT_FOUND']]) {
    await mocked(async(calls,released)=>{
      await assert.rejects(getPetHistory(ctx),{code})
      assert.equal(calls.some(c=>c.sql.includes('FROM appointments a')),false)
      assert.equal(calls.at(-1).sql,'ROLLBACK');assert.equal(released(),1)
    },state)
  }
})
test('pet history: empty page has no next cursor; cursor is parameterized',()=>mocked(async calls=>{
  const cursor=nextHistoryCursor(row,ctx),result=await getPetHistory(ctx,{cursor})
  assert.deepEqual(result.appointments,[]);assert.equal(result.next_cursor,null)
  assert.deepEqual(calls.find(c=>c.sql.includes('FROM appointments a')).args,[1,3,4,row.cursor_start,5,21])
}))
test('pet history controller: no cache and forbidden employee cannot reach database',async()=>{
  let error,cache
  await getHistory({currentUser:{id:2,active:true},currentSalon:{id:1},currentMembership:{salonId:1,userId:2,active:true,role:'employee'},params:{clientId:'3',petId:'4'},query:{}},
    {set:(key,value)=>{cache=value},json:()=>assert.fail('forbidden response')},e=>{error=e})
  assert.equal(cache,'no-store');assert.equal(error.code,'PET_FORBIDDEN')
})
