import {CapacityInsight} from './BusinessInsights.jsx'
import { useEffect,useId,useState } from 'react'
import { useLanguage } from '../../components/Language/LanguageProvider'
import { fetchCapacity } from '../../api/capacityApi.js'
import CapacitySchedule from './CapacitySchedule.jsx'
import {capacityDuration} from './capacityPresentation.js'
import './CapacityOverview.css'

export default function CapacityOverview({salonId,timeZone}) {
  const {language}=useLanguage(),heading=useId(),selector=useId()
  const t=(hr,en)=>language==='en'?en:hr,locale=language==='en'?'en-GB':'hr-HR'
  const [days,setDays]=useState(7),[revision,setRevision]=useState(0),[state,setState]=useState(null)
  const key=`${salonId}:${timeZone}:${days}:${revision}`
  useEffect(()=>{
    let current=true
    const controller=new AbortController()
    setState({key,loading:true})
    fetchCapacity({salonId,timeZone,days,signal:controller.signal}).then(data=>{
      if(current)setState({key,data})
    }).catch(error=>{if(current)setState({key,error:error.code||'CAPACITY_REQUEST_FAILED'})})
    return()=>{current=false;controller.abort()}
  },[key,salonId,timeZone,days])
  const view=state?.key===key?state:null,data=view?.data,loading=!view||view.loading
  const hours=n=>capacityDuration(n,language)
  const pct=n=>n===null?'—':new Intl.NumberFormat(locale,{maximumFractionDigits:1}).format(n)+'%'
  const date=d=>new Intl.DateTimeFormat(locale,{timeZone:'UTC',day:'2-digit',month:'2-digit',weekday:'short'}).format(new Date(d+'T12:00:00Z'))
  const errorText=code=>{
    if(code==='CAPACITY_FORBIDDEN'||code==='INSUFFICIENT_SALON_ROLE')return t('Nemate ovlast za pregled kapaciteta ovog salona.','You do not have permission to view capacity for this salon.')
    if(code==='CAPACITY_LOCAL_TIME_UNCLEAR')return t('Radno vrijeme ili granica razdoblja pada u nepostojeći ili ponovljeni lokalni sat. Provjerite raspored za dane promjene sata.','Working hours or a period boundary fall in a missing or repeated local hour. Check schedules around the clock change.')
    if(code==='CAPACITY_LIMIT_EXCEEDED')return t('Raspon sadrži previše podataka za ovaj pregled. Odaberite kraće razdoblje.','This range contains too much data for this overview. Choose a shorter period.')
    if(code==='CAPACITY_TIMEZONE_INVALID'||code==='CAPACITY_TIMEZONE_UNSUPPORTED')return t('Vremenska zona salona nije podržana za ovaj izračun.','The salon timezone is not supported for this calculation.')
    return t('Kapacitet nije moguće pouzdano učitati. Pokušajte osvježiti pregled.','Capacity could not be loaded reliably. Try refreshing the overview.')
  }
  const metrics=data?[
    [t('Raspoloživi kapacitet','Available capacity'),hours(data.totals.capacity_ms)],
    [t('Rezervirano vrijeme','Booked time'),hours(data.totals.occupied_ms)],
    [t('Slobodno vrijeme','Free time'),hours(data.totals.free_ms)],
    [t('Planirana popunjenost','Planned utilization'),pct(data.totals.utilization_percent)]
  ]:[]
  return <section className="dashboard-panel capacity-overview" aria-labelledby={heading}>
    <div className="capacity-heading"><div><p className="dashboard-eyebrow">{t('PLAN RADA','WORK PLAN')}</p><h2 id={heading}>{t('Kapacitet i popunjenost','Capacity and utilization')}</h2></div>
      <div className="capacity-controls"><label htmlFor={selector}>{t('Razdoblje od sada','Period from now')}<select id={selector} value={days} onChange={e=>setDays(Number(e.target.value))}>{[7,14,30].map(n=><option key={n} value={n}>{t(`Sljedećih ${n} dana`,`Next ${n} days`)}</option>)}</select></label>
        <button type="button" disabled={loading} onClick={()=>setRevision(n=>n+1)}>{t('Osvježi kapacitet','Refresh capacity')}</button></div></div>
    <p className="dashboard-section-note">{t('Plan prema trenutačnim rasporedima, odsutnostima i blokadama. Današnji dan uključuje samo preostalo vrijeme. Ovaj odabir ne ovisi o financijskom razdoblju iznad.','Plan based on current schedules, time off and blocks. Today includes only remaining time. This selection is independent of the financial period above.')}</p>
    {loading&&<p role="status">{t('Učitavanje kapaciteta…','Loading capacity…')}</p>}
    {view?.error&&<p role="alert" className="dashboard-error">{errorText(view.error)}</p>}
    {data&&<>
      <p className="capacity-meta">{date(data.dates[0])} – {date(data.dates.at(-1))} · {data.timezone}<br/>{t('Izračunano: ','Calculated: ')}{new Intl.DateTimeFormat(locale,{timeZone:data.timezone,dateStyle:'short',timeStyle:'medium'}).format(new Date(data.as_of))}</p>
      <div className="dashboard-metrics capacity-metrics">{metrics.map(([title,value])=><article className="dashboard-metric" key={title}><h3>{title}</h3><strong>{value}</strong></article>)}</div>
      <p className="dashboard-section-note">{t('Sati su zbroj vremena zaposlenika. Slobodno vrijeme nije broj dostupnih termina: mogućnost rezervacije ovisi o trajanju usluge i kvalifikacijama zaposlenika.','Hours are summed across employees. Free time is not a count of available appointments: booking depends on service duration and employee qualifications.')}</p>
      {(data.totals.outside_capacity_ms>0||data.totals.overlapping_booking_ms>0||data.totals.unusual_status_count>0)&&<p role="alert" className="dashboard-error">{t('Provjerite raspored: ','Check the schedule: ')}{t('izvan kapaciteta','outside capacity')} {hours(data.totals.outside_capacity_ms)}; {t('višestruko rezervirano','overbooked time')} {hours(data.totals.overlapping_booking_ms)}; {t('budući završeni termini ili nedolasci','future completed appointments or no-shows')}: {data.totals.unusual_status_count}. {t('Ove nepravilnosti nisu prikazane kao dodatni raspoloživi sati.','These anomalies are not shown as additional available hours.')}</p>}
      <CapacityInsight data={data}/>
      <h3>{t('Pregled po zaposleniku','Employee overview')}</h3>
      {!data.active_employee_count?<p>{t('Salon nema aktivnih zaposlenika za ovaj pregled.','This salon has no active employees for this overview.')}</p>:<ul className="capacity-employee-list">{data.employees.map(e=><li key={e.employee_id}><strong>{e.name}</strong><dl>{[[t('Kapacitet','Capacity'),hours(e.capacity_ms)],[t('Rezervirano','Booked'),hours(e.occupied_ms)],[t('Slobodno','Free'),hours(e.free_ms)],[t('Popunjenost','Utilization'),pct(e.utilization_percent)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></li>)}</ul>}
      <CapacitySchedule key={`${data.salon_id}:${data.as_of}:${data.days}`} data={data}/>

    </>}
  </section>
}
