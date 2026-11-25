import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { parseStagingMigrationArgs, compareMigrationHistory, runStagingMigrations, verifyStagingMigrationFiles } from '../src/hosting/stagingMigrations.js'
const names=['1787862853498_first','1787863754077_second']
function fake({identity={}, capability={}, history=[], count=0, busy=false, runnerFails=false, incomplete=false, failQuery=false, concurrent=null}={}) {
 const calls=[];let runs=0, applied=[...history],exists=history.length>0,underLock=false
 const client={async query(sql){calls.push(sql)
 if(failQuery && sql.startsWith('SELECT current_database'))throw Error('postgresql://password@private')
 if(sql.startsWith('SELECT current_database'))return {rows:[{database_name:'zrihtan_staging',version_num:'180006',recovery:false,...identity}]}
 if(sql.startsWith('SELECT has_schema'))return {rows:[{schema_usage:true,schema_create:true,database_create:true,extension_available:true,history_exists:exists,...capability}]}
 if(sql.startsWith('SELECT count'))return {rows:[{count}]}
 if(sql.startsWith('SELECT name'))return {rows:applied.map(name=>({name}))}
 if(sql.startsWith('SELECT pg_try')){underLock=true;if(concurrent){applied=concurrent;exists=true}return {rows:[{locked:!busy}]}}
 if(sql.startsWith('SELECT to_regclass'))return {rows:[{history_exists:exists}]}
 return {rows:[]}
 }}
 let options
 const runner=async o=>{runs++;options=o;assert.equal(underLock,true);assert.equal(o.dbClient,client);if(runnerFails)throw Error('secret SQL');applied=incomplete?[names[0]]:[...names];exists=true;return []}
 return {client,runner,calls,get runs(){return runs},get options(){return options}}
}
const run=(f,mode='check')=>runStagingMigrations({mode,client:f.client,runner:f.runner,migrationsDir:'/reviewed/migrations',expectedNames:names})
for(const [args,mode] of [[['--help'],'help'],[['--check'],'check'],[['--apply','--database','zrihtan_staging'],'apply']])test('parse '+args.join(' '),()=>assert.equal(parseStagingMigrationArgs(args).mode,mode))
for(const args of [[],['--apply'],['--down'],['--check','--apply'],['--apply','--database','salonai_dev'],['--apply','--database','salonai_regression'],['--apply','--database','zrihtan_staging','--force']])test('reject args '+args.join(' '),()=>assert.throws(()=>parseStagingMigrationArgs(args),/ARGUMENTS_INVALID/))
test('empty history plans all',()=>assert.deepEqual(compareMigrationHistory(names,[]),names))
test('prefix plans remaining',()=>assert.deepEqual(compareMigrationHistory(names,[names[0]]),[names[1]]))
test('complete history plans none',()=>assert.deepEqual(compareMigrationHistory(names,names),[]))
for(const history of [[names[1]],[names[0],names[0]],['unknown'],[...names,'unknown']])test('reject history '+history.join(','),()=>assert.throws(()=>compareMigrationHistory(names,history),/HISTORY_MISMATCH/))
test('check empty DB never invokes runner or locks or DDL',async()=>{const f=fake();const r=await run(f);assert.equal(r.writes_performed,false);assert.equal(r.pending_count,2);assert.equal(f.runs,0);assert.match(f.calls[0],/READ ONLY/);assert.equal(f.calls.at(-1),'COMMIT');assert.ok(f.calls.every(s=>/^(SELECT|BEGIN|COMMIT)/.test(s)));assert.ok(!f.calls.some(s=>/advisory/.test(s)))})
test('check partial history',async()=>{const r=await run(fake({history:[names[0]]}));assert.equal(r.pending_count,1)})
for(const database_name of ['salonai_dev','salonai_regression','zrihtan_production','other'])test('reject actual DB '+database_name,async()=>{const f=fake({identity:{database_name}});await assert.rejects(run(f,'apply'),/DATABASE_MISMATCH/);assert.equal(f.runs,0);assert.equal(f.calls.at(-1),'ROLLBACK')})
test('reject PG17',async()=>await assert.rejects(run(fake({identity:{version_num:'170006'}}),'apply'),/VERSION_MISMATCH/))
test('reject standby',async()=>await assert.rejects(run(fake({identity:{recovery:true}}),'apply'),/NOT_PRIMARY/))
for(const key of ['schema_usage','schema_create','database_create'])test('reject missing privilege '+key,async()=>{const f=fake({capability:{[key]:false}});await assert.rejects(run(f,'apply'),/PRIVILEGES/);assert.equal(f.runs,0)})
test('reject missing extension',async()=>await assert.rejects(run(fake({capability:{extension_available:false}}),'apply'),/EXTENSION_UNAVAILABLE/))
test('reject untracked schema',async()=>await assert.rejects(run(fake({count:1}),'apply'),/UNTRACKED_SCHEMA/))
test('preflight errors sanitized and rolled back',async()=>{const f=fake({failQuery:true});await assert.rejects(run(f),{message:'STAGING_MIGRATION_PREFLIGHT_FAILED'});assert.equal(f.calls.at(-1),'ROLLBACK')})
test('apply uses same client, transaction and migrator lock',async()=>{const f=fake();const r=await run(f,'apply');assert.equal(r.migrated_count,2);assert.equal(f.runs,1);assert.equal(f.options.singleTransaction,true);assert.equal(f.options.noLock,false);assert.equal(f.options.direction,'up');assert.equal(f.options.databaseUrl,undefined);assert.match(f.calls.at(-1),/pg_advisory_unlock/)})
test('already migrated apply does not invoke runner',async()=>{const f=fake({history:names});const r=await run(f,'apply');assert.equal(r.migrated_count,0);assert.equal(f.runs,0)})
test('concurrent completed migration detected under lock',async()=>{const f=fake({concurrent:names});const r=await run(f,'apply');assert.equal(r.migrated_count,0);assert.equal(f.runs,0)})
test('concurrent invalid history rejected',async()=>{const f=fake({concurrent:['unknown']});await assert.rejects(run(f,'apply'),/HISTORY_MISMATCH/);assert.equal(f.runs,0);assert.match(f.calls.at(-1),/unlock/)})
test('busy migration lock fails without runner',async()=>{const f=fake({busy:true});await assert.rejects(run(f,'apply'),/MIGRATION_BUSY/);assert.equal(f.runs,0);assert.ok(!f.calls.some(s=>/pg_advisory_unlock/.test(s)))})
test('runner error sanitized and lock released',async()=>{const f=fake({runnerFails:true});await assert.rejects(run(f,'apply'),{message:'STAGING_MIGRATION_APPLY_FAILED'});assert.match(f.calls.at(-1),/unlock/)})
test('incomplete final history rejected after apply',async()=>await assert.rejects(run(fake({incomplete:true}),'apply'),/POSTCHECK_FAILED/))
test('unsupported service mode does not query',async()=>{const f=fake();await assert.rejects(run(f,'down'),/ARGUMENTS_INVALID/);assert.equal(f.calls.length,0)})
function fixture(){const dir=mkdtempSync(join(tmpdir(),'zrihtan-migration-test-'));const text='export const up = () => {}\n';const file='1787862853498_example.js';writeFileSync(join(dir,file),text);return {dir,text,file,manifest:{baseline:'abf6707',files:[{file,sha256:createHash('sha256').update(text).digest('hex')}]}}}
for(const variation of ['valid','crlf','changed','extra','missing','traversal','baseline'])test('file manifest '+variation,()=>{const f=fixture();try{
 if(variation==='crlf')writeFileSync(join(f.dir,f.file),f.text.replaceAll('\n','\r\n'))
 if(variation==='changed')writeFileSync(join(f.dir,f.file),'changed')
 if(variation==='extra')writeFileSync(join(f.dir,'unexpected.js'),'')
 if(variation==='missing')rmSync(join(f.dir,f.file))
 if(variation==='traversal')f.manifest.files[0].file='../escape.js'
 if(variation==='baseline')f.manifest.baseline='other'
 if(['valid','crlf'].includes(variation))assert.deepEqual(verifyStagingMigrationFiles(f.dir,f.manifest),['1787862853498_example'])
 else assert.throws(()=>verifyStagingMigrationFiles(f.dir,f.manifest))
 }finally{rmSync(f.dir,{recursive:true,force:true})}})
const script=fileURLToPath(new URL('../scripts/staging-migrate.js',import.meta.url))
const cli=args=>spawnSync(process.execPath,[script,...args],{encoding:'utf8',timeout:5000,env:{SystemRoot:process.env.SystemRoot||'',DATABASE_URL:'postgresql://secret'}})
test('CLI help is offline',()=>{const r=cli(['--help']);assert.equal(r.status,0);assert.match(r.stdout,/read-only/)})
test('CLI check without hosting env rejects before dependencies',()=>{const r=cli(['--check']);assert.equal(r.status,1);assert.match(r.stderr,/CONFIGURATION_REJECTED/);assert.ok(!r.stderr.includes('postgresql://secret'));assert.ok(!r.stderr.includes('ERR_MODULE_NOT_FOUND'))})
test('CLI apply without exact target rejects offline',()=>{const r=cli(['--apply']);assert.equal(r.status,1);assert.match(r.stderr,/ARGUMENTS_INVALID/)})
