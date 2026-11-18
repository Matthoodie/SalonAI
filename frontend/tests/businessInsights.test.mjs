import test from 'node:test'
import assert from 'node:assert/strict'
import {businessInsights,capacityInsight} from '../src/pages/Dashboard/businessInsights.js'
const range={from:'2026-11-10',to:'2026-11-16'},zone='Europe/Zagreb',now='2026-11-18T12:00:00Z'
const row=(id,clientId,date,priceCents=100,extra={})=>({id,clientId,startsAt:date+'T12:00:00Z',statusCode:'completed',priceCents,...extra})
const run=rows=>businessInsights(rows,range,zone,now)
test('insights: closed periods use saved service values and percentage',()=>{const v=run([row(1,1,'2026-11-04',100),row(2,1,'2026-11-12',150)]);assert.equal(v.trend.change,50);assert.equal(v.trend.state,'ready');assert.deepEqual(v.trend.previousRange,{from:'2026-11-03',to:'2026-11-09'})})
test('insights: zero baseline never invents percentage growth',()=>{assert.equal(run([row(1,1,'2026-11-12')]).trend.change,null);assert.equal(run([]).trend.state,'empty')})
test('insights: today and future periods suppress growth interpretation',()=>{const r={from:'2026-11-12',to:'2026-11-18'};assert.equal(businessInsights([],r,zone,now).trend.state,'partial')})
test('insights: missing price suppresses trend but not visit evidence',()=>{const v=run([row(1,1,'2026-11-04'),row(2,1,'2026-11-12',null)]);assert.equal(v.trend.state,'missing');assert.equal(v.returning.count,1)})
test('insights: future completed records suppress conclusions',()=>{const v=run([row(1,1,'2026-11-20')]);assert.equal(v.trend.state,'anomaly');assert.equal(v.returning.state,'anomaly')})
test('insights: returning means distinct client with completed visit before period',()=>{const v=run([row(1,'1','2026-11-02'),row(2,1,'2026-11-12',100,{petId:5}),row(3,1,'2026-11-13',100,{petId:6}),row(4,2,'2026-11-12'),row(5,2,'2026-11-14'),row(6,2,'2026-11-01',100,{statusCode:'cancelled'})]);assert.deepEqual(v.returning,{state:'ready',total:2,count:1})})
test('insights: missing historical client identity is not silently ignored',()=>{const v=run([row(1,null,'2026-11-02'),row(2,1,'2026-11-12')]);assert.equal(v.returning.state,'missing')})
test('insights: local date boundary determines earlier visit',()=>{const v=run([row(1,1,'2026-11-09',100,{startsAt:'2026-11-09T23:30:00Z'}),row(2,1,'2026-11-12')]);assert.equal(v.returning.count,0)})
test('insights: malformed and duplicate appointment data reject',()=>{assert.throws(()=>run([row(1,1,'2026-11-12'),row(1,1,'2026-11-12')]));assert.throws(()=>run([row(1,1,'bad')]))})
const report=()=>({totals:{outside_capacity_ms:0,overlapping_booking_ms:0,unusual_status_count:0},dates:['2026-11-18','2026-11-19','2026-11-20','2026-11-21'],heatmap:[{date:'2026-11-18',capacity_ms:3600000,occupied_ms:0,free_ms:3600000},{date:'2026-11-19',capacity_ms:7200000,occupied_ms:0,free_ms:7200000},{date:'2026-11-20',capacity_ms:7200000,occupied_ms:0,free_ms:7200000},{date:'2026-11-21',capacity_ms:0,occupied_ms:0,free_ms:0}]})
test('insights: capacity ranks free duration, resolves ties by date, excludes closed days',()=>{const data=report(),before=JSON.stringify(data);assert.deepEqual(capacityInsight(data).days.map(d=>d.date),['2026-11-19','2026-11-20','2026-11-18']);assert.equal(JSON.stringify(data),before)})
test('insights: capacity distinguishes no capacity from fully booked',()=>{const d=report();d.heatmap=[];assert.equal(capacityInsight(d).state,'empty');d.heatmap=[{date:d.dates[0],capacity_ms:1,occupied_ms:1,free_ms:0}];assert.equal(capacityInsight(d).state,'full')})
test('insights: capacity anomalies suppress suggestions',()=>{for(const key of ['outside_capacity_ms','overlapping_booking_ms','unusual_status_count']){const d=report();d.totals[key]=1;assert.deepEqual(capacityInsight(d),{state:'anomaly',days:[]})}})
