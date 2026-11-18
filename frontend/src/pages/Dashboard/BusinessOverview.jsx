import BusinessInsights from './BusinessInsights.jsx'
import { useId, useMemo, useState } from 'react'
import { useLanguage } from '../../components/Language/LanguageProvider'
import { overviewDate, overviewMoney, overviewLocale } from '../../components/Language/overviewText.js'
import { dashboardAnalytics, percentChange } from './dashboardAnalytics.js'
import './BusinessOverview.css'

export default function BusinessOverview({ rows, range, timeZone, now }) {
  const {language}=useLanguage(),id=useId()
  const t=(hr,en)=>language==='en'?en:hr
  const money=n=>overviewMoney(language,n),date=d=>overviewDate(language,d)
  const span=(a,b)=>a===b?date(a):`${date(a)} – ${date(b)}`
  const [sort,setSort]=useState('value')
  const result=useMemo(()=>{try{return {data:dashboardAnalytics(rows,range,timeZone,now)}}catch{return {error:true}}},[rows,range,timeZone,now])
  if(result.error)return <p className="dashboard-error" role="alert">{t('Poslovne pokazatelje nije moguće pouzdano izračunati. Osvježite aplikaciju.','Business metrics could not be calculated reliably. Refresh the application.')}</p>
  const a=result.data
  const axisMoney=n=>new Intl.NumberFormat(overviewLocale(language),{style:'currency',currency:'EUR',notation:'compact',maximumFractionDigits:1}).format(n/100)
  const value=v=>v.missing?'—':money(v.valueCents)
  const coverage=v=>v.missing?t(`Poznata vrijednost: ${money(v.valueCents)}. Bez valjane cijene: ${v.missing}.`,`Known value: ${money(v.valueCents)}. Missing a valid price: ${v.missing}.`):null
  function comparison(n,p){
    const change=percentChange(n,p)
    if(change===null)return t('Usporedba nije dostupna.','Comparison unavailable.')
    const number=new Intl.NumberFormat(overviewLocale(language),{maximumFractionDigits:1,signDisplay:'exceptZero'}).format(change)
    return `${number}% ${t('prema prethodnom razdoblju','vs previous period')}`
  }
  const cards=[
    [t('Vrijednost odrađenih usluga','Completed service value'),value(a.current),t('Završeni termini u odabranom razdoblju. Nije evidencija naplate.','Completed appointments in the selected period. Not a payment record.'),coverage(a.current),comparison(a.current.missing?null:a.current.valueCents,a.prior&&!a.prior.missing?a.prior.valueCents:null)],
    [t('Vrijednost budućih rezervacija','Upcoming booking value'),value(a.future),t(`Od sada do ${date(a.futureTo)}: na čekanju i zakazani. Ne ovisi o filtru razdoblja.`,`From now through ${date(a.futureTo)}: pending and confirmed. Independent of the period filter.`),coverage(a.future),t(`${a.future.count} budućih termina · planirana vrijednost`,`${a.future.count} upcoming appointments · planned value`)],
    [t('Prosječna vrijednost termina','Average appointment value'),a.current.averageCents===null?'—':money(a.current.averageCents),t('Vrijednost završenih termina podijeljena njihovim brojem. Besplatni termini su uključeni.','Completed appointment value divided by appointment count. Free appointments are included.'),null,comparison(a.current.averageCents,a.prior?.averageCents??null)],
    [t('Završeni termini','Completed appointments'),a.current.count,t('Jedan termin broji se jednom, neovisno o broju usluga.','Each appointment counts once, regardless of its service count.'),null,comparison(a.current.count,a.prior?.count??null)],
  ]
  const max=Math.max(100,...a.buckets.map(b=>b.current.missing?0:b.current.valueCents))
  const x=i=>70+(a.buckets.length===1?300:i*600/(a.buckets.length-1)),y=n=>190-n/max*150
  function series(key){return a.buckets.map((b,i)=>{const v=b[key];return v&&!v.missing?{x:x(i),y:y(v.valueCents),value:v.valueCents}:null})}
  const currentPoints=series('current')
  function line(points){let connected=false;return points.map(p=>{if(!p){connected=false;return ''}const command=connected?'L':'M';connected=true;return `${command}${p.x},${p.y}`}).join(' ')}
  const services=sort==='value'?a.services.byValue:a.services.byCount
  const serviceMax=Math.max(1,...services.map(s=>sort==='value'?s.valueCents:s.count))
  return <section className="business-overview" aria-label={t('Poslovni pokazatelji','Business metrics')}>
    <div className="dashboard-metrics business-metrics">
      {cards.map(([title,amount,note,warning,change])=><article className="dashboard-metric" key={title}><h2>{title}</h2><strong>{amount}</strong><p>{note}</p>{warning&&<p className="business-warning">{warning}</p>}<p className="business-comparison">{change}</p></article>)}
    </div>
    <p className="dashboard-section-note">{a.previous?t(`Usporedba s razdobljem ${span(a.previous.from,a.previous.to)} (${a.days} ${a.days===1?'dan':'dana'}).`,`Compared with ${span(a.previous.from,a.previous.to)} (${a.days} days).`):t('Prethodno razdoblje nije dostupno.','Previous period unavailable.')} {t('Postotak se ne računa ako je prethodna vrijednost nula, a nova je veća od nule, ili ako nedostaju cijene.','A percentage is unavailable when the previous value is zero and the new value is positive, or when prices are missing.')}{a.partialCurrent&&` ${t('Odabrano razdoblje još nije završeno.','The selected period has not ended yet.')}`}</p>
    <BusinessInsights rows={rows} range={range} timeZone={timeZone} now={now}/>
    <section className="dashboard-panel business-trend-panel" aria-labelledby={`${id}-trend`}>
      <h2 id={`${id}-trend`}>{a.days===1?t('Usporedba dvaju dana','Two-day comparison'):t('Vrijednost odrađenih usluga kroz vrijeme','Completed service value over time')}</h2>
      <div className="business-period-comparison">
        <article><span>{t('Odabrano razdoblje','Selected period')}</span><h3>{span(range.from,range.to)}</h3><strong>{value(a.current)}</strong>{coverage(a.current)&&<p className="business-warning">{coverage(a.current)}</p>}</article>
        <article><span>{t('Prethodno razdoblje','Previous period')}</span><h3>{a.previous?span(a.previous.from,a.previous.to):'—'}</h3><strong>{a.prior?value(a.prior):'—'}</strong>{a.prior&&coverage(a.prior)&&<p className="business-warning">{coverage(a.prior)}</p>}</article>
      </div>
      <p className="dashboard-section-note">{a.days===1?t('Uspoređuju se dva različita datuma navedena iznad. Svaki iznos pripada svom danu.','The two different dates shown above are compared. Each amount belongs to its own day.'):t('Usporedba obuhvaća prethodno razdoblje jednake duljine. Grafikon ispod prikazuje samo odabrano razdoblje, prema stvarnim datumima.','The comparison covers the preceding period of equal length. The chart below shows only the selected period, using actual dates.')}</p>
      {a.days>1&&<>
        {!a.current.count?<p className="dashboard-empty">{t('U odabranom razdoblju nema završenih termina.','No completed appointments in the selected period.')}</p>:<div className="business-chart-wrap"><svg className="business-chart" viewBox="0 0 720 250" role="img" aria-labelledby={`${id}-chart-title ${id}-chart-desc`}>
          <title id={`${id}-chart-title`}>{`${t('Vrijednost odrađenih usluga','Completed service value')}: ${span(range.from,range.to)}`}</title>
          <desc id={`${id}-chart-desc`}>{t('Prikazano je samo odabrano razdoblje. Točni datumi i iznosi dostupni su ispod grafikona. Prekid znači da nedostaju cijene.','Only the selected period is shown. Exact dates and amounts are available below. A gap means prices are missing.')}</desc>
          {[0,max/2,max].map(n=><g key={n}><line x1="70" x2="670" y1={y(n)} y2={y(n)} className="business-grid"/><text x="64" y={y(n)+4} textAnchor="end">{axisMoney(n)}</text></g>)}
          <g className="business-series-current"><path d={line(currentPoints)} fill="none"/>{currentPoints.map((p,i)=>p&&<circle key={i} cx={p.x} cy={p.y} r="4"><title>{`${span(a.buckets[i].from,a.buckets[i].to)}: ${money(p.value)}`}</title></circle>)}</g>
          {a.buckets.map((b,i)=>(i===0||i===a.buckets.length-1||i%Math.ceil(a.buckets.length/4)===0)&&<text key={b.from} x={x(i)} y="218" textAnchor="middle">{new Intl.DateTimeFormat(overviewLocale(language),{timeZone:'UTC',day:'2-digit',month:'2-digit'}).format(new Date(b.from+'T12:00:00Z'))}</text>)}
        </svg></div>}
        <ul className="business-mobile-trend">{a.buckets.map(b=><li key={b.from}><span>{span(b.from,b.to)}</span><strong>{value(b.current)}</strong>{b.current.missing>0&&<small>{coverage(b.current)}</small>}</li>)}</ul>
        <p className="dashboard-section-note">{t('Svaka točka predstavlja vrijednost u pripadajućem danu ili skupini dana; iznosi se ne zbrajaju kumulativno.','Each point represents value for its day or group of days; amounts are not cumulative.')}</p>
        <details className="business-details"><summary>{t('Prikaži datume i iznose','Show dates and amounts')}</summary><ul className="business-trend-values">{a.buckets.map(b=><li key={b.from}><span>{span(b.from,b.to)}</span><strong>{value(b.current)}</strong>{b.current.missing>0&&<small>{coverage(b.current)}</small>}</li>)}</ul></details>
      </>}

    </section>
    <section className="dashboard-panel" aria-labelledby={`${id}-services`}>
      <h2 id={`${id}-services`}>{t('Najuspješnije usluge','Top services')}</h2>
      <p className="dashboard-section-note">{t('Do pet usluga iz završenih termina odabranog razdoblja. Grupiranje po ID-u usluge; naziv iz posljednje uključene stavke.','Up to five services from completed appointments in the selected period. Grouped by service ID; name from the latest included item.')}</p>
      <div className="dashboard-period-buttons"><button type="button" aria-pressed={sort==='value'} onClick={()=>setSort('value')}>{t('Po vrijednosti','By value')}</button><button type="button" aria-pressed={sort==='count'} onClick={()=>setSort('count')}>{t('Po broju izvršenja','By delivery count')}</button></div>
      {a.services.missing>0&&<p className="business-warning">{t(`Iz rangiranja je izostavljeno ${a.services.missing} termina s nedostajućim ili neusklađenim stavkama.`,`Ranking excludes ${a.services.missing} appointments with missing or inconsistent items.`)}</p>}
      {services.length?<ol className="business-services">{services.map(s=><li key={s.id}><div><strong>{s.name}</strong><small>#{s.id}</small><span>{money(s.valueCents)} · {s.count} {t('izvršenja','deliveries')}</span></div><div className="business-bar" aria-hidden="true"><span style={{width:`${(sort==='value'?s.valueCents:s.count)/serviceMax*100}%`}}/></div></li>)}</ol>:<p className="dashboard-empty">{t('Nema usluga za prikaz u odabranom razdoblju.','No services to display in the selected period.')}</p>}
    </section>
  </section>
}
