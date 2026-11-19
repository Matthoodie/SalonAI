import SupportConversation from './SupportConversation.jsx'
import {useEffect,useId,useRef,useState} from 'react'
import {useLanguage} from '../Language/LanguageProvider.jsx'
import {supportApi} from '../../api/supportApi.js'
import {clearSupportPending,newSupportRequest,readSupportPending,saveSupportPending} from './supportPending.js'
import {supportText,supportErrorText} from './supportMessages.js'
function storage(){try{return window.sessionStorage}catch{return null}}
const empty=()=>({category:'help',subject:'',description:''})
export default function SupportPanel({user,salon=null,page='other',active=true,api=supportApi}){
 const {language}=useLanguage(),t=k=>supportText(language,k),prefix=useId()
 const [initial]=useState(()=>{try{return {pending:readSupportPending(storage(),user.id),error:null}}catch(error){return {pending:null,error}}})
 const [pending,setPending]=useState(initial.pending),[storageError,setStorageError]=useState(initial.error)
 const [draft,setDraft]=useState(()=>initial.pending?{category:initial.pending.category,subject:initial.pending.subject,description:initial.pending.description}:empty())
 const [linkSalon,setLinkSalon]=useState(Boolean(salon)),[tab,setTab]=useState('new'),[busy,setBusy]=useState(false),[error,setError]=useState(null),[success,setSuccess]=useState(null)
 const [rows,setRows]=useState([]),[cursor,setCursor]=useState(null),[readBusy,setReadBusy]=useState(false),[readError,setReadError]=useState(null),[detail,setDetail]=useState(null)
 const alive=useRef(false),sendGuard=useRef(false),sendAbort=useRef(null),readAbort=useRef(null),readSequence=useRef(0),form=useRef(null),detailHeading=useRef(null)
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;sendAbort.current?.abort();readAbort.current?.abort()}},[])
 useEffect(()=>{
  if(!draft.subject&&!draft.description)return
  const warn=e=>{if(!pending){e.preventDefault();e.returnValue=''}}
  window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)
 },[draft.subject,draft.description,pending])
 async function loadPage(before=null){
  readAbort.current?.abort();const controller=new AbortController();readAbort.current=controller
  const seq=++readSequence.current;setReadBusy(true);setReadError(null);setDetail(null)
  try{const result=await api.list(before,controller.signal);if(!alive.current||controller.signal.aborted||seq!==readSequence.current)return
   setRows(old=>before===null?result.tickets:[...old,...result.tickets.filter(row=>!old.some(previous=>previous.id===row.id))]);setCursor(result.next_before)
  }catch(e){if(alive.current&&!controller.signal.aborted&&seq===readSequence.current)setReadError(e)}
  finally{if(alive.current&&!controller.signal.aborted&&seq===readSequence.current)setReadBusy(false)}
 }
 useEffect(()=>{
  if(active&&tab==='mine')loadPage()
  return()=>{readAbort.current?.abort();readSequence.current++}
  // Read operations run only while their tab is visible; language changes preserve state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[active,tab,api])
 async function showDetail(id){
  readAbort.current?.abort();const controller=new AbortController();readAbort.current=controller
  const seq=++readSequence.current;setReadBusy(true);setReadError(null);setDetail(null)
  try{const result=await api.detail(id,controller.signal);if(alive.current&&!controller.signal.aborted&&seq===readSequence.current)setDetail(result)}
  catch(e){if(alive.current&&!controller.signal.aborted&&seq===readSequence.current)setReadError(e)}
  finally{if(alive.current&&!controller.signal.aborted&&seq===readSequence.current)setReadBusy(false)}
 }
 useEffect(()=>{if(detail)detailHeading.current?.focus()},[detail])
 async function submit(event){
  event.preventDefault();if(sendGuard.current||storageError)return
  sendGuard.current=true;setBusy(true);setError(null);setSuccess(null)
  let payload=pending
  try{
   if(!payload)payload=newSupportRequest(draft,{language,salonId:linkSalon?salon?.id??null:null,page})
   // Persist before network I/O; failed persistence must never send an untracked request.
   payload=saveSupportPending(storage(),user.id,payload);setPending(payload)
   const controller=new AbortController();sendAbort.current=controller
   const result=await api.create(payload,controller.signal)
   if(!alive.current||controller.signal.aborted)return
   setSuccess(result)
   try{clearSupportPending(storage(),user.id);setPending(null);setDraft(empty());setStorageError(null)}catch(e){setStorageError(e)}
  }catch(e){if(alive.current){setError(e);if(e.code==='SUPPORT_VALIDATION_ERROR')form.current?.querySelector(`[name="${['subject','description','category'].includes(e.field)?e.field:'subject'}"]`)?.focus()}}
  finally{sendGuard.current=false;if(alive.current)setBusy(false)}
 }
 function discard(){
  if(sendGuard.current||!window.confirm(t('discardConfirm')))return
  try{clearSupportPending(storage(),user.id);setPending(null);setStorageError(null);setError(null);setSuccess(null)}catch(e){setStorageError(e)}
 }
 const locked=busy||Boolean(pending)||Boolean(storageError),shown=pending??draft
 const status=value=>t(value==='pending'?'pendingStatus':value)
 const date=value=>new Intl.DateTimeFormat(language==='en'?'en-GB':'hr-HR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))
 return <div className="support-panel">
  <p className="support-muted">{t('intro')}</p>
  <div className="support-tabs" role="group" aria-label={t('title')}>
   <button type="button" aria-pressed={tab==='new'} onClick={()=>setTab('new')}>{t('new')}</button>
   <button type="button" aria-pressed={tab==='mine'} onClick={()=>setTab('mine')}>{t('mine')}</button>
  </div>
  {tab==='new'?<>
   {success&&<p className="support-success" role="status">{t(success.replayed?'replayed':'saved')} · #{success.ticket.id}</p>}
   {(error||storageError)&&<p className="support-error" id={prefix+'-error'} role="alert">{supportErrorText(language,storageError??error)}</p>}
   {pending&&<div className="support-notice"><p>{t('pending')}</p><p>{t('context')}: {pending.salon_id?`${t('salonId')} #${pending.salon_id}`:t('account')} · {t('savedLanguage')}: {t(pending.language)}</p></div>}
   <form ref={form} onSubmit={submit} noValidate aria-busy={busy}>
    <label htmlFor={prefix+'-category'}>{t('category')}</label>
    <select id={prefix+'-category'} name="category" value={shown.category} disabled={locked} onChange={e=>setDraft({...draft,category:e.target.value})}>
     {['help','bug','idea'].map(value=><option key={value} value={value}>{t(value)}</option>)}
    </select>
    <label htmlFor={prefix+'-subject'}>{t('subject')}</label>
    <input id={prefix+'-subject'} name="subject" value={shown.subject} disabled={locked} aria-required="true" aria-invalid={error?.field==='subject'} aria-describedby={prefix+'-subject-hint'} onChange={e=>{setDraft({...draft,subject:e.target.value});setError(null)}} />
    <small id={prefix+'-subject-hint'}>{t('subjectHint')} {[...shown.subject].length}/160</small>
    <label htmlFor={prefix+'-description'}>{t('description')}</label>
    <textarea id={prefix+'-description'} name="description" rows={7} value={shown.description} disabled={locked} aria-required="true" aria-invalid={error?.field==='description'} aria-describedby={prefix+'-description-hint'} onChange={e=>{setDraft({...draft,description:e.target.value});setError(null)}} />
    <small id={prefix+'-description-hint'}>{t('descriptionHint')} {[...shown.description].length}/5000</small>
    {salon&&!pending&&<label className="support-check"><input type="checkbox" checked={linkSalon} disabled={locked} onChange={e=>setLinkSalon(e.target.checked)} />{t('salon')}: {salon.name}</label>}
    {!salon&&!pending&&<p className="support-muted">{t('account')}</p>}
    <p className="support-privacy">{t('privacy')}</p><p className="support-muted support-small">{t('storageNote')}</p>
    <div className="support-actions"><button className="support-primary" type="submit" disabled={busy||Boolean(storageError)}>{busy?t('sending'):pending?t('retry'):t('send')}</button>
     {(pending||storageError)&&<button type="button" disabled={busy} onClick={discard}>{t('discard')}</button>}
    </div>
   </form>
  </>:<section aria-label={t('mine')} aria-busy={readBusy}>
   <div className="support-actions"><button type="button" onClick={()=>loadPage()} disabled={readBusy}>{detail?t('back'):t('refresh')}</button></div>
   {readBusy&&<p role="status">{t('loading')}</p>}
   {readError&&<p role="alert" className="support-error">{supportErrorText(language,readError)}</p>}
   {detail?<article className="support-detail">
    <h3 ref={detailHeading} tabIndex={-1}>{t('details')} #{detail.id}</h3>
    <h4>{detail.subject}</h4><p className="support-description">{detail.description}</p>
    <dl><dt>{t('category')}</dt><dd>{t(detail.category)}</dd><dt>{t('date')}</dt><dd>{date(detail.created_at)}</dd><dt>{t('context')}</dt><dd>{detail.salon_id?`${t('salonId')} #${detail.salon_id}`:t('account')}</dd><dt>{t('page')}</dt><dd>{t(detail.context.page)}</dd></dl>
    <SupportConversation key={`${user.id}:${detail.id}`} user={user} ticketId={detail.id} active={active&&tab==='mine'} />
   </article>:<>
    {!readBusy&&!readError&&rows.length===0&&<p className="support-empty">{t('empty')}</p>}
    <ul className="support-list">{rows.map(row=><li key={row.id}><button type="button" onClick={()=>showDetail(row.id)} disabled={readBusy}><span className="support-list-title">#{row.id} · {row.subject}</span><span className="support-status">{status(row.status)}</span><small>{t(row.category)} · {date(row.created_at)}</small></button></li>)}</ul>
    {cursor&&<button type="button" onClick={()=>loadPage(cursor)} disabled={readBusy}>{t('more')}</button>}
   </>}
  </section>}
 </div>
}
