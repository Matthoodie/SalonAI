import { useEffect, useRef, useState } from 'react'
import { recognizePricelist, MAX_RECOGNITION_BYTES } from '../../api/pricelistRecognitionApi.js'
import './PricelistRecognition.css'
export default function PricelistRecognition({salonId,disabled,onBusyChange,onAppend}) {
  const [file,setFile]=useState(null),[result,setResult]=useState(null),[message,setMessage]=useState(''),[working,setWorking]=useState(false)
  const busy=useRef(false),abort=useRef(null),alive=useRef(true)
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;abort.current?.abort()}},[])
  async function recognize() {
    if(busy.current||disabled||!file)return
    busy.current=true;setWorking(true);onBusyChange(true);setMessage('');setResult(null)
    const controller=new AbortController();abort.current=controller
    try {
      const data=await recognizePricelist(file,salonId,controller.signal)
      if(alive.current){setResult(data);if(!data.items.length)setMessage('Nisu pronađene stavke cjenika. Pokušajte s jasnijim dokumentom ili unesite stavke ručno.')}
    } catch(error){if(alive.current)setMessage(error.name==='AbortError'?'Obrada je prekinuta. Nacrt nije promijenjen.':error.message)}
    finally {busy.current=false;if(alive.current){setWorking(false);onBusyChange(false)}}
  }
  return <section className="pricelist-recognition" aria-labelledby="pricelist-recognition-title" aria-busy={working}>
    <h3 id="pricelist-recognition-title">Prepoznaj cjenik s fotografije ili PDF-a</h3>
    <p>JPEG ili PNG do 24 megapiksela, ili PDF do 5 stranica. Najviše 8 MB po datoteci. Dokument se šalje OpenAI servisu tek kada kliknete „Prepoznaj cjenik”. Obrada troši API kredite.</p>
    <p>AI može pogriješiti. Provjerite cijene, varijante i trajanja prije potvrde uvoza. Ne šaljite dokumente s osobnim podacima klijenata.</p>
    <label>Datoteka cjenika<input type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" disabled={disabled||working}
      onChange={e=>{const next=e.target.files?.[0];setResult(null);setMessage('');setFile(null);if(next){if(next.size>MAX_RECOGNITION_BYTES||!next.size){setMessage('Datoteka mora biti neprazna i manja od 8 MB.');e.target.value=''}else setFile(next)}}} /></label>
    <button type="button" disabled={disabled||working||!file} onClick={recognize}>{working?'Prepoznavanje…':'Prepoznaj cjenik'}</button>
    {working && <p role="status">Obrada može trajati do 90 sekundi. Nemojte ponovno slati isti dokument.</p>}
    {message && <p role="alert" className="service-import-alert">{message}</p>}
    {result && <div className="pricelist-recognition-result">
      <p><strong>Prepoznato stavki: {result.items.length}</strong>. Još ništa nije spremljeno u katalog.</p>
      {result.warnings.length>0 && <ul>{result.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul>}
      {result.items.length>0 && <><p>Dodajte ih u nacrt ispod. Postojeće unesene stavke ostaju sačuvane.</p>
        <button type="button" disabled={disabled||working} onClick={()=>{try{onAppend(result.items);setResult(null);setMessage('Stavke su dodane u nacrt. Pregledajte ih i dopunite prazna polja.')}catch(error){setMessage(error.message)}}}>Dodaj prepoznate stavke u nacrt</button></>}
    </div>}
  </section>
}
