export const accessError = (code,statusCode=400) => Object.assign(new Error('Support access operation failed.'),{code,statusCode})
export function accessId(value){
 if(!['string','number'].includes(typeof value)||!/^[1-9]\d*$/.test(String(value))||!Number.isSafeInteger(Number(value)))throw accessError('SUPPORT_ACCESS_INVALID')
 return String(value)
}
export function clerkSubject(value){
 if(typeof value!=='string'||!/^user_[A-Za-z0-9]{1,128}$/.test(value))throw accessError('SUPPORT_ACCESS_INVALID')
 return value
}
export function accessChange(value){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).some(k=>!['subject','action','expectedRevision','reason'].includes(k)))throw accessError('SUPPORT_ACCESS_INVALID')
 const subject=clerkSubject(value.subject)
 if(!['grant','revoke'].includes(value.action)||!Number.isSafeInteger(value.expectedRevision)||value.expectedRevision<0||value.expectedRevision>=2147483647)throw accessError('SUPPORT_ACCESS_INVALID')
 if(typeof value.reason!=='string')throw accessError('SUPPORT_ACCESS_INVALID')
 const reason=value.reason.trim()
 if([...reason].length<10||[...reason].length>500||/[\u0000-\u001f\u007f]/.test(reason)||/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(reason))throw accessError('SUPPORT_ACCESS_INVALID')
 return {subject,action:value.action,expectedRevision:value.expectedRevision,reason}
}
export function hasSupportAccess(user,grant){
 try {
  return Boolean(user&&grant&&accessId(user.id)===accessId(grant.user_id)&&user.active===true&&user.auth_provider==='clerk'&&clerkSubject(user.auth_subject)===grant.auth_subject&&grant.enabled===true&&Number.isInteger(grant.revision)&&grant.revision>0)
 } catch {return false}
}
// CLI-only parser. No HTTP route imports or accepts administration arguments.
export function parseSupportAccessArgs(args){
 const [action,...rest]=args
 if(!['inspect','grant','revoke'].includes(action))throw accessError('SUPPORT_ACCESS_ARGUMENTS')
 const values={},flags=new Set()
 for(let i=0;i<rest.length;i++){
  const key=rest[i]
  if(key==='--apply'){if(flags.has(key))throw accessError('SUPPORT_ACCESS_ARGUMENTS');flags.add(key);continue}
  if(!['--clerk-user-id','--database','--expected-revision','--reason'].includes(key)||Object.hasOwn(values,key)||i+1>=rest.length||rest[i+1].startsWith('--'))throw accessError('SUPPORT_ACCESS_ARGUMENTS')
  values[key]=rest[++i]
 }
 const subject=clerkSubject(values['--clerk-user-id']),database=values['--database']
 if(typeof database!=='string'||!database.length||database.length>63||/[\u0000-\u001f\u007f]/.test(database))throw accessError('SUPPORT_ACCESS_ARGUMENTS')
 if(action==='inspect'){
  if(flags.size||Object.keys(values).length!==2)throw accessError('SUPPORT_ACCESS_ARGUMENTS')
  return {action,subject,database,apply:false}
 }
 const revision=values['--expected-revision']
 if(typeof revision!=='string'||!/^(0|[1-9]\d*)$/.test(revision))throw accessError('SUPPORT_ACCESS_ARGUMENTS')
 return {...accessChange({subject,action,expectedRevision:Number(revision),reason:values['--reason']}),database,apply:flags.has('--apply')}
}
