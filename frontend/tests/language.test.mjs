import test from 'node:test'
import assert from 'node:assert/strict'
import {LANGUAGES,languageKey,normalizeLanguage,readLanguage,saveLanguage} from '../src/components/Language/languagePreference.js'
import {messages} from '../src/components/Language/messages.js'
import {translate} from '../src/components/Language/translate.js'
const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),values}}
test('language: defaults to Croatian and rejects unsupported preferences',()=>{
 for(const value of [undefined,null,'','de','EN',{},0])assert.equal(normalizeLanguage(value),'hr')
 assert.equal(normalizeLanguage('en'),'en');assert.equal(normalizeLanguage('hr'),'hr')
 assert.deepEqual(LANGUAGES,['hr','en'])
})
test('language: saved choice is isolated by account and survives reopening',()=>{
 const s=storage();assert.equal(readLanguage(s,1),'hr');assert.equal(saveLanguage(s,1,'en'),true)
 assert.equal(readLanguage(s,1),'en');assert.equal(readLanguage(s,'1'),'en');assert.equal(readLanguage(s,2),'hr')
 assert.equal(saveLanguage(s,2,'hr'),true);assert.equal(readLanguage(s,1),'en')
 assert.notEqual(languageKey(1),languageKey(2))
})
test('language: guests and invalid choices never write storage',()=>{
 const s=storage();for(const id of [undefined,null,''])assert.equal(saveLanguage(s,id,'en'),false)
 assert.equal(saveLanguage(s,1,'de'),false);assert.equal(s.values.size,0)
})
test('language: denied storage and corrupted preferences are safe',()=>{
 const denied={getItem(){throw Error('denied')},setItem(){throw Error('denied')}}
 assert.equal(readLanguage(denied,1),'hr');assert.equal(saveLanguage(denied,1,'en'),false)
 assert.equal(readLanguage(null,1),'hr');assert.equal(saveLanguage(null,1,'en'),false)
 const s=storage();s.setItem(languageKey(1),'javascript:alert(1)');assert.equal(readLanguage(s,1),'hr')
})
test('language: only language key is changed; theme, salon and drafts are preserved',()=>{
 const s=storage();for(const key of ['salonai:appearance:v1:1','selected-salon','draft'])s.setItem(key,'retained')
 saveLanguage(s,1,'en');assert.equal(s.values.size,4)
 for(const key of ['salonai:appearance:v1:1','selected-salon','draft'])assert.equal(s.getItem(key),'retained')
})
test('language: Croatian and English catalogs have identical nonempty keys',()=>{
 assert.deepEqual(Object.keys(messages.hr).sort(),Object.keys(messages.en).sort())
 for(const lang of LANGUAGES)for(const text of Object.values(messages[lang]))assert.ok(typeof text==='string'&&text.trim())
})
test('language: translation fallback does not expose object prototypes or execute text',()=>{
 assert.equal(translate('en','settings.title'),'Settings');assert.equal(translate('hr','settings.title'),'Postavke')
 assert.equal(translate('unknown','settings.title'),'Postavke')
 assert.equal(translate('en','missing.key'),'missing.key');assert.equal(translate('en','constructor'),'constructor')
 assert.equal(translate('en','<script>alert(1)</script>'),'<script>alert(1)</script>')
})
