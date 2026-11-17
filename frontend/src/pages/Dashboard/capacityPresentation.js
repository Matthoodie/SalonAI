export function capacityDuration(ms,language='hr') {
  if(!Number.isFinite(ms)||ms<0)return '—'
  if(ms>0&&ms<60000)return '< 1 min'
  const minutes=Math.round(ms/60000),hours=Math.floor(minutes/60),rest=minutes%60
  const number=n=>new Intl.NumberFormat(language==='en'?'en-GB':'hr-HR').format(n)
  return hours?`${number(hours)} h${rest?` ${rest} min`:''}`:`${minutes} min`
}
export function capacityPages(dates,page) {
  const count=Math.max(1,Math.ceil(dates.length/7)),index=Math.min(Math.max(0,page),count-1)
  return {index,count,dates:dates.slice(index*7,index*7+7)}
}
export function capacityDay(heatmap,date) {
  const cells=heatmap.filter(c=>c.date===date)
  const total=cells.reduce((a,c)=>({capacity_ms:a.capacity_ms+c.capacity_ms,occupied_ms:a.occupied_ms+c.occupied_ms,free_ms:a.free_ms+c.free_ms}),{capacity_ms:0,occupied_ms:0,free_ms:0})
  return {...total,utilization_percent:total.capacity_ms?total.occupied_ms/total.capacity_ms*100:null,cells:cells.filter(c=>c.capacity_ms>0)}
}
