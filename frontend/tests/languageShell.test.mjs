import test from 'node:test'
import assert from 'node:assert/strict'
import {shellText,shellError,permissionQuestion,delegationQuestion,historyTime} from '../src/components/Language/shellText.js'
import {profileView} from '../src/components/Profile/profileView.js'

test('language shell: combined stored notices retranslate without losing either message',()=>{
 const notices=['Postavka već ima odabranu vrijednost.','Neki nespremljeni izbori uklonjeni su jer članstvo ili ovlast uređivanja više nisu dostupni.']
 assert.match(shellText('en',notices),/already has.*Some unsaved/)
 assert.equal(shellText('hr',notices),notices.join(' '))
})
test('language shell: confirmation translates labels but preserves account name',()=>{
 assert.equal(permissionQuestion('en','Kreiranje termina','Zabranjeno','Korisnik'),'Save "Creating appointments: Not allowed" for Korisnik?')
 assert.equal(permissionQuestion('hr','Kreiranje termina','Zabranjeno','Korisnik'),'Spremiti "Kreiranje termina: Zabranjeno" za Korisnik?')
 assert.match(permissionQuestion('en','Pomicanje termina','Naslijedi pravilo uloge','Ana'),/Inherit role rule/)
})
test('language shell: delegation confirmations distinguish grant and revoke',()=>{
 assert.match(delegationQuestion('en','Kreiranje termina',true),/^Allow administrators/)
 assert.match(delegationQuestion('en','Kreiranje termina',false),/^Revoke.*remain unchanged/)
 assert.match(delegationQuestion('hr','Kreiranje termina',true),/^Dopustiti/)
 assert.match(delegationQuestion('hr','Kreiranje termina',false),/^Ukinuti.*nepromijenjene/)
})
test('language shell: errors retranslate and preserve technical properties',()=>{
 const err=Object.assign(new Error('Vlasnik nije dopustio administratorima uređivanje ove postavke.'),{code:'PERMISSION_ADMIN_DELEGATION_REQUIRED',statusCode:403})
 assert.match(shellError('en',err),/owner has not allowed/)
 assert.equal(shellError('hr',err),err.message)
 assert.equal(err.statusCode,403);assert.equal(err.code,'PERMISSION_ADMIN_DELEGATION_REQUIRED')
 assert.match(shellError('en',new TypeError('Failed to fetch')),/could not be confirmed/)
})
test('language shell: unknown and prototype-like strings are not dictionary values',()=>{
 for(const value of ['constructor','__proto__','<script>text</script>'])assert.equal(shellText('en',value),value)
 assert.equal(shellText('en',undefined),'');assert.equal(shellText('unsupported','Postavke'),'Postavke')
 assert.equal(shellText('en','  Otvori navigaciju  '),'  Open navigation  ')
})
test('language shell: localized missing identity never translates real user names',()=>{
 assert.equal(profileView(null,null,'User').name,'User')
 assert.equal(profileView(null,{display_name:'Korisnik'},'User').name,'Korisnik')
 assert.equal(profileView({firstName:'Tim'},null,'User').name,'Tim')
 assert.equal(profileView(null,{email:'x@example.test'},'User').name,'x@example.test')
})
test('language shell: history locale changes presentation, not salon timezone or instant',()=>{
 const instant='2026-11-13T23:30:00Z'
 const en=historyTime('en',instant,'Europe/Zagreb'),hr=historyTime('hr',instant,'Europe/Zagreb')
 assert.match(en,/14\/11\/2026/);assert.match(en,/00:30/);assert.match(hr,/14\. 11\. 2026/);assert.match(hr,/00:30/)
 assert.match(historyTime('en',instant,'UTC'),/13\/11\/2026/)
})
