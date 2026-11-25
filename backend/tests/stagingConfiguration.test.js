import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { inspectStagingConfiguration as inspect } from '../src/utils/stagingConfiguration.js'
const valid = () => ({
 APP_ENV: 'staging', NODE_ENV: 'production',
 DATABASE_URL: 'postgresql://owner:fakePassword@dpg-example-a/zrihtan_staging',
 STAGING_APP_ORIGIN: 'https://zrihtan-staging.onrender.com',
 CLERK_SECRET_KEY: 'sk_test_fakeSecret', CLERK_PUBLISHABLE_KEY: 'pk_test_fakePublic',
 VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_fakePublic',
 STAGING_ALLOWED_CLERK_USER_IDS: 'user_One,user_Two',
})
test('valid staging returns only safe summary', () => {
 const input=valid(); const before=JSON.stringify(input); const result=inspect(input)
 assert.equal(result.ok,true); assert.equal(result.summary.tester_count,2)
 assert.equal(result.summary.port,10000); assert.equal(result.summary.network_requests,0)
 assert.equal(JSON.stringify(input),before)
 for(const secret of ['fakePassword','fakeSecret','user_One','DATABASE_URL']) assert.equal(JSON.stringify(result).includes(secret),false)
})
test('custom staging domain accepted',()=>assert.equal(inspect({...valid(),STAGING_APP_ORIGIN:'https://staging.zrihtan.com'}).ok,true))
test('external Render hostname accepted',()=>assert.equal(inspect({...valid(),DATABASE_URL:'postgresql://a:b@dpg-example-a.frankfurt-postgres.render.com:5432/zrihtan_staging?sslmode=verify-full'}).ok,true))
const cases = [
 ['APP_ENV','production','APP_ENV_MUST_BE_STAGING'],
 ['NODE_ENV','development','NODE_ENV_MUST_BE_PRODUCTION'],
 ['DATABASE_URL','postgresql://a:b@dpg-example-a/salonai_dev','DATABASE_URL_MUST_TARGET_RENDER_STAGING'],
 ['DATABASE_URL','postgresql://a:b@dpg-example-a/salonai_regression','DATABASE_URL_MUST_TARGET_RENDER_STAGING'],
 ['DATABASE_URL','postgresql://a:b@dpg-example-a/zrihtan_production','DATABASE_URL_MUST_TARGET_RENDER_STAGING'],
 ['DATABASE_URL','postgresql://a:b@localhost/zrihtan_staging','DATABASE_URL_MUST_TARGET_RENDER_STAGING'],
 ['DATABASE_URL','postgresql://a:b@dpg-example-a/zrihtan_staging?database=salonai_dev','DATABASE_URL_MUST_TARGET_RENDER_STAGING'],
 ['DATABASE_URL','postgresql://a:b@dpg-example-a/zrihtan_staging?sslmode=disable','DATABASE_URL_MUST_TARGET_RENDER_STAGING'],
 ['DATABASE_URL','postgresql://a:b@dpg-example-a/zrihtan_staging?sslmode=require&sslmode=disable','DATABASE_URL_MUST_TARGET_RENDER_STAGING'],
 ['DATABASE_URL','https://a:b@dpg-example-a/zrihtan_staging','DATABASE_URL_MUST_TARGET_RENDER_STAGING'],
 ['DATABASE_URL','postgresql://a@dpg-example-a/zrihtan_staging','DATABASE_URL_MUST_TARGET_RENDER_STAGING'],
 ['DATABASE_URL','postgresql://a:b@dpg-example-a/zrihtan_staging#fragment','DATABASE_URL_MUST_TARGET_RENDER_STAGING'],
 ['STAGING_APP_ORIGIN','http://staging.zrihtan.com','STAGING_APP_ORIGIN_INVALID'],
 ['STAGING_APP_ORIGIN','https://app.zrihtan.com','STAGING_APP_ORIGIN_INVALID'],
 ['STAGING_APP_ORIGIN','https://localhost','STAGING_APP_ORIGIN_INVALID'],
 ['STAGING_APP_ORIGIN','https://staging.zrihtan.com/api','STAGING_APP_ORIGIN_INVALID'],
 ['STAGING_APP_ORIGIN','https://staging.zrihtan.com?secret=hidden','STAGING_APP_ORIGIN_INVALID'],
 ['STAGING_APP_ORIGIN','https://user:password@staging.zrihtan.com','STAGING_APP_ORIGIN_INVALID'],
 ['CLERK_SECRET_KEY','sk_live_fake','CLERK_TEST_SECRET_REQUIRED'],
 ['CLERK_PUBLISHABLE_KEY','pk_live_fake','CLERK_TEST_PUBLISHABLE_REQUIRED'],
 ['VITE_CLERK_PUBLISHABLE_KEY','pk_test_other','CLERK_PUBLISHABLE_KEYS_MUST_MATCH'],
 ['STAGING_ALLOWED_CLERK_USER_IDS','','STAGING_TESTER_ALLOWLIST_INVALID'],
 ['STAGING_ALLOWED_CLERK_USER_IDS','*','STAGING_TESTER_ALLOWLIST_INVALID'],
 ['STAGING_ALLOWED_CLERK_USER_IDS','user_One,user_One','STAGING_TESTER_ALLOWLIST_INVALID'],
 ['STAGING_ALLOWED_CLERK_USER_IDS','user_One,','STAGING_TESTER_ALLOWLIST_INVALID'],
 ['STAGING_ALLOWED_CLERK_USER_IDS','user_One,email@example.com','STAGING_TESTER_ALLOWLIST_INVALID'],
 ['STAGING_ALLOWED_CLERK_USER_IDS',Array.from({length:21},(_,i)=>'user_'+i).join(','),'STAGING_TESTER_ALLOWLIST_INVALID'],
 ['PORT','80','PORT_INVALID'], ['PORT','65536','PORT_INVALID'], ['PORT','3e3','PORT_INVALID'],
 ['RESEND_API_KEY','re_fake','EMAIL_DELIVERY_CREDENTIALS_NOT_ALLOWED_YET'],
 ['ZRIHTAN_RESEND_API_KEY','re_fake','EMAIL_DELIVERY_CREDENTIALS_NOT_ALLOWED_YET'],
 ['VITE_DATABASE_URL','secret','SECRET_IN_FRONTEND_ENVIRONMENT'],
]
for(const [key,value,code] of cases) test('reject '+key+' / '+code+' / '+String(value).slice(0,45),()=>{
 const result=inspect({...valid(),[key]:value});assert.equal(result.ok,false);assert.ok(result.errors.includes(code))
})
test('empty environment rejected without throwing or printing values',()=>{const r=inspect();assert.equal(r.ok,false);assert.ok(r.errors.length>=7)})
test('malformed credential value is not included in errors',()=>{const r=inspect({...valid(),DATABASE_URL:'very-private-secret'});assert.equal(JSON.stringify(r).includes('very-private-secret'),false)})
const cli=fileURLToPath(new URL('../scripts/staging-config-check.js',import.meta.url))
function run(args, env={}) { return spawnSync(process.execPath,[cli,...args],{encoding:'utf8',env:{...(process.env.SystemRoot ? {SystemRoot:process.env.SystemRoot} : {}),...env}}) }
test('CLI help works without database, Clerk or npm packages',()=>{const r=run(['--help']);assert.equal(r.status,0);assert.match(r.stdout,/offline/)})
test('CLI fails closed with missing environment',()=>{const r=run(['--check-env']);assert.equal(r.status,1);assert.equal(JSON.parse(r.stdout).ok,false)})
test('CLI succeeds offline with synthetic configuration',()=>{const r=run(['--check-env'],valid());assert.equal(r.status,0);assert.equal(JSON.parse(r.stdout).ok,true);assert.equal(r.stdout.includes('fakeSecret'),false)})
test('CLI rejects unsupported arguments',()=>{assert.equal(run(['--send']).status,2);assert.equal(run(['--check-env','--help']).status,2)})
