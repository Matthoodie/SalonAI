import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {supportOperation,operationQuery,operationHash} from '../src/utils/supportOperations.js'
const draft=()=>({request_id:randomUUID(),expected_revision:1,kind:'reply',body:'Testni odgovor.'})
test('operations: reply normalizes Unicode and CRLF',()=>{
 const d=draft();assert.equal(supportOperation({...d,body:'  Pozdrav\r\n😀  '}).body,'Pozdrav\n😀')
})
test('operations: status accepts only supported states',()=>{
 for(const status of ['open','pending','resolved','closed'])assert.equal(supportOperation({...draft(),kind:'status',body:undefined,status}).status,status)
 assert.throws(()=>supportOperation({...draft(),status:'done'}))
})
test('operations: rejects injected identity revision and unknown fields',()=>{
 for(const key of ['user_id','operator_user_id','salon_id','revision','role','internal'])assert.throws(()=>supportOperation({...draft(),[key]:1}))
})
test('operations: strict revision and UUID',()=>{
 for(const value of [0,-1,1.2,'1',null,2147483647])assert.throws(()=>supportOperation({...draft(),expected_revision:value}))
 for(const value of ['',null,'user_abc'])assert.throws(()=>supportOperation({...draft(),request_id:value}))
})
test('operations: reply limits and invalid Unicode',()=>{
 for(const body of ['', '  ', '\u0000', '\ud800','a'.repeat(5001)])assert.throws(()=>supportOperation({...draft(),body}))
 assert.equal(Array.from(supportOperation({...draft(),body:'😀'.repeat(5000)}).body).length,5000)
})
test('operations: status requires status and forbids body',()=>{
 assert.throws(()=>supportOperation({...draft(),kind:'status'}))
 assert.throws(()=>supportOperation({request_id:randomUUID(),expected_revision:1,kind:'status'}))
})
test('operations: stable hash excludes key but includes ticket and revision',()=>{
 const a=supportOperation(draft()),b={...a,request_id:randomUUID()}
 assert.equal(operationHash('1',a),operationHash(1,b))
 assert.notEqual(operationHash(1,a),operationHash(2,a))
 assert.notEqual(operationHash(1,a),operationHash(1,{...a,expected_revision:2}))
})
test('operations: bounded strict cursors and filters',()=>{
 assert.deepEqual(operationQuery(),{cursor:null,status:null,limit:20})
 assert.deepEqual(operationQuery({after:'2'},true),{cursor:'2',status:null,limit:50})
 for(const query of [{before:'01'},{before:['1']},{status:'unknown'},{limit:1000},{user_id:1}])assert.throws(()=>operationQuery(query))
 assert.throws(()=>operationQuery({before:1},true))
})
