import {useId,useState} from 'react'
import {useLanguage} from '../../components/Language/LanguageProvider'
import {capacityDuration,capacityPages,capacityDay} from './capacityPresentation.js'
export default function CapacitySchedule({data}) {
 const {language}=useLanguage(),selectId=useId(),heading=useId()
 const t=(hr,en)=>language==='en'?en:hr,locale=language==='en'?'en-GB':'hr-HR'
 const [page,setPage]=useState(0),[selected,setSelected]=useState(()=>data.dates.find(d=>capacityDay(data.heatmap,d).capacity_ms>0)||data.dates[0])
 const dates=capacityPages(data.dates,page),day=capacityDay(data.heatmap,selected)
 const fullDate=d=>new Intl.DateTimeFormat(locale,{timeZone:'UTC',weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(new Date(d+'T12:00:00Z'))
 const shortDate=d=>new Intl.DateTimeFormat(locale,{timeZone:'UTC',day:'2-digit',month:'2-digit'}).format(new Date(d+'T12:00:00Z'))
 const weekday=d=>new Intl.DateTimeFormat(locale,{timeZone:'UTC',weekday:'short'}).format(new Date(d+'T12:00:00Z'))
 const pct=n=>n===null?'—':new Intl.NumberFormat(locale,{maximumFractionDigits:1}).format(n)+'%'
 const duration=n=>capacityDuration(n,language)
 const cellMap=new Map(data.heatmap.map(c=>[`${c.date}:${c.hour}`,c]))
 const hours=[...new Set(data.heatmap.filter(c=>dates.dates.includes(c.date)&&c.capacity_ms>0).map(c=>c.hour))].sort((a,b)=>a-b)
 function changePage(next){const p=capacityPages(data.dates,next);setPage(p.index);setSelected(p.dates.find(d=>capacityDay(data.heatmap,d).capacity_ms>0)||p.dates[0])}
 function chooseDate(date){setSelected(date);setPage(Math.floor(data.dates.indexOf(date)/7))}
 const interval=h=>`${String(h).padStart(2,'0')}:00–${String(h+1).padStart(2,'0')}:00`
 return <div className="capacity-schedule">
  <div className="capacity-week-heading"><h3>{t('Popunjenost po danima','Daily utilization')}</h3><nav className="capacity-week-nav" aria-label={t('Pregled tjedana','Browse weeks')}>
   <button type="button" disabled={dates.index===0} onClick={()=>changePage(dates.index-1)} aria-label={t('Prethodnih 7 dana','Previous 7 days')}>←</button>
   <span aria-live="polite">{shortDate(dates.dates[0])} – {shortDate(dates.dates.at(-1))}<small>{t(`Prikaz ${dates.index+1} od ${dates.count}`,`View ${dates.index+1} of ${dates.count}`)}</small></span>
   <button type="button" disabled={dates.index===dates.count-1} onClick={()=>changePage(dates.index+1)} aria-label={t('Sljedećih 7 dana','Next 7 days')}>→</button>
  </nav></div>
  <p className="dashboard-section-note">{t('Pregledajte do sedam dana odjednom. Odaberite dan za detalje; ukupni pokazatelji iznad i dalje obuhvaćaju cijelo odabrano razdoblje.','View up to seven days at a time. Select a day for details; the totals above still cover the entire selected period.')}</p>
  <div className="capacity-week-grid" style={{'--capacity-days':dates.dates.length}} role="group" aria-label={t('Popunjenost po satima','Hourly utilization')}>
   <span className="capacity-grid-label">{t('Sat','Hour')}</span>{dates.dates.map(d=><button type="button" key={d} className="capacity-day-heading" aria-pressed={selected===d} onClick={()=>chooseDate(d)} aria-label={fullDate(d)}><span>{weekday(d)}</span><strong>{shortDate(d)}</strong></button>)}
   {hours.map(h=><div className="capacity-grid-row" key={h}><span className="capacity-grid-label">{String(h).padStart(2,'0')}:00</span>{dates.dates.map(d=>{const c=cellMap.get(`${d}:${h}`),level=c.utilization_percent===null?'none':Math.min(4,Math.floor(c.utilization_percent/25)),label=`${fullDate(d)}, ${interval(h)}: ${pct(c.utilization_percent)}; ${t('rezervirano','booked')} ${duration(c.occupied_ms)} / ${duration(c.capacity_ms)}`;return <button type="button" key={d} className={`capacity-cell capacity-level-${level}`} title={label} aria-label={label} onClick={()=>chooseDate(d)}>{pct(c.utilization_percent)}</button>})}</div>)}
  </div>
  <div className="capacity-mobile-days">{dates.dates.map(d=>{const value=capacityDay(data.heatmap,d);return <button type="button" key={d} aria-pressed={selected===d} onClick={()=>chooseDate(d)}><span>{fullDate(d)}</span><strong>{pct(value.utilization_percent)}</strong><small>{t('Rezervirano','Booked')}: {duration(value.occupied_ms)} / {duration(value.capacity_ms)}</small></button>})}</div>
  {!hours.length&&<p className="dashboard-empty">{t('U ovom dijelu razdoblja nema raspoloživog vremena.','There is no available time in this part of the period.')}</p>}
  <p className="capacity-legend">{t('0%: slobodan kapacitet · —: nema kapaciteta · Tamnija nijansa: veće zauzeće.','0%: capacity is free · —: no capacity · Darker shade: higher utilization.')}</p>
  <section className="capacity-day-detail" aria-labelledby={heading}>
   <div className="capacity-week-heading"><h3 id={heading}>{t('Detalji odabranog dana','Selected day details')}</h3><label htmlFor={selectId}>{t('Datum','Date')}<select id={selectId} value={selected} onChange={e=>chooseDate(e.target.value)}>{data.dates.map(d=><option key={d} value={d}>{fullDate(d)}</option>)}</select></label></div>
   <p className="capacity-day-summary"><strong>{fullDate(selected)}</strong><span>{t('Kapacitet','Capacity')}: {duration(day.capacity_ms)}</span><span>{t('Rezervirano','Booked')}: {duration(day.occupied_ms)}</span><span>{t('Slobodno','Free')}: {duration(day.free_ms)}</span></p>
   {day.cells.length?<ul className="capacity-hour-list">{day.cells.map(c=><li key={c.hour}><strong>{interval(c.hour)}</strong><span className="capacity-hour-percent">{pct(c.utilization_percent)}</span><div className="capacity-hour-bar" aria-hidden="true"><span style={{width:`${c.utilization_percent}%`}}/></div><dl><div><dt>{t('Rezervirano','Booked')}</dt><dd>{duration(c.occupied_ms)}</dd></div><div><dt>{t('Slobodno','Free')}</dt><dd>{duration(c.free_ms)}</dd></div></dl></li>)}</ul>:<p>{t('Za odabrani dan nema raspoloživog radnog vremena.','No working time is available for the selected day.')}</p>}
   <p className="capacity-legend">{t('Trajanje je prikazano u satima i minutama, zaokruženo na minutu. Ponovljeni sat pri jesenskoj promjeni vremena zbraja obje pojave.','Durations are shown in hours and minutes, rounded to a minute. The repeated hour at the autumn clock change combines both occurrences.')}</p>
  </section>
 </div>
}
