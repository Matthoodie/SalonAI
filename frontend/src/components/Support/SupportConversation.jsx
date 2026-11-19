import {useEffect,useId,useRef,useState} from 'react'
import {useLanguage} from '../Language/LanguageProvider.jsx'
import {supportConversationApi,supportStatuses} from '../../api/supportConversationApi.js'
import {supportText,supportErrorText} from './supportMessages.js'
import {conversationText} from './conversationMessages.js'
import {operatorStorage,readOperatorPending,saveOperatorPending,clearOperatorPending,newOperatorPayload} from './operatorPending.js'
const forbidden=e=>e?.statusCode===401||e?.code==='SUPPORT_OPERATOR_FORBIDDEN'||e?.code==='SUPPORT_FORBIDDEN'||e?.code==='USER_INACTIVE'
export default function SupportConversation({user,ticketId,operator=false,active=true,api=supportConversationApi,onAccessLost}){
 const {language}=useLanguage(),t=k=>conversationText(language,k),s=k=>supportText(language,k),prefix=useId()
 const [initial]=useState(()=>{try{return {pending:operator?readOperatorPending(operatorStorage(),user.id,ticketId):null,error:null}}catch(error){return {pending:null,error}}})
 const [pending,setPending]=useState(initial.pending),[storageError,setStorageError]=useState(initial.error)
 const [kind,setKind]=useState(initial.pending?.kind??'reply'),[body,setBody]=useState(initial.pending?.body??''),[status,setStatus]=useState(initial.pending?.status??null)
 const [ticket,setTicket]=useState(null),[messages,setMessages]=useState([]),[cursor,setCursor]=useState(null)
 const [readBusy,setReadBusy]=useState(false),[readError,setReadError]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(null),[success,setSuccess]=useState(null),[needsRefresh,setNeedsRefresh]=useState(false)
 const alive=useRef(false),readAbort=useRef(null),sendAbort=useRef(null),sequence=useRef(0),sendGuard=useRef(false),currentActive=useRef(active)
 const accessLost=useRef(onAccessLost);accessLost.current=onAccessLost;currentActive.current=active
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;readAbort.current?.abort();sendAbort.current?.abort()}},[])
 async function load(after=null){
  readAbort.current?.abort();const controller=new AbortController();readAbort.current=controller;const seq=++sequence.current
  setReadBusy(true);setReadError(null)
  try{
   const result=await api.messages(ticketId,{after,operator},controller.signal)
   if(!alive.current||!currentActive.current||controller.signal.aborted||seq!==sequence.current)return
   setTicket(result.ticket);setMessages(old=>after===null?result.messages:[...old,...result.messages.filter(row=>!old.some(x=>x.id===row.id))]);setCursor(result.next_after)
   if(after===null)setNeedsRefresh(false)
  }catch(e){
   if(!alive.current||controller.signal.aborted||seq!==sequence.current)return
   setReadError(e)
   if(forbidden(e)||e.statusCode===404){setTicket(null);setMessages([]);setCursor(null);if(operator&&forbidden(e))accessLost.current?.()}
  }finally{if(alive.current&&!controller.signal.aborted&&seq===sequence.current)setReadBusy(false)}
 }
 useEffect(()=>{
  if(active)load()
  return()=>{readAbort.current?.abort();sequence.current++}
  // Parent keys the component by account, ticket and mode.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[active,api,ticketId,operator])
 useEffect(()=>{
  if(!operator||!body||pending)return
  const warn=e=>{e.preventDefault();e.returnValue=''}
  window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)
 },[operator,body,pending])
 async function submit(event){
  event.preventDefault();if(sendGuard.current||storageError||!ticket||needsRefresh||readBusy)return
  sendGuard.current=true;setBusy(true);setError(null);setSuccess(null)
  try{
   let payload=pending??newOperatorPayload({kind,body,status:status??ticket.status},ticket.revision)
   payload=saveOperatorPending(operatorStorage(),user.id,ticketId,payload);setPending(payload)
   const controller=new AbortController();sendAbort.current=controller
   const result=await api.apply(ticketId,payload,controller.signal)
   if(!alive.current||controller.signal.aborted)return
   setSuccess(result.replayed?'replayed':'saved')
   try{clearOperatorPending(operatorStorage(),user.id,ticketId);setPending(null);setBody('');setStatus(null);setStorageError(null)}catch(e){setStorageError(e)}
   setNeedsRefresh(true)
   if(currentActive.current)await load()
  }catch(e){
   if(!alive.current)return
   setError(e)
   if(forbidden(e)){setTicket(null);setMessages([]);accessLost.current?.()}
   if(['SUPPORT_REVISION_CONFLICT','SUPPORT_STATUS_UNCHANGED'].includes(e.code)){
    // These responses prove this attempt did not commit. Retain editor text, require refresh.
    try{clearOperatorPending(operatorStorage(),user.id,ticketId);setPending(null);setNeedsRefresh(true)}catch(storage){setStorageError(storage)}
   }
  }finally{sendGuard.current=false;if(alive.current)setBusy(false)}
 }
 function discard(){
  if(sendGuard.current||!window.confirm(t('discardConfirm')))return
  try{clearOperatorPending(operatorStorage(),user.id,ticketId);setPending(null);setStorageError(null);setError(null);setSuccess(null);setNeedsRefresh(true)}catch(e){setStorageError(e)}
 }
 const errorText=e=>{
  const map={SUPPORT_REVISION_CONFLICT:'conflict',SUPPORT_STATUS_UNCHANGED:'unchanged',SUPPORT_REQUEST_CONFLICT:'keyConflict',SUPPORT_RATE_LIMITED:'rate',SUPPORT_STORAGE_ERROR:'storage'}
  return map[e?.code]?t(map[e.code]):!e?.statusCode&&!e?.code?t('network'):supportErrorText(language,e)
 }
 const date=value=>new Intl.DateTimeFormat(language==='en'?'en-GB':'hr-HR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))
 const statusText=value=>s(value==='pending'?'pendingStatus':value),shown=pending??{kind,body,status:status??ticket?.status??'open'}
 const locked=busy||Boolean(pending)||Boolean(storageError)
 return <section className="support-conversation" aria-label={t('conversation')} aria-busy={readBusy}>
  <div className="support-actions"><button type="button" disabled={readBusy||busy} onClick={()=>load()}>{t('refresh')}</button></div>
  {readBusy&&<p role="status">{s('loading')}</p>}
  {readError&&<p className="support-error" role="alert">{forbidden(readError)||readError.statusCode===404?supportErrorText(language,readError):t('readError')}</p>}
  {ticket&&<>
   <div className="support-conversation-summary"><span className="support-status">{statusText(ticket.status)}</span><small>{s('updated')}: {date(ticket.updated_at)}</small></div>
   {operator&&<article className="support-original"><h3>#{ticket.id} · {ticket.subject}</h3><p className="support-description">{ticket.description}</p><p className="support-muted">{t('language')}: {s(ticket.language)} · {s(ticket.category)} · {t('revision')}: {ticket.revision}</p></article>}
   <h4>{t('conversation')}</h4>
   {!readBusy&&!readError&&messages.length===0&&<p className="support-empty">{t('noReplies')}</p>}
   <ol className="support-replies">{messages.map(message=><li key={message.id}><div className="support-reply-heading"><strong>{t('support')}</strong><time dateTime={message.created_at}>{date(message.created_at)}</time></div><p className="support-description">{message.body}</p></li>)}</ol>
   {cursor&&<button type="button" disabled={readBusy||busy} onClick={()=>load(cursor)}>{t('more')}</button>}
   {!operator&&<p className="support-muted support-small">{t('readOnly')}</p>}
   {operator&&<form className="support-operator-form" onSubmit={submit} noValidate aria-busy={busy}>
    {success&&<p className="support-success" role="status">{t(success)}</p>}
    {(error||storageError)&&<p className="support-error" role="alert">{errorText(storageError??error)}</p>}
    {pending&&<p className="support-notice">{t('pending')}</p>}
    {needsRefresh&&<p className="support-notice" role="status">{t('refreshRequired')}</p>}
    <label htmlFor={prefix+'-kind'}>{t('action')}</label>
    <select id={prefix+'-kind'} value={shown.kind} disabled={locked} onChange={e=>{setKind(e.target.value);setError(null);setSuccess(null)}}><option value="reply">{t('reply')}</option><option value="status">{t('statusOnly')}</option></select>
    {shown.kind==='reply'&&<><label htmlFor={prefix+'-body'}>{t('body')}</label><textarea id={prefix+'-body'} rows={5} value={shown.body??''} disabled={locked} aria-required="true" aria-invalid={error?.code==='SUPPORT_VALIDATION_ERROR'} aria-describedby={prefix+'-hint'} onChange={e=>{setBody(e.target.value);setError(null);setSuccess(null)}}/><small id={prefix+'-hint'}>{t('hint')} {[...(shown.body??'')].length}/5000</small></>}
    <label htmlFor={prefix+'-status'}>{t('status')}</label><select id={prefix+'-status'} value={shown.status??ticket.status} disabled={locked} onChange={e=>{setStatus(e.target.value);setError(null);setSuccess(null)}}>{supportStatuses.map(value=><option key={value} value={value}>{statusText(value)}</option>)}</select>
    <p className="support-privacy">{s('privacy')}</p><p className="support-small support-muted">{t('draftNote')}</p>
    <div className="support-actions"><button type="submit" className="support-primary" disabled={busy||readBusy||needsRefresh||Boolean(storageError)}>{busy?s('sending'):pending?s('retry'):shown.kind==='reply'?t('send'):t('saveStatus')}</button>{(pending||storageError)&&<button type="button" disabled={busy} onClick={discard}>{t('discard')}</button>}</div>
   </form>}
  </>}
 </section>
}
