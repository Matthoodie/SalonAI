import test from 'node:test'
import assert from 'node:assert/strict'
import {teamText,teamError,teamValidationText,teamMemberQuestion,teamCalendarDate} from '../src/components/Language/teamText.js'
test('team language: known labels translate, unknown content and whitespace remain intact',()=>{
 assert.equal(teamText('en','  Ponedjeljak  '),'  Monday  ')
 assert.equal(teamText('hr','Ponedjeljak'),'Ponedjeljak')
 assert.equal(teamText('en','Maja Horvat'),'Maja Horvat')
 for(const key of ['__proto__','constructor','toString'])assert.equal(teamText('en',key),key)
 assert.equal(teamText('en',null),'')
})
test('team validation: working-day errors retain the affected day and reason',()=>{
 assert.equal(teamValidationText('en','Četvrtak: početak radnog vremena mora biti prije kraja.'),'Thursday: working hours must start before they end.')
 assert.equal(teamValidationText('en','Ponedjeljak: radno vrijeme nije ispravno.'),'Monday: working hours are invalid.')
 assert.equal(teamValidationText('hr','Ponedjeljak: radno vrijeme nije ispravno.'),'Ponedjeljak: radno vrijeme nije ispravno.')
})
test('team validation: override and overlap errors preserve exact calendar date',()=>{
 assert.equal(teamValidationText('en','Za datum 29.02.2028. postoji više posebnih rasporeda.'),'More than one special schedule exists for 29.02.2028.')
 assert.equal(teamValidationText('en','29.02.2028.: posebno radno vrijeme nije ispravno.'),'29.02.2028.: special working hours are invalid.')
 assert.equal(teamValidationText('en','Blokirana vremena za 29.02.2028. ne smiju se preklapati.'),'Blocked periods for 29.02.2028. must not overlap.')
})
test('team dates: date-only display has no UTC conversion or day shift',()=>{
 for(const date of ['2026-03-29','2026-10-25','2028-02-29','2026-12-31']){
 const [y,m,d]=date.split('-');assert.equal(teamCalendarDate('en',date),`${d}/${m}/${y}`);assert.equal(teamCalendarDate('hr',date),`${d}.${m}.${y}.`)
 }
 assert.equal(teamCalendarDate('en',null),'')
})
test('team membership questions: names are literal; distinct role/activity consequences stay explicit',()=>{
 const name='Zaposlenik <script> & Admin';assert.match(teamMemberQuestion('en',name,'role','admin',true),/Grant the administrator role/)
 assert.ok(teamMemberQuestion('en',name,'role','admin',true).includes(name))
 assert.match(teamMemberQuestion('en',name,'role','employee',true),/lose administrator permissions/)
 assert.match(teamMemberQuestion('en',name,'active','employee',false),/existing appointments will be preserved/)
 assert.match(teamMemberQuestion('en',name,'active','employee',true),/status will remain unchanged/)
 assert.match(teamMemberQuestion('hr',name,'active','employee',false),/Izgubit će pristup/)
})
test('team errors: permissions and known transport messages localize without mutating errors',()=>{
 const err=Object.assign(new Error('Samo vlasnik salona može upravljati administratorskim ovlastima.'),{code:'MEMBER_OWNER_REQUIRED',statusCode:403})
 assert.equal(teamError('en',err),'Only the salon owner can manage administrator permissions.')
 assert.equal(err.code,'MEMBER_OWNER_REQUIRED');assert.equal(err.statusCode,403)
 assert.equal(teamError('hr',new Error('Failed to create employee.')),'Zaposlenika trenutno nije moguće dodati.')
})
test('team errors: unknown write result stays uncertain and does not expose raw server content',()=>{
 const err=new Error('SQL password=secret');const message=teamError('en',err)
 assert.ok(!message.includes('secret'));assert.ok(!message.includes('rolled back'))
 assert.match(message,/confirm/i);assert.equal(err.message,'SQL password=secret')
})
test('team labels: request-backed schedule and invitation warnings retain their meaning',()=>{
 assert.equal(teamText('en','Odobreno zahtjevom #'),'Approved through request #')
 assert.match(teamText('en','Ako je kod izgubljen ili je pozivnica istekla, opozovite je i kreirajte novu. Opozivanje pozivnice ne uklanja već prihvaćeno članstvo.'),/does not remove an already accepted membership/)
 assert.equal(teamText('en','Bolovanje'),'Sick leave')
 assert.equal(teamText('en','Privatna obveza'),'Personal commitment')
})
