import test from 'node:test'
import assert from 'node:assert/strict'
import {replyNotificationPreview,notificationPreviewArgs} from '../src/utils/supportNotification.js'
import {recordReplyNotification} from '../src/repositories/supportNotificationRepository.js'
import {previewSupportNotifications} from '../src/services/supportNotificationPreviewService.js'

test('notification: Croatian preview contains ticket number and no user content',()=>{
 const result=replyNotificationPreview(8,'hr')
 assert.equal(result.subject,'ZRIHTAN: novi odgovor na prijavu #8')
 assert.match(result.text,/Moje prijave/);assert.deepEqual(Object.keys(result),['subject','text'])
})
test('notification: English preview contains English navigation',()=>{
 const result=replyNotificationPreview('8','en');assert.match(result.subject,/new reply/);assert.match(result.text,/My requests/)
})
test('notification: invalid locale rejected instead of silently sending wrong language',()=>{
 for(const lang of [null,'de','EN',''])assert.throws(()=>replyNotificationPreview(1,lang))
})
test('notification: IDs cannot inject headers or markup',()=>{
 for(const id of ['1\r\nBcc: somebody','<a>',0,-1,1.2,'01',Number.MAX_SAFE_INTEGER+1])assert.throws(()=>replyNotificationPreview(id,'en'))
})
test('notification: CLI requires explicit database and only accepts read options',()=>{
 assert.deepEqual(notificationPreviewArgs(['--database','salonai_dev']),{database:'salonai_dev',before:null})
 assert.deepEqual(notificationPreviewArgs(['--before','42','--database','salonai_regression']),{database:'salonai_regression',before:'42'})
})
test('notification: CLI rejects missing duplicate unknown and unsafe arguments',()=>{
 for(const args of [[],['--database'],['--database','salonai_dev','--apply'],['--database','a','--database','b'],['--database','a;drop'],['--database','a','--before','0'],['--send','true']])assert.throws(()=>notificationPreviewArgs(args))
})
test('notification: record uses supplied transaction and parameterized identifiers',async()=>{
 let seen
 const db={query:async(sql,args)=>{seen={sql,args};return {rowCount:1,rows:[{id:'9'}]}}}
 assert.equal(await recordReplyNotification(db,'8','4'),'9')
 assert.deepEqual(seen.args,['4','8']);assert.match(seen.sql,/t.id=\$2/);assert.match(seen.sql,/t.language/)
 assert.doesNotMatch(seen.sql,/ON CONFLICT|email|description|body/)
})
test('notification: missing or mismatched ticket and message fails closed',async()=>{
 await assert.rejects(recordReplyNotification({query:async()=>({rowCount:0,rows:[]})},8,4),/not recorded/)
})
function fixture({name='salonai_dev',rows=[],fail=false}={}) {
 const calls=[]
 const db={query:async(sql,args)=>{
   calls.push({sql,args})
   if(sql.includes('current_database'))return {rows:[{name}]}
   if(sql.includes('FROM support_notification_outbox')){if(fail)throw Error('read failed');return {rows}}
   return {rows:[]}
 },release:()=>calls.push({sql:'release'})}
 return {pool:{connect:async()=>db},calls}
}
test('notification: preview empty queue is read-only and delivery disabled',async()=>{
 const f=fixture(),result=await previewSupportNotifications(f.pool,{database:'salonai_dev'})
 assert.deepEqual(result,{delivery_enabled:false,state:'held',events:[],next_before:null})
 assert.match(f.calls[0].sql,/READ ONLY/);assert.equal(f.calls.at(-2).sql,'COMMIT');assert.equal(f.calls.at(-1).sql,'release')
 assert.ok(f.calls.every(x=>!(/INSERT|UPDATE|DELETE/.test(x.sql))))
})
test('notification: wrong database aborts before reading queue',async()=>{
 const f=fixture();await assert.rejects(previewSupportNotifications(f.pool,{database:'wrong'}),/mismatch/)
 assert.equal(f.calls.at(-2).sql,'ROLLBACK');assert.ok(!f.calls.some(x=>x.sql.includes('FROM support_notification_outbox')))
})
test('notification: queue read failure rolls back and releases connection',async()=>{
 const f=fixture({fail:true});await assert.rejects(previewSupportNotifications(f.pool,{database:'salonai_dev'}),/read failed/)
 assert.equal(f.calls.at(-2).sql,'ROLLBACK');assert.equal(f.calls.at(-1).sql,'release')
})
test('notification: preview bounds page and omits unexpected private fields',async()=>{
 const rows=Array.from({length:21},(_,i)=>({id:String(40-i),ticket_id:'8',message_id:'4',language:'en',created_at:'2026-11-20',email:'PRIVATE',body:'PRIVATE'}))
 const f=fixture({rows}),result=await previewSupportNotifications(f.pool,{database:'salonai_dev',before:'50'})
 assert.equal(result.events.length,20);assert.equal(result.next_before,'21');assert.ok(!JSON.stringify(result).includes('PRIVATE'))
 assert.deepEqual(f.calls.find(x=>x.sql.includes('FROM support_notification_outbox')).args,['50'])
})
test('notification: invalid programmatic options do not connect',async()=>{
 const pool={connect:async()=>assert.fail('must not connect')}
 await assert.rejects(previewSupportNotifications(pool,{database:''}))
 await assert.rejects(previewSupportNotifications(pool,{database:'salonai_dev',before:'-1'}))
})
