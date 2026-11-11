import { useEffect, useState } from 'react'
import { appointmentRecipientApi } from '../../api/appointmentRecipientApi.js'
import { speciesLabel } from '../../api/appointmentRecipientView.js'
export default function PetSelection({salonId,clientId,appointmentId,value,onChange,disabled,savedPet,error}) {
  const key=[salonId,clientId,appointmentId??''].join(':')
  const [version,setVersion]=useState(0)
  const [state,setState]=useState({key:'',pets:[],nextCursor:null,loading:false,error:''})
  useEffect(()=>{
    if(!clientId||disabled)return
    const controller=new AbortController();let current=true
    setState({key,pets:[],nextCursor:null,loading:true,error:''})
    appointmentRecipientApi.options({salonId,clientId,appointmentId,signal:controller.signal}).then(d=>{
      if(current)setState({key,...d,loading:false,error:''})
    }).catch(e=>{if(current&&!controller.signal.aborted)setState({key,pets:[],nextCursor:null,loading:false,error:e.message})})
    return ()=>{current=false;controller.abort()}
  },[key,version,disabled])
  const visible=state.key===key?state:{pets:[],nextCursor:null,loading:!!clientId,error:''}
  async function more() {
    const old=state
    setState(s=>({...s,loading:true,error:''}))
    try {
      const d=await appointmentRecipientApi.options({salonId,clientId,appointmentId,after:old.nextCursor})
      setState(s=>s.key===key?{key,pets:[...old.pets,...d.pets],nextCursor:d.nextCursor,loading:false,error:''}:s)
    } catch(e){setState(s=>s.key===key?{...s,loading:false,error:e.message}:s)}
  }
  return <div className="form-field appointment-pet-selection">
    <label htmlFor="appointment-pet">Ljubimac</label>
    <select id="appointment-pet" value={value||''} disabled={disabled||!clientId||visible.loading} aria-invalid={!!error} className={error?'input-error':''} onChange={e=>onChange(e.target.value)}>
      <option value="">{!clientId?'Prvo odaberite vlasnika':visible.loading?'Učitavanje ljubimaca…':'Odaberite ljubimca'}</option>
      {savedPet && !visible.pets.some(p=>String(p.id)===String(savedPet.petId)) && <option value={savedPet.petId}>{savedPet.petName} — spremljeni odabir</option>}
      {visible.pets.map(p=><option key={p.id} value={p.id}>{p.name} · {speciesLabel[p.species]}{p.breed?' · '+p.breed:''} · #{p.id}</option>)}
    </select>
    {visible.error&&<p role="alert">{visible.error}</p>}
    {error&&<p role="alert" className="form-error form-error-visible">{error}</p>}
    {clientId&&!visible.loading&&!visible.error&&!visible.pets.length&&<p>Vlasnik nema dostupnih aktivnih ljubimaca. Vlasnik ili administrator salona može ih dodati na stranici Klijenti → Detalji → Ljubimci.</p>}
    {!disabled&&clientId&&<button type="button" disabled={visible.loading} className="secondary-button" onClick={()=>setVersion(v=>v+1)}>Osvježi ljubimce</button>}
    {visible.nextCursor&&!disabled&&<button type="button" disabled={visible.loading} onClick={more}>Učitaj još ljubimaca</button>}
  </div>
}
