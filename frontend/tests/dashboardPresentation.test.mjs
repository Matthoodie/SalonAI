import test from 'node:test'
import assert from 'node:assert/strict'
import {capacityDuration,capacityPages,capacityDay} from '../src/pages/Dashboard/capacityPresentation.js'
import {BUSINESS_CHOICES,businessTypeLabel} from '../src/components/BusinessType/businessTypes.js'
test('capacity presentation: readable durations with minute rollover and sub-minute values',()=>{
 assert.equal(capacityDuration(50*60000),'50 min');assert.equal(capacityDuration(167*3600000+10*60000),'167 h 10 min')
 assert.equal(capacityDuration(3599999),'1 h');assert.equal(capacityDuration(10000),'< 1 min');assert.equal(capacityDuration(0),'0 min');assert.equal(capacityDuration(-1),'—')
})
test('capacity pages: every date appears once for 7 14 and 30 days without overflow',()=>{
 for(const length of [7,14,30]){const dates=Array.from({length},(_,i)=>String(i)),result=[]
  for(let p=0;p<Math.ceil(length/7);p++){const page=capacityPages(dates,p);assert.ok(page.dates.length<=7);result.push(...page.dates)}
  assert.deepEqual(result,dates);assert.equal(capacityPages(dates,999).index,Math.ceil(length/7)-1);assert.equal(capacityPages(dates,-1).index,0)
 }
})
test('capacity day: weighted sums distinguish zero utilization from no capacity',()=>{
 const rows=[{date:'a',hour:8,capacity_ms:100,occupied_ms:50,free_ms:50},{date:'a',hour:9,capacity_ms:300,occupied_ms:0,free_ms:300},{date:'b',hour:8,capacity_ms:0,occupied_ms:0,free_ms:0}]
 const a=capacityDay(rows,'a');assert.equal(a.utilization_percent,12.5);assert.equal(a.free_ms,350);assert.equal(a.cells.length,2)
 assert.equal(capacityDay(rows,'b').utilization_percent,null);assert.equal(capacityDay(rows,'missing').cells.length,0)
})
test('business choices: only hair and grooming offered; legacy values retain distinct labels',()=>{
 assert.deepEqual(BUSINESS_CHOICES,['hair','grooming']);assert.equal(businessTypeLabel('hair'),'Frizerski salon i brijačnice');assert.equal(businessTypeLabel('grooming'),'Ljubimci');assert.equal(businessTypeLabel('grooming','en'),'Pets')
 assert.match(businessTypeLabel('mixed'),/prethodni izbor/);assert.match(businessTypeLabel('other','en'),/previous selection/)
})
