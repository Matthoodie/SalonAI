import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import pool from '../src/database/pool.js'
import {createSupportTicketService} from '../src/services/supportTicketService.js'
import {insertSupportTicket} from '../src/repositories/supportTicketRepository.js'
import {validateSupportTicket,supportRequestHash} from '../src/utils/supportTicketValidation.js'
import {createSupportTicketRouter} from '../src/routes/supportTicketRoutes.js'
import {createApp} from '../src/createApp.js'
after(()=>pool.end())
const service=createSupportTicketService()
const draft=(extra={})=>({request_id:randomUUID(),category:'bug',subject:'Support DB test',description:'Synthetic support request for integration testing.',language:'hr',...extra})
async function fixture(run){
 const users=[],salons=[]
 const id=async(sql,args=[])=>String((await pool.query(sql,args)).rows[0].id)
 try{
  for(let i=0;i<2;i++){const token=randomUUID();users.push(await id("INSERT INTO users(auth_provider,auth_subject,email) VALUES ('clerk',$1,$2) RETURNING id",['support_'+token,token+'@example.test']))}
  for(let i=0;i<2;i++)salons.push(await id("INSERT INTO salons(name,timezone) VALUES ('Support test','Europe/Zagreb') RETURNING id"))
  await pool.query("INSERT INTO salon_memberships(user_id,salon_id,role) VALUES ($1,$3,'owner'),($2,$3,'admin')",[users[0],users[1],salons[0]])
  await run({user:users[0],other:users[1],salon:salons[0],foreignSalon:salons[1]})
 }finally{
  for(const uid of users)await pool.query('DELETE FROM support_tickets WHERE user_id=$1',[uid])
  for(const sid of salons)await pool.query('DELETE FROM salons WHERE id=$1',[sid])
  for(const uid of users)await pool.query('DELETE FROM users WHERE id=$1',[uid])
 }
}
test('support DB: new user without any membership creates and reads account ticket',()=>fixture(async f=>{
 await pool.query('DELETE FROM salon_memberships WHERE user_id=$1',[f.user])
 const {ticket}=await service.create(f.user,draft());assert.equal(ticket.salon_id,null);assert.equal(ticket.status,'open')
 assert.equal((await service.detail(f.user,ticket.id)).subject,'Support DB test')
 assert.equal((await service.list(f.user)).tickets.length,1)
 assert.equal('user_id' in ticket,false);assert.equal('request_hash' in ticket,false)
}))
test('support DB: salon owner or admin cannot read another author ticket',()=>fixture(async f=>{
 const {ticket}=await service.create(f.user,draft({salon_id:f.salon}))
 assert.equal((await service.list(f.other)).tickets.length,0)
 await assert.rejects(service.detail(f.other,ticket.id),{code:'SUPPORT_NOT_FOUND'})
 await assert.rejects(service.detail(f.other,'9007199254740991'),{code:'SUPPORT_NOT_FOUND'})
}))
test('support DB: foreign inactive membership and inactive salon block new tickets',()=>fixture(async f=>{
 await assert.rejects(service.create(f.user,draft({salon_id:f.foreignSalon})),{code:'SUPPORT_SALON_FORBIDDEN'})
 await pool.query('UPDATE salon_memberships SET active=false WHERE user_id=$1',[f.user])
 await assert.rejects(service.create(f.user,draft({salon_id:f.salon})),{code:'SUPPORT_SALON_FORBIDDEN'})
 await pool.query('UPDATE salon_memberships SET active=true WHERE user_id=$1',[f.user])
 await pool.query('UPDATE salons SET active=false WHERE id=$1',[f.salon])
 await assert.rejects(service.create(f.user,draft({salon_id:f.salon})),{code:'SUPPORT_SALON_FORBIDDEN'})
 assert.equal((await service.list(f.user)).tickets.length,0)
}))
test('support DB: inactive user denied even with previously authenticated context',()=>fixture(async f=>{
 const r=await service.create(f.user,draft())
 await pool.query('UPDATE users SET active=false WHERE id=$1',[f.user])
 for(const action of [()=>service.create(f.user,draft()),()=>service.list(f.user),()=>service.detail(f.user,r.ticket.id)])await assert.rejects(action(),{code:'SUPPORT_FORBIDDEN'})
}))
test('support DB: concurrent same-key creates one row; key is scoped by author',()=>fixture(async f=>{
 const body=draft(),results=await Promise.all([service.create(f.user,body),service.create(f.user,body)])
 assert.equal(results[0].ticket.id,results[1].ticket.id);assert.equal(results.filter(r=>!r.replayed).length,1)
 assert.equal((await service.list(f.user)).tickets.length,1)
 const other=await service.create(f.other,body);assert.notEqual(other.ticket.id,results[0].ticket.id)
 await assert.rejects(service.create(f.user,{...body,description:'Changed content with the same request identifier.'}),{code:'SUPPORT_REQUEST_CONFLICT'})
}))
test('support DB: replay remains available after salon membership revoked and quota reached',()=>fixture(async f=>{
 const body=draft({salon_id:f.salon}),first=await service.create(f.user,body)
 for(let i=0;i<4;i++)await service.create(f.user,draft())
 await pool.query('UPDATE salon_memberships SET active=false WHERE user_id=$1',[f.user])
 const replay=await service.create(f.user,body);assert.equal(replay.replayed,true);assert.equal(replay.ticket.id,first.ticket.id)
 assert.equal((await service.detail(f.user,first.ticket.id)).id,first.ticket.id)
 await assert.rejects(service.create(f.user,draft()),{code:'SUPPORT_RATE_LIMITED'})
}))
test('support DB: concurrent different keys cannot exceed five new tickets per hour',()=>fixture(async f=>{
 for(let i=0;i<3;i++)await service.create(f.user,draft())
 const results=await Promise.allSettled(Array.from({length:3},()=>service.create(f.user,draft())))
 assert.equal(results.filter(r=>r.status==='fulfilled').length,2)
 assert.equal(results.find(r=>r.status==='rejected').reason.code,'SUPPORT_RATE_LIMITED')
 assert.equal((await service.list(f.user)).tickets.length,5)
}))
test('support DB: daily quota persists independently of hourly quota',()=>fixture(async f=>{
 for(let i=0;i<20;i++){const body=validateSupportTicket(draft());await insertSupportTicket(pool,f.user,body,supportRequestHash(body))}
 await pool.query("UPDATE support_tickets SET created_at=clock_timestamp()-interval '2 hours' WHERE user_id=$1",[f.user])
 await assert.rejects(service.create(f.user,draft()),{code:'SUPPORT_RATE_LIMITED'})
 await pool.query("UPDATE support_tickets SET created_at=clock_timestamp()-interval '25 hours' WHERE user_id=$1",[f.user])
 assert.equal((await service.create(f.user,draft())).replayed,false)
}))
test('support DB: cursor pagination yields distinct author-scoped pages without descriptions',()=>fixture(async f=>{
 for(let i=0;i<25;i++){const body=validateSupportTicket(draft());await insertSupportTicket(pool,f.user,body,supportRequestHash(body))}
 await service.create(f.other,draft())
 const first=await service.list(f.user);assert.equal(first.tickets.length,20);assert.ok(first.next_before)
 const second=await service.list(f.user,{before:first.next_before});assert.equal(second.tickets.length,5);assert.equal(second.next_before,null)
 assert.equal(new Set([...first.tickets,...second.tickets].map(t=>t.id)).size,25)
 assert.equal(first.tickets.some(t=>'description' in t),false)
}))
test('support DB: database constraint rejects duplicate request and invalid status',()=>fixture(async f=>{
 const body=validateSupportTicket(draft()),r=await service.create(f.user,body)
 await assert.rejects(insertSupportTicket(pool,f.user,body,supportRequestHash(body)),{code:'23505'})
 await assert.rejects(pool.query("UPDATE support_tickets SET status='forged' WHERE id=$1",[r.ticket.id]),{code:'23514'})
 assert.equal((await service.detail(f.user,r.ticket.id)).status,'open')
}))
test('support DB: failed transaction leaves no ticket or quota residue',()=>fixture(async f=>{
 const repo=await import('../src/repositories/supportTicketRepository.js')
 const failing=createSupportTicketService({repo:{...repo,insertSupportTicket:async(...args)=>{await repo.insertSupportTicket(...args);throw Error('simulated post-insert failure')}}})
 const body=draft();await assert.rejects(failing.create(f.user,body),/simulated/)
 assert.equal((await service.list(f.user)).tickets.length,0)
 assert.equal((await service.create(f.user,body)).replayed,false)
}))
test('support API DB: mounted route authenticates author, replays and hides foreign detail',()=>fixture(async f=>{
 const router=createSupportTicketRouter({authenticate:(req,res,next)=>{req.currentUser={id:f.user,active:true};next()}})
 const app=createApp({supportRouter:router}),server=app.listen(0);await new Promise(r=>server.once('listening',r))
 try{
 const url=`http://127.0.0.1:${server.address().port}/api/support/tickets`,body=draft()
 const send=()=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
 const first=await send();assert.equal(first.status,201);assert.equal(first.headers.get('cache-control'),'no-store')
 assert.equal((await send()).status,200)
 const foreign=await service.create(f.other,draft())
 assert.equal((await fetch(url+'/'+foreign.ticket.id)).status,404)
 assert.equal((await (await fetch(url)).json()).data.tickets.length,1)
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
}))
