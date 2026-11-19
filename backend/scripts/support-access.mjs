import pg from 'pg'
import {parseSupportAccessArgs} from '../src/utils/supportAccess.js'
import {createSupportAccessService} from '../src/services/supportAccessService.js'
const usage='inspect|grant|revoke --database NAZIV --clerk-user-id user_ID [--expected-revision N --reason "Razlog promjene" [--apply]]'
let pool
try{
 const args=parseSupportAccessArgs(process.argv.slice(2))
 if(!process.env.DATABASE_URL)throw Object.assign(new Error(),{code:'SUPPORT_ACCESS_DATABASE'})
 pool=new pg.Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000,max:1})
 const service=createSupportAccessService({dbPool:pool})
 const result=args.action==='inspect'?await service.inspect(args.subject,args.database):await service.change({subject:args.subject,action:args.action,expectedRevision:args.expectedRevision,reason:args.reason},{database:args.database,apply:args.apply})
 console.log(JSON.stringify(result,null,2))
 if(args.action!=='inspect')console.log(args.apply?'Operacija zavrsena. Samo stvarna promjena stvara audit zapis.':'Samo pregled plana. Nista nije promijenjeno; --apply je potreban za upis.')
}catch(error){
 const allowed=['SUPPORT_ACCESS_ARGUMENTS','SUPPORT_ACCESS_INVALID','SUPPORT_ACCESS_DATABASE','SUPPORT_ACCESS_TARGET_NOT_FOUND','SUPPORT_ACCESS_TARGET_INACTIVE','SUPPORT_ACCESS_REVISION_CONFLICT']
 console.error('Provjera nije uspjela. Kod:',allowed.includes(error.code)?error.code:'SUPPORT_ACCESS_FAILED')
 console.error('Upotreba:',usage)
 process.exitCode=1
}finally{if(pool)await pool.end()}
