import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { assertImportBody, normalizeImportItems, reviewImportRows, priceToCents, canonicalImport } from '../src/utils/serviceImportValidation.js'
const row = (overrides = {}) => ({ row_id: 'r1', name: 'Šišanje', category: 'Kosa', price_eur: '18,50', default_duration_minutes: 30, ...overrides })
const body = items => ({ currency: 'EUR', items })
const invalid = value => assert.throws(() => assertImportBody(value), { code: 'SERVICE_IMPORT_INVALID' })

test('import: decimal prices convert exactly, including zero and PostgreSQL maximum', () => {
  for (const [input, output] of [['18,50',1850],['18.5',1850],['0',0],['0.01',1],[' 25 ',2500],['21474836.47',2147483647]]) assert.equal(priceToCents(input), output)
})
test('import: ambiguous and unsafe prices are not guessed', () => {
  for (const input of ['',null,18.5,'1.234,50','1,234','18 EUR','od 18','18–25','-1','1e2','Infinity','21474836.48']) assert.equal(priceToCents(input),null, String(input))
})
test('import: absent duration remains invalid, never filled automatically', () => {
  for (const duration of [undefined,null,'',0,'0',-1,1.5,'1.5','1e2',true,2147483648]) {
    const [result] = normalizeImportItems([row({ default_duration_minutes: duration })])
    assert.ok(result.issues.some(issue => issue.code === 'INVALID_DURATION'))
  }
})
test('import: positive whole duration and blank category normalize', () => {
  const [result] = normalizeImportItems([row({ category: '  ', default_duration_minutes: '45' })])
  assert.equal(result.default_duration_minutes,45)
  assert.equal(result.category,'Ostalo')
  assert.deepEqual(result.issues,[])
})
test('import: name whitespace and Unicode normalize without losing Croatian letters', () => {
  assert.equal(normalizeImportItems([row({ name: '  S\u030cis\u030canje\n kose ' })])[0].name,'Šišanje kose')
})
test('import: missing and overlong names, categories and control characters are rejected', () => {
  for (const name of ['', ' ', 'a'.repeat(151), '\u0000test', {}, 123]) assert.ok(normalizeImportItems([row({name})])[0].issues.length)
  for (const category of ['a'.repeat(101),{},'\u0000']) assert.ok(normalizeImportItems([row({category})])[0].issues.length)
})
test('import: field limits count Unicode characters rather than UTF16 units', () => {
  assert.equal(normalizeImportItems([row({name:'😀'.repeat(150)})])[0].issues.length,0)
})
test('import: tenant identity, activation and IDs cannot be supplied in imported rows', () => {
  for (const key of ['salon_id','user_id','id','active','price_cents','employee_id']) invalid(body([row({[key]:1})]))
  invalid({...body([row()]),salon_id:10})
})
test('import: only EUR and bounded nonempty item arrays are accepted', () => {
  for (const value of [null,[],{}, {...body([row()]),currency:'HRK'},body([]),body(Array.from({length:101},(_,i)=>row({row_id:`r${i}`})))]) invalid(value)
  assertImportBody(body(Array.from({length:100},(_,i)=>row({row_id:`r${i}`}))))
})
test('import: row IDs are unique and duplicate confirmation is strictly boolean', () => {
  invalid(body([row(),row()]))
  invalid(body([row({row_id:'with space'})]))
  invalid(body([row({allow_duplicate:'true'})]))
})
test('import: confirmation requires a UUIDv4 request ID; preview rejects that field', () => {
  const value = {...body([row()]),request_id:randomUUID()}
  assertImportBody(value,true)
  invalid(value)
  assert.throws(()=>assertImportBody(body([row()]),true))
  assert.throws(()=>assertImportBody({...value,request_id:'not-a-uuid'},true))
})
test('import: same normalized name and category is flagged, including inactive services', () => {
  const [result] = reviewImportRows(normalizeImportItems([row()]),[{id:9,name:' ŠIŠANJE ',category:'KOSA',active:false}])
  assert.equal(result.ready,false)
  assert.equal(result.duplicates[0].kind,'same_name_category')
  assert.equal(result.duplicates[0].active,false)
})
test('import: same name in another category requires explicit review, not automatic merging', () => {
  const [result] = reviewImportRows(normalizeImportItems([row()]),[{id:9,name:'Šišanje',category:'Drugo',active:true}])
  assert.equal(result.ready,false)
  assert.equal(result.duplicates[0].kind,'same_name')
})
test('import: duplicates inside the selected batch are flagged on both rows', () => {
  const results = reviewImportRows(normalizeImportItems([row(),row({row_id:'r2',category:'Drugo'})]),[])
  assert.deepEqual(results.map(r=>r.ready),[false,false])
  assert.deepEqual(results[0].duplicate_row_ids,['r2'])
})
test('import: deliberate duplicates can be confirmed, but invalid fields cannot', () => {
  const catalog = [{id:1,name:'Šišanje',category:'Kosa',active:true}]
  assert.equal(reviewImportRows(normalizeImportItems([row({allow_duplicate:true})]),catalog)[0].ready,true)
  assert.equal(reviewImportRows(normalizeImportItems([row({allow_duplicate:true,default_duration_minutes:''})]),catalog)[0].ready,false)
})
test('import: duplicate details are bounded without hiding total count', () => {
  const [result] = reviewImportRows(normalizeImportItems([row()]),Array.from({length:25},(_,id)=>({id,name:'Šišanje',category:'Kosa',active:true})))
  assert.equal(result.duplicate_count,25)
  assert.equal(result.duplicates.length,20)
})
test('import: canonical replay input ignores equivalent formatting but retains meaningful fields', () => {
  const a = canonicalImport(normalizeImportItems([row()]))
  const b = canonicalImport(normalizeImportItems([row({price_eur:'18.50',name:' Šišanje ',default_duration_minutes:'30'})]))
  assert.deepEqual(a,b)
  assert.notDeepEqual(a,canonicalImport(normalizeImportItems([row({allow_duplicate:true})])))
})
