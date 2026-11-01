import { newDraftRow, MAX_ROWS } from './pricelistDraft.js'
export function appendRecognizedRows(rows,items) {
  const base=rows.length===1 && ['name','category','price_eur','default_duration_minutes'].every(k=>!rows[0][k])?[]:rows
  if(!Array.isArray(items)||!items.length)throw new Error('Nema prepoznatih stavki za dodavanje.')
  if(base.length+items.length>MAX_ROWS)throw new Error('Nacrt može sadržavati najviše 100 stavki. Smanjite postojeći nacrt ili obradite manji dio cjenika.')
  return [...base,...items.map(item=>({...newDraftRow(),name:item.name,category:item.category,
    price_eur:item.price_eur,default_duration_minutes:item.default_duration_minutes,recognition_note:item.recognition_note}))]
}
