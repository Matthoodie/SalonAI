import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeTheme,resolveTheme,readTheme,saveTheme} from '../src/components/Theme/themePreference.js'
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}}
test('appearance: default stays light, invalid persisted values fall back',()=>{assert.equal(normalizeTheme(null),'light');assert.equal(normalizeTheme('invalid'),'light');assert.equal(readTheme(storage(),1),'light')})
test('appearance: explicit preference wins over device mode',()=>{assert.equal(resolveTheme('light',true),'light');assert.equal(resolveTheme('dark',false),'dark')})
test('appearance: system follows device changes',()=>{assert.equal(resolveTheme('system',false),'light');assert.equal(resolveTheme('system',true),'dark')})
test('appearance: users stay isolated and reopening restores choice',()=>{const s=storage();assert.equal(saveTheme(s,1,'dark'),true);assert.equal(readTheme(s,2),'light');assert.equal(readTheme(s,1),'dark');saveTheme(s,2,'system');assert.equal(readTheme(s,1),'dark');assert.equal(readTheme(s,2),'system')})
test('appearance: denied storage does not crash and reports failure',()=>{const s={getItem(){throw Error()},setItem(){throw Error()}};assert.equal(readTheme(s,1),'light');assert.equal(saveTheme(s,1,'dark'),false)})
test('appearance: guest and unsupported choices are not stored',()=>{const s=storage();assert.equal(saveTheme(s,null,'dark'),false);assert.equal(saveTheme(s,1,'broken'),false);assert.equal(readTheme(s,1),'light')})
