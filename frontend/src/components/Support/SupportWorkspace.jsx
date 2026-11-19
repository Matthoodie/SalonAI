import {useEffect,useRef,useState} from 'react'
import {useLanguage} from '../Language/LanguageProvider.jsx'
import {supportConversationApi} from '../../api/supportConversationApi.js'
import {conversationText} from './conversationMessages.js'
import SupportPanel from './SupportPanel.jsx'
import SupportOperatorPanel from './SupportOperatorPanel.jsx'
import './SupportConversation.css'
export default function SupportWorkspace({user,salon,page,active,api=supportConversationApi}){
 const {language}=useLanguage(),t=k=>conversationText(language,k)
 const [allowed,setAllowed]=useState(false),[mode,setMode]=useState('personal'),[checkError,setCheckError]=useState(false),[denied,setDenied]=useState(false),[retry,setRetry]=useState(0)
 const abort=useRef(null)
 useEffect(()=>{
  const controller=new AbortController();abort.current=controller
  setAllowed(false);setMode('personal');setCheckError(false)
  if(active){api.access(controller.signal).then(()=>{if(!controller.signal.aborted){setAllowed(true);setDenied(false)}}).catch(error=>{if(!controller.signal.aborted)setCheckError(error.statusCode!==401&&error.statusCode!==403)})}
  return()=>controller.abort()
 },[active,api,retry])
 function loseAccess(){abort.current?.abort();setAllowed(false);setMode('personal');setDenied(true)}
 return <>
  {(allowed||checkError||denied)&&<div className="support-workspace-toolbar">
   {allowed&&<div className="support-tabs" role="group" aria-label={t('operator')}><button type="button" aria-pressed={mode==='personal'} onClick={()=>setMode('personal')}>{t('personal')}</button><button type="button" aria-pressed={mode==='operator'} onClick={()=>setMode('operator')}>{t('operator')}</button></div>}
   {checkError&&<><p className="support-muted">{t('accessError')}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>{t('checkAccess')}</button></>}
   {denied&&<p className="support-error" role="alert">{t('denied')}</p>}
  </div>}
  <div hidden={mode!=='personal'}><SupportPanel user={user} salon={salon} page={page} active={active&&mode==='personal'}/></div>
  {active&&allowed&&mode==='operator'&&<SupportOperatorPanel user={user} api={api} onAccessLost={loseAccess}/>}
 </>
}
