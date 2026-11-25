import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createStagingBoundary } from '../src/hosting/stagingBoundary.js'
import { startStagingHttp } from '../src/hosting/stagingLifecycle.js'

const env = {
 APP_ENV: 'staging', NODE_ENV: 'production',
 DATABASE_URL: 'postgresql://test:fake@dpg-example/zrihtan_staging',
 STAGING_APP_ORIGIN: 'https://staging.zrihtan.com',
 CLERK_SECRET_KEY: 'sk_test_fake', CLERK_PUBLISHABLE_KEY: 'pk_test_fake',
 VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_fake', STAGING_ALLOWED_CLERK_USER_IDS: 'user_Matej',
}
async function request({ url='/api/bookings', method='GET', headers={}, auth,
 health=async()=>true, authenticate, getAuth, stopping=false } = {}) {
 let forwarded=0, authCalls=0
 const res={ statusCode:200, headers:{}, headersSent:false,
 setHeader(k,v){this.headers[k]=v}, status(n){this.statusCode=n;return this},
 json(body){this.body=body;this.headersSent=true;return this}, end(){this.headersSent=true;return this} }
 const gate=createStagingBoundary({env, health, isStopping:()=>stopping,
 getAuth:getAuth || (()=>auth), authenticate:authenticate || ((req,res,next)=>{authCalls++;next()})})
 await gate({url,method,headers},res,()=>{forwarded++})
 return {...res,forwarded,authCalls}
}
const token={authorization:'Bearer fake'}
const signed={isAuthenticated:true,userId:'user_Matej',sessionId:'sess_test'}
for (const url of ['/api/bookings','/api/availability','/api/support/operations','/api/support/tickets','/api/auth','/api/invitations','/api/health','/api/salon-onboarding','/api/clients','/api/dashboard/capacity','/unknown']) {
 test('anonymous denied before route '+url,async()=>{
 const r=await request({url});assert.equal(r.statusCode,401);assert.equal(r.forwarded,0);assert.equal(r.authCalls,0)
 })
}
test('allowlisted authenticated session proceeds',async()=>{const r=await request({headers:token,auth:signed});assert.equal(r.forwarded,1)})
test('unlisted user denied',async()=>{const r=await request({headers:token,auth:{...signed,userId:'user_Other'}});assert.equal(r.statusCode,403);assert.equal(r.forwarded,0)})
test('user ID header cannot impersonate',async()=>{const r=await request({headers:{...token,'x-user-id':'user_Matej'},auth:{...signed,userId:'user_Other'}});assert.equal(r.statusCode,403)})
for(const auth of [null,{}, {...signed,isAuthenticated:false},{...signed,sessionId:null},{...signed,userId:null}]) {
 test('invalid session '+JSON.stringify(auth),async()=>{const r=await request({headers:token,auth});assert.equal(r.statusCode,401);assert.equal(r.forwarded,0)})
}
test('Clerk error is sanitized',async()=>{const r=await request({headers:token,authenticate:(req,res,next)=>next(Error('secret'))});assert.equal(r.statusCode,401);assert.equal(JSON.stringify(r.body).includes('secret'),false)})
test('Clerk rejection is sanitized',async()=>{const r=await request({headers:token,authenticate:async()=>{throw Error('secret')}});assert.equal(r.statusCode,401)})
test('getAuth failure denied',async()=>{const r=await request({headers:token,getAuth:()=>{throw Error('secret')}});assert.equal(r.statusCode,401)})
test('cookie alone cannot authenticate',async()=>{const r=await request({headers:{cookie:'__session=fake'},auth:signed});assert.equal(r.statusCode,401)})
test('wrong browser origin denied before auth',async()=>{const r=await request({headers:{...token,origin:'https://evil.example'},auth:signed});assert.equal(r.statusCode,403);assert.equal(r.authCalls,0)})
test('allowed origin receives exact CORS header',async()=>{const r=await request({headers:{...token,origin:env.STAGING_APP_ORIGIN},auth:signed});assert.equal(r.forwarded,1);assert.equal(r.headers['Access-Control-Allow-Origin'],env.STAGING_APP_ORIGIN)})
test('valid preflight does not enter business routes',async()=>{const r=await request({method:'OPTIONS',headers:{origin:env.STAGING_APP_ORIGIN,'access-control-request-method':'POST','access-control-request-headers':'Authorization, Content-Type, X-Salon-Id'}});assert.equal(r.statusCode,204);assert.equal(r.forwarded,0);assert.equal(r.authCalls,0)})
for (const headers of [{},{origin:'https://evil.example','access-control-request-method':'GET'}, {origin:env.STAGING_APP_ORIGIN,'access-control-request-method':'TRACE'}, {origin:env.STAGING_APP_ORIGIN,'access-control-request-method':'GET','access-control-request-headers':'X-User-Id'}]) {
 test('invalid preflight '+JSON.stringify(headers),async()=>{const r=await request({method:'OPTIONS',headers});assert.equal(r.statusCode,403);assert.equal(r.forwarded,0)})
}
test('health public minimal response',async()=>{const r=await request({url:'/healthz'});assert.equal(r.statusCode,200);assert.deepEqual(r.body,{status:'ok'});assert.equal(r.authCalls,0)})
test('health DB unavailable',async()=>{const r=await request({url:'/healthz',health:async()=>false});assert.equal(r.statusCode,503)})
test('health DB error sanitized',async()=>{const r=await request({url:'/healthz',health:async()=>{throw Error('postgresql://secret')}});assert.equal(r.statusCode,503);assert.equal(JSON.stringify(r.body).includes('postgresql'),false)})
for(const url of ['/healthz/','/healthz?x=1','/HEALTHZ','/healthz/api/bookings'])test('no health bypass '+url,async()=>{const r=await request({url});assert.equal(r.statusCode,401)})
test('POST health is protected',async()=>{assert.equal((await request({url:'/healthz',method:'POST'})).statusCode,401)})
test('shutdown health returns 503',async()=>{assert.equal((await request({url:'/healthz',stopping:true})).statusCode,503)})
test('private responses carry no-store and noindex',async()=>{const r=await request();assert.equal(r.headers['Cache-Control'],'no-store');assert.match(r.headers['X-Robots-Tag'],/noindex/)})
test('invalid configuration cannot construct boundary',()=>{assert.throws(()=>createStagingBoundary({env:{}}),/STAGING_CONFIGURATION_INVALID/)})

test('HTTP serves and shutdown closes pool once',async()=>{
 const signals=new EventEmitter();let ended=0;const exits=[]
 const runtime=await startStagingHttp({app:(req,res)=>res.end('ok'), pool:{end:async()=>{ended++}}, port:0,host:'127.0.0.1',signals,log:()=>{},exit:code=>exits.push(code)})
 try {
 const response=await fetch('http://127.0.0.1:'+runtime.server.address().port)
 assert.equal(await response.text(),'ok')
 await Promise.all([runtime.shutdown(),runtime.shutdown()])
 assert.equal(ended,1);assert.deepEqual(exits,[0]);assert.equal(runtime.isStopping(),true)
 assert.equal(signals.listenerCount('SIGTERM'),0)
 }finally{await runtime.shutdown()}
})
test('SIGTERM triggers shutdown and pool cleanup',async()=>{
 const signals=new EventEmitter();let ended=0;let finish
 const done=new Promise(r=>{finish=r})
 const runtime=await startStagingHttp({app:(q,s)=>s.end(),pool:{end:async()=>{ended++}},port:0,host:'127.0.0.1',signals,log:()=>{},exit:finish})
 signals.emit('SIGTERM');assert.equal(await done,0);assert.equal(ended,1);await runtime.shutdown()
})
test('pool shutdown failure exits nonzero',async()=>{
 const exits=[]
 const runtime=await startStagingHttp({app:(q,s)=>s.end(),pool:{end:async()=>{throw Error('secret')}},port:0,host:'127.0.0.1',signals:new EventEmitter(),log:()=>{},exit:c=>exits.push(c)})
 await runtime.shutdown();assert.deepEqual(exits,[1])
})
test('invalid hosting entry exits before dependencies or network',()=>{
 const entry=fileURLToPath(new URL('../src/stagingServer.js',import.meta.url))
 const r=spawnSync(process.execPath,[entry],{encoding:'utf8',env:{SystemRoot:process.env.SystemRoot||'',DATABASE_URL:'secret-value'},timeout:5000})
 assert.equal(r.status,1);assert.match(r.stderr,/STAGING_START_REJECTED/)
 assert.equal(r.stderr.includes('secret-value'),false);assert.equal(r.stderr.includes('ERR_MODULE_NOT_FOUND'),false)
})
