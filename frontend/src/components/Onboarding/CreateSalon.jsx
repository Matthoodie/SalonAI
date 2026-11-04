import {useEffect,useRef,useState} from 'react'
import {creationErrors,focusProblem} from './onboardingPresentation.js'
import './OnboardingWizard.css'
import {onboardingApi,pendingCreation,clearCreation} from '../../api/onboardingApi.js'
export default function CreateSalon({user,onCreated}){
 const [eligible,setEligible]=useState(false),[loaded,setLoaded]=useState(false),[pending,setPending]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[storageFailed,setStorageFailed]=useState(false)
 const [draft,setDraft]=useState({name:'',business_type:'hair',location:'',timezone:'Europe/Zagreb'})
 const [fieldErrors,setFieldErrors]=useState({})
 const edit=(key,value)=>{setDraft(current=>({...current,[key]:value}));setFieldErrors(current=>({...current,[key]:undefined}))}
 const invalid=key=>({id:'creation-'+key,'aria-required':true,'aria-invalid':Boolean(fieldErrors[key]),'aria-describedby':fieldErrors[key]?'creation-'+key+'-error':undefined})
 const hint=key=>fieldErrors[key]&&<span id={'creation-'+key+'-error'} className="onboarding-field-error">{fieldErrors[key]}</span>
 const alive=useRef(false),lock=useRef(false)
 useEffect(()=>{alive.current=true;const c=new AbortController();
  try{const p=pendingCreation(window.localStorage,user.id);if(p){setPending(p);setDraft(p)}}catch{setStorageFailed(true);setError('Lokalno spremljeni zahtjev nije dostupan. Ne šaljite novi zahtjev; osvježite dostupne salone i provjerite pohranu preglednika.')}
  onboardingApi.eligibility(c.signal).then(d=>{if(alive.current){setEligible(d.can_create);setLoaded(true)}}).catch(e=>{if(alive.current&&e.name!=='AbortError'){setError('Provjera mogućnosti kreiranja salona nije dostupna. Pozivnicu možete koristiti neovisno o tome.');setLoaded(true)}})
  return()=>{alive.current=false;c.abort()}
 },[user.id])
 async function submit(e){e.preventDefault();if(lock.current||storageFailed)return;
 if(!pending){const problems=creationErrors(draft);setFieldErrors(problems);const first=Object.keys(problems)[0];if(first){setError('Dopunite označena polja.');focusProblem('creation-'+first);return}}
 lock.current=true;setBusy(true);setError('');try{
   const body=pending||pendingCreation(window.localStorage,user.id,{...draft,request_id:crypto.randomUUID()})
   setPending(body)
   const result=await onboardingApi.create(body)
   if(!alive.current)return
   try{clearCreation(window.localStorage,user.id)}catch{/* Receipt remains safe to replay. */}
   onCreated(result.salon_id)
 }catch(e){if(alive.current)setError(e.message+' Ako rezultat nije potvrđen, osvježite dostupne salone. Ponovni pokušaj šalje isti spremljeni zahtjev.')}
 finally{lock.current=false;if(alive.current)setBusy(false)}}
 if(!loaded)return <p role="status">Provjera mogućnosti otvaranja salona…</p>
 if(!eligible&&!pending)return error?<p role="alert">{error}</p>:null
 return <section className="salon-welcome-panel"><p className="salon-welcome-eyebrow">VAŠ NOVI SALON · KORAK 1 OD 5</p><h2>Kreirajte svoj salon</h2><p>Nakon stvaranja slijedi postavljanje tima, usluga i rasporeda. Podatke ćete moći nastaviti nakon ponovne prijave.</p>
 <form className="onboarding-fields" noValidate onSubmit={submit}><fieldset disabled={busy||!!pending}>
 <label>Naziv salona (obavezno)<input {...invalid('name')} required placeholder={draft.business_type==='grooming'?'npr. Šapica — njega ljubimaca':'npr. Studio Aurora'} maxLength={150} value={draft.name} onChange={e=>edit('name',e.target.value)}/>{hint('name')}</label>
 <label>Djelatnost (obavezno)<select {...invalid('business_type')} value={draft.business_type} onChange={e=>edit('business_type',e.target.value)}><option value="hair">Frizerski salon</option><option value="grooming">Njega ljubimaca — grooming</option><option value="mixed">Više djelatnosti</option><option value="other">Drugo</option></select>{hint('business_type')}</label>
 <label>Lokacija (neobavezno)<input maxLength={250} value={draft.location} onChange={e=>setDraft({...draft,location:e.target.value})}/></label>
 <label>Vremenska zona (obavezno)<input {...invalid('timezone')} required maxLength={100} placeholder="Europe/Zagreb" value={draft.timezone} onChange={e=>edit('timezone',e.target.value)}/>{hint('timezone')}</label><small>Za Hrvatsku: Europe/Zagreb. Zona određuje vrijeme termina.</small>
 </fieldset>{pending&&<p>Podaci poslanog zahtjeva su sačuvani. Najprije provjerite postoji li salon pomoću „Osvježi dostupne salone”.</p>}{error&&<p role="alert">{error}</p>}
 <button className="salon-welcome-primary" disabled={busy||storageFailed} type="submit">{busy?'Stvaranje…':pending?'Ponovi isti zahtjev':'Kreiraj salon i nastavi'}</button></form></section>
}
