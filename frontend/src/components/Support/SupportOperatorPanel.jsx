import {useEffect,useId,useRef,useState} from 'react'
import {useLanguage} from '../Language/LanguageProvider.jsx'
import {supportConversationApi,supportStatuses} from '../../api/supportConversationApi.js'
import {supportText,supportErrorText} from './supportMessages.js'
import {conversationText} from './conversationMessages.js'
import SupportConversation from './SupportConversation.jsx'
export default function SupportOperatorPanel({user,api=supportConversationApi,onAccessLost}){
 const {language}=useLanguage(),t=k=>conversationText(language,k),s=k=>supportText(language,k),prefix=useId()
 const [filter,setFilter]=useState(''),[rows,setRows]=useState([]),[cursor,setCursor]=useState(null),[selected,setSelected]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(null)
 const alive=useRef(false),abort=useRef(null),sequence=useRef(0),heading=useRef(null),lost=useRef(onAccessLost);lost.current=onAccessLost
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;abort.current?.abort()}},[])
 async function load(before=null){
  abort.current?.abort();const controller=new AbortController();abort.current=controller;const seq=++sequence.current
  setBusy(true);setError(null)
  if(before===null){setRows([]);setCursor(null)}
  try{const result=await api.list({before,status:filter||null},controller.signal)
   if(!alive.current||controller.signal.aborted||seq!==sequence.current)return
   setRows(old=>before===null?result.tickets:[...old,...result.tickets.filter(row=>!old.some(x=>x.id===row.id))]);setCursor(result.next_before)
  }catch(e){if(alive.current&&!controller.signal.aborted&&seq===sequence.current){setError(e);if(e.statusCode===401||e.statusCode===403){setRows([]);setSelected(null);lost.current?.()}}}
  finally{if(alive.current&&!controller.signal.aborted&&seq===sequence.current)setBusy(false)}
 }
 useEffect(()=>{
  if(!selected)load()
  return()=>{abort.current?.abort();sequence.current++}
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[filter,selected,api])
 useEffect(()=>{heading.current?.focus()},[selected])
 return <section className="support-panel support-operator-panel">
  <h3 ref={heading} tabIndex={-1}>{t('operator')}</h3><p className="support-muted">{t('operatorIntro')}</p>
  {selected?<><button type="button" onClick={()=>setSelected(null)}>{s('back')}</button><SupportConversation key={`${user.id}:${selected}`} user={user} ticketId={selected} operator api={api} onAccessLost={onAccessLost}/></>:<>
   <label htmlFor={prefix+'-filter'}>{t('filter')}</label><select id={prefix+'-filter'} value={filter} onChange={e=>setFilter(e.target.value)}><option value="">{t('all')}</option>{supportStatuses.map(value=><option key={value} value={value}>{s(value==='pending'?'pendingStatus':value)}</option>)}</select>
   <div className="support-actions"><button type="button" onClick={()=>load()} disabled={busy}>{s('refresh')}</button></div>
   {busy&&<p role="status">{s('loading')}</p>}{error&&<p role="alert" className="support-error">{supportErrorText(language,error)}</p>}
   {!busy&&!error&&rows.length===0&&<p className="support-empty">{t('empty')}</p>}
   <ul className="support-list">{rows.map(row=><li key={row.id}><button type="button" disabled={busy} onClick={()=>setSelected(row.id)}><span className="support-list-title">#{row.id} · {row.subject}</span><span className="support-status">{s(row.status==='pending'?'pendingStatus':row.status)}</span><small>{s(row.category)} · {s(row.language)} · {new Intl.DateTimeFormat(language==='en'?'en-GB':'hr-HR',{dateStyle:'medium'}).format(new Date(row.created_at))}</small></button></li>)}</ul>
   {cursor&&<button type="button" disabled={busy} onClick={()=>load(cursor)}>{s('more')}</button>}
  </>}
 </section>
}
