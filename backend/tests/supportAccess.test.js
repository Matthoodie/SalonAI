import test from 'node:test'
import assert from 'node:assert/strict'
import {accessChange,clerkSubject,hasSupportAccess,parseSupportAccessArgs} from '../src/utils/supportAccess.js'
const subject='user_Test123',user={id:'7',active:true,auth_provider:'clerk',auth_subject:subject},grant={user_id:'7',auth_subject:subject,enabled:true,revision:1}
const change=(extra={})=>({subject,action:'grant',expectedRevision:0,reason:'Controlled test access',...extra})
test('active exact identity with explicit platform grant is permitted',()=>assert.equal(hasSupportAccess(user,grant),true))
for(const role of ['owner','admin','employee'])test('salon '+role+' does not grant platform access',()=>assert.equal(hasSupportAccess({...user,role,permissions:{support:true}},null),false))
for(const [name,u,g] of [['inactive account',{...user,active:false},grant],['revoked grant',user,{...grant,enabled:false}],['identity rebound',{...user,auth_subject:'user_Other'},grant],['another user',user,{...grant,user_id:'8'}],['non Clerk account',{...user,auth_provider:'local'},grant],['truthy enabled',user,{...grant,enabled:1}],['missing user',null,grant]])test(name+' denied',()=>assert.equal(hasSupportAccess(u,g),false))
test('only canonical Clerk subjects accepted; email is not an identity selector',()=>{
 for(const value of ['a@example.test','user_',' user_Test','user_abc-def',7])assert.throws(()=>clerkSubject(value),{code:'SUPPORT_ACCESS_INVALID'})
 assert.equal(clerkSubject(subject),subject)
})
test('change trims reason and rejects unrecognized actor, role or target fields',()=>{
 assert.equal(accessChange(change({reason:'  Controlled test access  '})).reason,'Controlled test access')
 for(const patch of [{actor:'owner'},{user_id:2},{role:'admin'},{action:'delete'},{expectedRevision:-1},{expectedRevision:0.5},{expectedRevision:2147483647},{reason:'short'},{reason:'line\nbreaks not allowed'},{reason:'x'.repeat(501)},{reason:'unpaired \ud800 value'}])assert.throws(()=>accessChange(change(patch)),{code:'SUPPORT_ACCESS_INVALID'})
})
test('CLI inspect is read-only with mandatory database and exact subject',()=>{
 assert.deepEqual(parseSupportAccessArgs(['inspect','--database','salonai_dev','--clerk-user-id',subject]),{action:'inspect',subject,database:'salonai_dev',apply:false})
 assert.throws(()=>parseSupportAccessArgs(['inspect','--database','salonai_dev','--clerk-user-id',subject,'--apply']))
})
test('CLI grant is preview by default; explicit apply is required',()=>{
 const args=['grant','--database','salonai_dev','--clerk-user-id',subject,'--expected-revision','0','--reason','Controlled test access']
 assert.equal(parseSupportAccessArgs(args).apply,false);assert.equal(parseSupportAccessArgs([...args,'--apply']).apply,true)
})
test('CLI rejects missing, repeated, unknown and ambiguous options',()=>{
 for(const args of [[],['inspect'],['inspect','--database','a','--database','b','--clerk-user-id',subject],['inspect','--database','a','--clerk-user-id',subject,'--email','x'],['revoke','--database','a','--clerk-user-id',subject,'--expected-revision','01','--reason','Controlled revoke'],['grant','--database','a','--clerk-user-id',subject,'--expected-revision','0','--reason','Controlled grant','--apply','--apply']])assert.throws(()=>parseSupportAccessArgs(args))
})

test('malformed IDs or missing revision fail closed',()=>{
 for(const [u,g] of [[{...user,id:undefined},{...grant,user_id:undefined}],[user,{...grant,revision:undefined}],[user,{...grant,revision:0}]])assert.equal(hasSupportAccess(u,g),false)
})
