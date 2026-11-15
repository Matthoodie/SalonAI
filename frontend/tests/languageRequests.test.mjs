import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { requestMessages } from '../src/components/Language/requestMessages.js'
import { requestText, requestError, requestNotice, requestDate, requestTimestamp, requestConfirmation } from '../src/components/Language/requestText.js'
import { requestActions, canCancelRequest, validateRequestDraft, validateCancellationNote } from '../src/pages/TimeOffRequests/timeOffRequestView.js'
import { requestDraftToPayload } from '../src/pages/BlockedTimeRequests/blockedTimeRequestView.js'
test('request language: all API conflict and uncertainty messages are translated', () => {
  for (const file of ['timeOffRequestApi.js','blockedTimeRequestApi.js']) {
    const source=fs.readFileSync(new URL('../src/api/'+file,import.meta.url),'utf8')
    const messages=[...source.matchAll(/'([^'\n]*(?:[čćžšđČĆŽŠĐ]|[A-Z][a-z]+ )[^'\n]*)'/g)].map(m=>m[1])
    for(const message of messages) {
      assert.ok(Object.hasOwn(requestMessages,message),message)
      assert.notEqual(requestError('en',Error(message)),message)
      assert.equal(requestError('hr',Error(message)),message)
    }
  }
})
test('request language: names remain literal in confirmations and destructive consequences remain clear',()=>{
  const name='Odobri ${secret} <script>'
  for(const action of ['approved','rejected','cancel','withdraw']) for(const kind of ['absence','blocked']) {
    const message=requestConfirmation('en',action,kind,name,'1 Jan 2026','2 Jan 2026')
    assert.match(message,/1 Jan 2026 – 2 Jan 2026/)
    if(action!=='withdraw') assert.ok(message.includes(name))
    if(action==='cancel') assert.match(message,/removed from the schedule; the history will be retained/)
  }
})
test('request language: all-day dates retain the calendar day and reject impossible dates',()=>{
  assert.equal(requestDate('en','2024-02-29'),'29 Feb 2024')
  assert.equal(requestDate('hr','2024-02-29'),'29.02.2024.')
  for(const date of ['2023-02-29','2026-13-01','bad'])assert.equal(requestDate('en',date),'—')
})
test('request language: timestamps use salon zone rather than browser locale or UTC',()=>{
  for(const language of ['hr','en'])assert.match(requestTimestamp(language,'2026-01-01T23:30:00Z','Europe/Zagreb'),/00:30/)
  assert.match(requestTimestamp('en','2026-01-01T23:30:00Z','Europe/Zagreb'),/02\/01\/2026/)
  assert.equal(requestTimestamp('en','invalid','Europe/Zagreb'),'—')
  assert.equal(requestTimestamp('en','2026-01-01T00:00:00Z',null),'—')
})
test('request language: DST rejection translates without changing payload conversion',()=>{
  for(const [date,fragment] of [['2026-03-29','does not exist'],['2026-10-25','occurs twice']]) {
    let error
    try{requestDraftToPayload({date,startTime:'02:30',endTime:'04:00',type:'BREAK',note:''},'Europe/Zagreb')}catch(e){error=e}
    assert.ok(error);assert.ok(requestError('en',error).includes(fragment))
  }
  assert.deepEqual(requestDraftToPayload({date:'2026-11-15',startTime:'09:00',endTime:'10:00',type:'BREAK',note:'Ostalo'},'Europe/Zagreb'),{startsAt:'2026-11-15T08:00:00.000Z',endsAt:'2026-11-15T09:00:00.000Z',type:'BREAK',note:'Ostalo'})
})
test('request language: validation remains required and translates independently of draft data',()=>{
  assert.match(requestError('en',validateRequestDraft({startDate:'2026-11-16',endDate:'2026-11-15',type:'vacation',note:''})),/cannot be before/)
  assert.equal(requestError('en',validateCancellationNote(' ')),'Enter a cancellation reason.')
  assert.match(requestError('en',validateCancellationNote('a'.repeat(501))),/500/)
})
test('request language: successful decision plus failed refresh is not a failed mutation',()=>{
  const notice=['Zahtjev je odobren. Odsutnost je spremljena u raspored.','Profil zaposlenika nije osvježen. Osvježite aplikaciju prije uređivanja njegova rasporeda.']
  assert.match(requestNotice('en',notice),/^The request was approved.*profile could not be refreshed/)
  assert.equal(requestNotice('hr',notice),notice.join(' '))
  assert.doesNotMatch(requestError('en',Error('SELECT secret password FROM users')),/SELECT|secret|password/)
})
test('request language: own request permissions and canonical enum values remain intact',()=>{
  const context={current_salon:{id:1},user:{id:2},membership:{id:3,employee_id:4}}
  const row={salon_id:1,requested_by_user_id:2,requester_membership_id:3,employee_id:4,status:'pending'}
  assert.deepEqual(requestActions(row,'salon',context),{withdraw:true,review:false})
  assert.equal(canCancelRequest({...row,status:'approved'},'salon',context),false)
  assert.equal(requestText('en','Na čekanju'),'Pending');assert.equal(row.status,'pending')
})
