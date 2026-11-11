import { salonFetch } from './salonApiContext.js'
import { validRecipientId as id, recipientPayload } from './appointmentRecipientView.js'
const invalid=()=>new Error('Podatke vlasnika i ljubimca nije moguće potvrditi. Osvježite prikaz.')
export function createAppointmentRecipientApi(request=salonFetch) {
  async function read(path,options) {
    const response=await request(path,options),body=await response.json()
    if(!response.ok) throw Object.assign(new Error(body?.error?.message || 'Zahtjev nije uspio. Osvježite prikaz prije ponovnog pokušaja.'),{code:body?.error?.code,statusCode:response.status})
    return body?.data
  }
  return {
    async context(salonId,signal) {
      if(!id(salonId))throw invalid()
      const d=await read('/api/appointments/recipient-context',{signal})
      if(String(d?.salon_id)!==String(salonId)||![null,'hair','grooming','mixed','other'].includes(d.business_type))throw invalid()
      return d
    },
    async options({salonId,clientId,appointmentId,after=null,signal}) {
      if(!id(salonId)||!id(clientId)||(appointmentId!=null&&!id(appointmentId))||(after!=null&&!id(after)))throw invalid()
      const q=new URLSearchParams({client_id:String(clientId)})
      if(appointmentId!=null)q.set('appointment_id',String(appointmentId))
      if(after!=null)q.set('after',String(after))
      const d=await read('/api/appointments/pet-options?'+q,{signal})
      if(String(d?.salon_id)!==String(salonId)||String(d?.client_id)!==String(clientId)||!['grooming','mixed'].includes(d.business_type)||!Array.isArray(d.pets)||d.pets.length>50)throw invalid()
      let prev=Number(after||0)
      const pets=d.pets.map(p=>{
        if(!id(p.id)||Number(p.id)<=prev||String(p.salon_id)!==String(salonId)||String(p.client_id)!==String(clientId)||typeof p.name!=='string'||!p.name.trim()||!['dog','cat','other'].includes(p.species)||typeof p.breed!=='string')throw invalid()
        prev=Number(p.id)
        return {id:p.id,name:p.name,species:p.species,breed:p.breed}
      })
      if(d.next_cursor!==null && (!id(d.next_cursor)||pets.length!==50||String(d.next_cursor)!==String(pets.at(-1).id)))throw invalid()
      return {pets,nextCursor:d.next_cursor}
    },
    async change({salonId,appointmentId,clientId,type,petId,revision}) {
      if(!id(salonId)||!id(appointmentId)||!id(clientId)||!Number.isInteger(revision)||revision<1||revision>=2147483647)throw invalid()
      const payload={client_id:Number(clientId),...recipientPayload(type,petId),expected_recipient_revision:revision}
      const d=await read(`/api/appointments/${appointmentId}/recipient`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
      if(String(d?.salon_id)!==String(salonId)||String(d.id)!==String(appointmentId)||String(d.client_id)!==String(clientId)||d.recipient_type!==type||String(d.pet_id)!==String(payload.pet_id)||d.recipient_revision!==revision+1)throw invalid()
      if(type==='pet' && (typeof d.pet_name!=='string'||!d.pet_name.trim()||!['dog','cat','other'].includes(d.pet_species)||typeof d.pet_breed!=='string'))throw invalid()
      return d
    }
  }
}
export const appointmentRecipientApi=createAppointmentRecipientApi()
