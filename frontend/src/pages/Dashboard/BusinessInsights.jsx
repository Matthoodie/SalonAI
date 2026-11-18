import {useId,useMemo} from 'react'
import {useLanguage} from '../../components/Language/LanguageProvider'
import {overviewDate,overviewMoney} from '../../components/Language/overviewText.js'
import {businessInsights,capacityInsight} from './businessInsights.js'
import {capacityDuration} from './capacityPresentation.js'
import './BusinessInsights.css'

export default function BusinessInsights({rows,range,timeZone,now}){
 const {language}=useLanguage(),id=useId(),t=(hr,en)=>language==='en'?en:hr
 const result=useMemo(()=>{try{return businessInsights(rows,range,timeZone,now)}catch{return null}},[rows,range,timeZone,now])
 const date=d=>overviewDate(language,d),money=n=>overviewMoney(language,n)
 if(!result)return <p>{t('Poslovni uvidi trenutačno nisu dostupni.','Business insights are currently unavailable.')}</p>
 const {trend,returning}=result
 const trendNotes={
  anomaly:t('Provjerite buduće termine označene kao završene prije usporedbe.','Check future appointments marked as completed before comparing.'),
  partial:t('Odabrano razdoblje još traje ili uključuje buduće dane. Zaključak o rastu prikazat će se za završeno razdoblje.','The selected period is still in progress or includes future dates. A growth comparison is available for a closed period.'),
  missing:t('Usporedba nije dostupna jer nedostaju cijene ili prethodno razdoblje.','Comparison unavailable because prices or the previous period are missing.'),
  empty:t('U oba razdoblja nema završenih termina.','Neither period has completed appointments.')
 }
 const change=trend.change===null?null:new Intl.NumberFormat(language==='en'?'en-GB':'hr-HR',{maximumFractionDigits:1,signDisplay:'exceptZero'}).format(trend.change)+'%'
 return <section className="dashboard-panel business-insights" aria-labelledby={id}>
  <h2 id={id}>{t('Poslovni uvidi','Business insights')}</h2>
  <p className="dashboard-section-note">{date(range.from)} – {date(range.to)} · {t('Prema spremljenim terminima ovog salona.','Based on this salon’s saved appointments.')}</p>
  <div className="insight-cards">
   <article><h3>{t('Promjena vrijednosti odrađenih usluga','Change in completed service value')}</h3>
    {trend.state==='ready'?<><strong>{change??t('Bez postotne usporedbe','No percentage comparison')}</strong><p>{money(trend.current)} · {t('prethodno','previously')} {money(trend.previous)}</p>{change===null&&<p>{t('Prethodna vrijednost je nula; postotni rast nije definiran.','Previous value is zero; percentage growth is undefined.')}</p>}</>:<p>{trendNotes[trend.state]}</p>}
    {trend.previousRange&&<p className="dashboard-section-note">{t('Prethodno razdoblje: ','Previous period: ')}{date(trend.previousRange.from)} – {date(trend.previousRange.to)}</p>}
    <p className="dashboard-section-note">{t('Vrijednost usluga, ne naplaćeni prihod ni dobit.','Service value, not collected revenue or profit.')}</p>
   </article>
   <article><h3>{t('Klijenti s ranijim posjetom','Clients with a previous visit')}</h3>
    {returning.state==='ready'?<><strong>{returning.count} / {returning.total}</strong><p>{t('Toliko različitih klijenata iz odabranog razdoblja ima završen termin prije početka tog razdoblja u spremljenoj povijesti.','This many distinct clients in the selected period have a completed appointment before that period in the saved history.')}</p></>:<p>{returning.state==='empty'?t('Nema završenih termina u odabranom razdoblju.','No completed appointments in the selected period.'):t('Uvid nije dostupan dok nedostaju identifikatori klijenata ili postoje budući završeni termini.','Insight unavailable while client IDs are missing or future completed appointments exist.')}</p>}
    <p className="dashboard-section-note">{t('Broje se vlasnici/klijenti, ne ljubimci. Izostanak ranijeg zapisa ne dokazuje da je klijent nov; ovo nije stopa zadržavanja klijenata.','Counts owners/clients, not pets. No earlier record does not prove a client is new; this is not a retention rate.')}</p>
   </article>
  </div>
 </section>
}

export function CapacityInsight({data}){
 const {language}=useLanguage(),id=useId()
 const text=(hr,en)=>language==='en'?en:hr
 const insight=capacityInsight(data)
 return <section className="business-insights capacity-insight" aria-labelledby={id}>
  <h3 id={id}>{text('Dani s najviše slobodnog vremena','Days with the most free time')}</h3>
  <p className="dashboard-section-note">{overviewDate(language,data.dates[0])} – {overviewDate(language,data.dates.at(-1))} · {text('Plan prema izračunu kapaciteta iznad.','Plan based on the capacity calculation above.')}</p>
  {insight.state==='ready'?<ol className="insight-capacity-days">{insight.days.map(day=><li key={day.date}><strong>{overviewDate(language,day.date)}</strong><span>{capacityDuration(day.free_ms,language)} {text('slobodno od','free out of')} {capacityDuration(day.capacity_ms,language)}</span></li>)}</ol>:<p>{insight.state==='anomaly'?text('Najprije provjerite označene nepravilnosti rasporeda.','Check the flagged schedule anomalies first.'):insight.state==='full'?text('U ovom planu nema preostalog slobodnog vremena.','This plan has no remaining free time.'):text('U odabranom razdoblju nema raspoloživog kapaciteta.','No available capacity in this period.')}</p>}
  <p className="dashboard-section-note">{text('Najviše tri konkretna datuma, poredana po ukupnom slobodnom vremenu zaposlenika. Sati ne moraju biti povezani; dostupnost termina provjerite u kalendaru. Današnji dan uključuje samo preostalo vrijeme.','Up to three actual dates, ranked by total employee free time. Hours may not be consecutive; check appointment availability in the calendar. Today includes only remaining time.')}</p>
 </section>
}
