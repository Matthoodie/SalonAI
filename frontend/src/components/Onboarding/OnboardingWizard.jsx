import {useLanguage} from '../Language/LanguageProvider'
import {flowText,flowError,flowStepTitle} from '../Language/flowText.js'
import {LanguageProvider} from '../Language/LanguageProvider'
import LanguageSelector from '../Language/LanguageSelector'
import {lazy,Suspense,useEffect,useRef,useState} from 'react'
import {useClerk} from '@clerk/react-router'
import {salonSetupApi} from '../../api/salonSetupApi.js'
import {onboardingApi} from '../../api/onboardingApi.js'
import {fetchServices} from '../../api/serviceApi'
import {fetchEmployees} from '../../api/employeeApi'
import {mapServicesToFrontend} from '../../api/serviceMapper'
import {mapEmployeesToFrontend} from '../../api/employeeMapper'
import './OnboardingWizard.css'
import {focusProblem,stepErrors,serviceExamples} from './onboardingPresentation.js'
const Services=lazy(()=>import('../../pages/Services/Services'))
const Employees=lazy(()=>import('../../pages/Employees/Employees'))
const steps=['salon','team','services','schedule','review']
const labels=['Salon','Tim','Usluge','Raspored','Pregled']
function OnboardingWizardContent({authContext,onRefresh,workspaces=[],onSelect,api=onboardingApi,setupApi=salonSetupApi}){
 const {language} = useLanguage()
 const f = source => flowText(language,source)
 const {current_salon:salon,user,membership}=authContext
 const clerk=useClerk(),owner=membership.role==='owner'
 const [data,setData]=useState(null),[step,setStep]=useState('salon'),[services,setServices]=useState([]),[employees,setEmployees]=useState([])
 const [review,setReview]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[locked,setLocked]=useState(false),[reload,setReload]=useState(0)
 const [fieldErrors,setFieldErrors]=useState({})
 const [completedSalonId,setCompletedSalonId]=useState(null)
 const finished=String(completedSalonId)===String(salon.id)
 const alive=useRef(false),guard=useRef(false),heading=useRef(null),leaving=useRef(false)
 useEffect(()=>{alive.current=true;const c=new AbortController();
  if(owner){setBusy(true);setLocked(true);setError('');Promise.all([setupApi.load(salon.id,c.signal),fetchServices(),fetchEmployees()]).then(([d,s,e])=>{
   if(c.signal.aborted)return;setData(d);setStep(steps.includes(d.setup.last_step)?d.setup.last_step:'salon');setServices(mapServicesToFrontend(s));setEmployees(mapEmployeesToFrontend(e,salon.timezone));setLocked(false)
  }).catch(e=>{if(!c.signal.aborted)setError(e)}).finally(()=>{if(!c.signal.aborted)setBusy(false)})}
  const warn=e=>{if(!leaving.current){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',warn)
  return()=>{alive.current=false;c.abort();window.removeEventListener('beforeunload',warn)}
 },[salon.id,owner,reload,setupApi,salon.timezone])
 useEffect(()=>{heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'start',behavior:'instant'})},[step,finished])
 async function signOut(){if(guard.current||(!finished&&!window.confirm(f('Spremite otvorene obrasce prije odjave. Odjaviti se?'))))return;try{leaving.current=true;await clerk.signOut({redirectUrl:'/'})}catch{leaving.current=false;setError('Odjava nije uspjela. Pokušajte ponovno.')}}
 async function move(next){if(guard.current||locked||!data)return
  if(['team','services','schedule'].includes(step)&&!window.confirm(f('Jeste li spremili otvoreni obrazac? Nastavkom se zatvara njegov nespremljeni unos.')))return
  const forward=steps.indexOf(next)>steps.indexOf(step)
  if(forward){
    const problems=stepErrors(data.setup,employees,services,steps.indexOf(next))
    setFieldErrors(problems)
    const first=Object.keys(problems)[0]
    if(first){
      setError('Dopunite označena polja prije nastavka.')
      setStep(first==='business_type'?'salon':first==='services'?'services':'team')
      focusProblem('onboarding-'+first)
      return
    }
  }
  setFieldErrors({})
  guard.current=true;setBusy(true);setError('');setReview(null)
  try{const saved=await setupApi.save(salon.id,{...data.setup,last_step:next},data.setup.revision);if(!alive.current)return;setData(saved);setStep(next)}
  catch(e){if(alive.current){setError([e,'Učitajte spremljeno postavljanje prije nastavka.']);setLocked(true)}}
  finally{guard.current=false;if(alive.current)setBusy(false)}
 }
 async function check(){if(guard.current)return;guard.current=true;setBusy(true);setError('');setReview(null)
  try{const r=await api.readiness(salon.id);if(alive.current){setReview(r);if(r.status==='completed'||r.status==='not_required'){leaving.current=true;onRefresh()}}}
  catch(e){if(alive.current)setError(e)}finally{guard.current=false;if(alive.current)setBusy(false)}
 }
 async function complete(){if(guard.current||!review?.ready||locked)return;guard.current=true;setBusy(true);setError('')
  try{await api.complete(salon.id,review.revision);if(alive.current){leaving.current=true;setCompletedSalonId(salon.id)}}
  catch(e){if(alive.current){setReview(null);setError([e,'Ponovno provjerite spremnost salona.'])}}
  finally{guard.current=false;if(alive.current)setBusy(false)}
 }
 const draft=data?.setup
 const field=(key,value)=>{setData({...data,setup:{...draft,[key]:value}});setReview(null);setFieldErrors(current=>({...current,[key]:undefined}));setError('')}
 const invalid=key=>({'id':'onboarding-'+key,'aria-invalid':Boolean(fieldErrors[key]),'aria-describedby':fieldErrors[key]?'onboarding-'+key+'-error':undefined,'aria-required':true})
 const hint=key=>fieldErrors[key]&&<span id={'onboarding-'+key+'-error'} className="onboarding-field-error">{f(fieldErrors[key])}</span>
 const examples=serviceExamples(draft?.business_type)

 return <div className="salon-onboarding"><header className="onboarding-header"><strong>SalonAI</strong><LanguageSelector /><span>{salon.name}</span>{workspaces.length>1&&<label>{f("Salon")}<select aria-label={f("Odabrani salon")} disabled={busy} value={String(salon.id)} onChange={e=>onSelect(e.target.value)}>{workspaces.map(w=><option key={w.salon.id} value={String(w.salon.id)}>{w.salon.name}</option>)}</select></label>}<button type="button" onClick={signOut} disabled={busy}>{f("Odjavi se")}</button></header>
 <main className="onboarding-main">{language==='en'&&<p className="language-progress-note">Some employee and service forms are still in Croatian. Their translations will be added in the next language package.</p>}<p className="onboarding-eyebrow">{f("POSTAVLJANJE SALONA")}</p>
 <h1 ref={heading} tabIndex={-1}>{finished?f('Vaš salon je spreman'):owner?flowStepTitle(language,labels[steps.indexOf(step)],steps.indexOf(step)+1,5):f('Salon se priprema za rad')}</h1>
 {error&&<p className="onboarding-error" role="alert">{flowError(language,error)}</p>}
 {finished?<section className="onboarding-panel onboarding-success" aria-label={f("Postavljanje završeno")}><span className="onboarding-success-icon" aria-hidden="true">✓</span><h2>{f("Sve je spremno za početak rada")}</h2><p>{f("Postavljanje salona")} <strong>{salon.name}</strong> {f("uspješno je spremljeno. Usluge, tim i raspored možete dalje uređivati u aplikaciji.")}</p><button type="button" className="onboarding-primary" onClick={onRefresh}>{f("Otvori moj salon")}</button></section>:!owner?<section className="onboarding-panel"><p>{f("Vlasnik salona treba dovršiti početno postavljanje. Vaše članstvo je sačuvano.")}</p><button type="button" onClick={onRefresh}>{f("Provjeri status")}</button></section>:<>
 <nav aria-label={f("Koraci postavljanja")} className="onboarding-steps">{steps.map((s,i)=><button key={s} type="button" aria-label={`${i+1}. ${f(labels[i])}`} aria-current={s===step?'step':undefined} disabled={busy||locked||!data} onClick={()=>move(s)}><span className="onboarding-step-number" aria-hidden="true">{i+1}</span><span>{f(labels[i])}</span></button>)}</nav>
 {(locked||!data)&&<section className="onboarding-panel">{busy?<p role="status">{f("Učitavanje postavljanja…")}</p>:<button type="button" onClick={()=>setReload(v=>v+1)}>{f("Učitaj spremljeno postavljanje")}</button>}</section>}
 {data&&!locked&&<>
 <section className="onboarding-panel">
 {step==='salon'&&<div className="onboarding-fields"><h2>{salon.name}</h2><p>{f("Vremenska zona:")} {salon.timezone}{f('. Naziv i zona potvrđeni su pri kreiranju salona.')}</p><label>{f("Djelatnost (obavezno)")}<select {...invalid('business_type')} disabled={busy} value={draft.business_type||''} onChange={e=>field('business_type',e.target.value)}><option value="">{f("Odaberite")}</option><option value="hair">{f("Frizerski salon")}</option><option value="grooming">{f("Njega ljubimaca — grooming")}</option><option value="mixed">{f("Više djelatnosti")}</option><option value="other">{f("Drugo")}</option></select>{hint('business_type')}</label><label>{f("Lokacija (neobavezno)")}<input disabled={busy} maxLength={250} value={draft.location} onChange={e=>field('location',e.target.value)}/></label></div>}
 {step==='team'&&<div className="onboarding-fields"><h2>{f("Postavite svoj tim")}</h2><p>{f("Najprije odaberite kako radite, zatim dodajte osobe koje će izvoditi usluge.")}</p>
 <div className="onboarding-team-choices">
 <label>{f("Način rada (obavezno)")}<select {...invalid('team_mode')} disabled={busy} value={draft.team_mode||''} onChange={e=>field('team_mode',e.target.value||null)}><option value="">{f("Odaberite")}</option><option value="solo">{f("Radim samostalno")}</option><option value="team">{f("Radimo kao tim")}</option></select>{hint('team_mode')}<small>{f("Samostalno: jedan izvođač. Tim: jedna ili više osoba, uz vlasnika koji može samo upravljati salonom.")}</small></label>
 <label>{f("Pružate li osobno usluge? (obavezno)")}<select {...invalid('owner_provides_services')} disabled={busy} value={typeof draft.owner_provides_services==='boolean'?String(draft.owner_provides_services):''} onChange={e=>field('owner_provides_services',e.target.value===''?null:e.target.value==='true')}><option value="">{f("Odaberite")}</option><option value="true">{f("Da, i ja pružam usluge")}</option><option value="false">{f("Ne, upravljam salonom")}</option></select>{hint('owner_provides_services')}</label>
 </div>
 <div id="onboarding-profiles" tabIndex={-1} className={'onboarding-guidance'+(fieldErrors.profiles?' onboarding-guidance-error':'')} aria-describedby={fieldErrors.profiles?'onboarding-profiles-error':undefined}>
 <h3>{draft.team_mode==='solo'?f('Dodajte svoj profil'):f('Dodajte osobe koje pružaju usluge')}</h3>
 <p>{draft.team_mode==='solo'?f('Kliknite „Novi zaposlenik”, upišite svoje ime i spremite profil. Vaš vlasnički račun i profil izvođača imaju različite uloge.'):f('Kliknite „Novi zaposlenik” za svaku osobu koja pruža usluge. Ako i vi izvodite usluge, dodajte i profil sa svojim imenom.')}</p>
 <p>{f("Spremite svaki profil gumbom u njegovu obrascu. Usluge i radno vrijeme uredite u koraku Raspored. Pozivnice za pristup aplikaciji možete poslati kasnije, na stranici Zaposlenici.")}</p>
 <strong>{f("Aktivni profili:")} {employees.filter(e=>e.active!==false).length}</strong>{hint('profiles')}
 </div></div>}
 {step==='services'&&<><h2>{f("Pripremite cjenik")}</h2><p>{f(examples.summary)}</p><p>{f("Uvezite fotografiju ili PDF, pregledajte prepoznate stavke i dopunite trajanja. Usluge možete dodati i ručno. Spremite potvrđene stavke prije nastavka.")}</p><div id="onboarding-services" tabIndex={-1} className={fieldErrors.services?'onboarding-guidance onboarding-guidance-error':undefined}>{hint('services')}</div></>}
 {step==='schedule'&&<><h2>{f("Dodijelite usluge i radno vrijeme")}</h2><p>{f("Otvorite Uredi za zaposlenika, označite njegove usluge i postavite tjedno radno vrijeme. Svaka aktivna usluga treba barem jednog aktivnog zaposlenika koji je može izvesti.")}</p></>}
 {step==='review'&&<><h2>{f("Provjera prije početka rada")}</h2><p>{f("Provjeravamo spremljene podatke. Sam prolazak kroz korake ne dovršava postavljanje.")}</p><button type="button" onClick={check} disabled={busy}>{f("Provjeri spremnost salona")}</button>{review&&<div aria-live="polite"><p>{f("Aktivni profili:")} {review.counts.employees} {f('· Aktivne usluge:')} {review.counts.services}</p>{review.issues.length?<ul>{review.issues.map((i,n)=><li key={n}>{flowError(language,i.message)} <button type="button" disabled={busy} onClick={()=>move(i.step)}>{f("Otvori korak")}</button></li>)}</ul>:<p>{f("Svi uvjeti za početak rada su ispunjeni.")}</p>}<button type="button" className="onboarding-primary" onClick={complete} disabled={busy||!review.ready}>{f("Završi postavljanje")}</button></div>}</>}
 </section>
 <div className="onboarding-workspace"><Suspense fallback={<p role="status">{f("Učitavanje obrasca…")}</p>}>
 {step==='services'&&<Services businessType={draft.business_type} userId={user.id} canManageServices serviceList={services} setServiceList={setServices} salonId={salon.id}/>}
 {['team','schedule'].includes(step)&&<Employees onboardingMode key={step} memberManagementContext={authContext} canManageEmployees canManageAdminInvitations employeeList={employees} setEmployeeList={setEmployees} serviceList={services} salonId={salon.id} salonTimezone={salon.timezone}/>}
 </Suspense></div>
 <footer className="onboarding-actions">{step!=='salon'&&<button type="button" disabled={busy} onClick={()=>move(steps[steps.indexOf(step)-1])}>{f("Natrag")}</button>}<button type="button" disabled={busy} onClick={()=>move(step)}>{f("Spremi ovaj korak")}</button>{step!=='review'&&<button type="button" className="onboarding-primary" disabled={busy} onClick={()=>move(steps[steps.indexOf(step)+1])}>{busy?f('Spremanje…'):f('Spremi i nastavi')}</button>}</footer>
 </>}
 </>}
 </main></div>
}

export default function OnboardingWizard(props) {
 return <LanguageProvider userId={props.authContext.user.id}><OnboardingWizardContent {...props}/></LanguageProvider>
}
