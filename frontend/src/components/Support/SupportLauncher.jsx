import {useEffect,useId,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {useLanguage} from '../Language/LanguageProvider.jsx'
import {supportPage} from '../../api/supportApi.js'
import {supportText} from './supportMessages.js'
import SupportPanel from './SupportPanel.jsx'
import './Support.css'
function AccountSupport({user,salon,page}){
 const {language}=useLanguage(),t=k=>supportText(language,k),titleId=useId(),dialog=useRef(null),trigger=useRef(null)
 const [opened,setOpened]=useState(false),[visited,setVisited]=useState(false),[contextPage,setContextPage]=useState(page??'other')
 useEffect(()=>{if(opened&&!dialog.current.open)dialog.current.showModal()},[opened])
 function open(){setContextPage(page??supportPage(window.location.pathname));setVisited(true);setOpened(true)}
 return <><button ref={trigger} type="button" className="support-launch" aria-haspopup="dialog" onClick={open}>{t('title')}</button>
  {createPortal(<dialog ref={dialog} className="support-dialog" aria-labelledby={titleId} onClose={()=>{setOpened(false);trigger.current?.focus()}}>
   <header className="support-header"><h2 id={titleId}>{t('title')}</h2><button type="button" onClick={()=>dialog.current.close()} aria-label={t('close')}>{t('close')}</button></header>
   {visited&&<SupportPanel user={user} salon={salon} page={contextPage} active={opened} />}
  </dialog>,document.body)}
 </>
}
export default function SupportLauncher(props){
 if(!props.user?.id)return null
 // Account/salon switches unmount all requests and text; only an explicit submitted
 // attempt can be restored from the account-scoped session storage key.
 return <AccountSupport key={`${props.user.id}:${props.salon?.id??'account'}`} {...props}/>
}
