import test from 'node:test'
import assert from 'node:assert/strict'
import {createCapacityService} from '../src/services/capacityService.js'
import {readCapacitySnapshot,readCapacityAccess} from '../src/repositories/capacityRepository.js'
function fixture(extra={}) {
 const calls=[],db={query:async q=>{calls.push(q);return {rows:[]}},release:()=>calls.push('release')}
 const service=createCapacityService({database:{connect:async()=>db},clock:()=>new Date('2030-01-07T07:00:00Z'),
 readAccess:async(_,ctx)=>{calls.push(ctx);return {timezone:'Europe/Zagreb'}},
 readSnapshot:async(_,salon_id,timezone)=>({salon_id,timezone,employees:[],weekly:[],overrides:[],timeOff:[],blocks:[],appointments:[]}),...extra})
 return {service,calls}
}
test('capacity service: uses read-only repeatable snapshot commits and releases',async()=>{
 const {service,calls}=fixture(),r=await service({salonId:1,userId:2},{days:'7'})
 assert.equal(calls[0],'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.match(calls[1],/statement_timeout/)
 assert.deepEqual(calls[2],{salonId:'1',userId:'2'});assert.deepEqual(calls.slice(-2),['COMMIT','release']);assert.equal(r.salon_id,'1')
})
test('capacity service: revoked DB access prevents all schedule reads and rolls back',async()=>{
 let reads=0;const {service,calls}=fixture({readAccess:async()=>null,readSnapshot:async()=>{reads++}})
 await assert.rejects(service({salonId:1,userId:2}),{code:'CAPACITY_FORBIDDEN'});assert.equal(reads,0);assert.deepEqual(calls.slice(-2),['ROLLBACK','release'])
})
test('capacity service: malformed query is rejected before acquiring a connection',async()=>{
 let connected=false;const {service}=fixture({database:{connect:async()=>{connected=true}}})
 await assert.rejects(service({salonId:1,userId:2},{days:'365'}));assert.equal(connected,false)
})
test('capacity service: failed or timed-out reads do not produce partial metrics',async()=>{
 const {service,calls}=fixture({readSnapshot:async()=>{throw Object.assign(new Error('timeout'),{code:'57014'})}})
 await assert.rejects(service({salonId:1,userId:2}),{code:'CAPACITY_TIMEOUT',statusCode:503});assert.deepEqual(calls.slice(-2),['ROLLBACK','release'])
})
test('capacity repository: every dataset is salon scoped bounded and excludes sensitive columns',async()=>{
 const calls=[],db={query:async(sql,args)=>{calls.push([sql,args]);return {rows:[]}}}
 await readCapacityAccess(db,{salonId:7,userId:9})
 await readCapacitySnapshot(db,'7','UTC',['2030-01-01','2030-01-07'],{starts_at:'2030-01-01T00:00:00Z',ends_at:'2030-01-08T00:00:00Z'})
 assert.equal(calls.length,7)
 for(const [sql,args]of calls){assert.equal(String(args[0]),'7');assert.match(sql,/salon_id=\$1|s.id=\$1/);assert.doesNotMatch(sql,/SELECT\s+\*|photo_data|notes|email/i)}
 for(const [sql]of calls.slice(1))assert.match(sql,/LIMIT (101|25001)/)
 assert.match(calls.at(-1)[0],/r.salon_id=\$1/)
 assert.match(calls[0][0],/s.active AND u.active AND m.active/)
})
test('capacity repository: excess rows fail rather than silently truncating',async()=>{
 await assert.rejects(readCapacitySnapshot({query:async()=>({rows:Array(101).fill({})})},1,'UTC',[],{}),{code:'CAPACITY_LIMIT_EXCEEDED'})
})
