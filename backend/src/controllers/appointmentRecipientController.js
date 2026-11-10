import { SALON_PERMISSION_KEYS } from '../permissions/salonPermissions.js'
import { resolveAppointmentPermissionScope } from '../services/salonPermissionService.js'
import { getBookingPetOptions, changeAppointmentRecipient } from '../services/appointmentRecipientService.js'
import { recipientId } from '../utils/appointmentRecipient.js'
export async function bookingPetOptions(req,res,next) {
  res.set('Cache-Control','no-store')
  try {
    const salonId=recipientId(req.currentSalon?.id)
    const appointmentId=req.query.appointment_id===undefined?null:recipientId(req.query.appointment_id)
    const clientId=recipientId(req.query.client_id)
    const afterId=req.query.after===undefined?0:recipientId(req.query.after)
    const scope=await resolveAppointmentPermissionScope({salonId,membership:req.currentMembership,
      permissionKey:appointmentId===null?SALON_PERMISSION_KEYS.APPOINTMENT_CREATE:SALON_PERMISSION_KEYS.APPOINTMENT_CHANGE_CLIENT})
    const data=await getBookingPetOptions({salonId,clientId,afterId,appointmentId,employeeScope:scope.employeeId})
    res.json({data})
  } catch(error) { next(error) }
}
export async function updateAppointmentRecipient(req,res,next) {
  res.set('Cache-Control','no-store')
  try {
    const salonId=recipientId(req.currentSalon?.id),appointmentId=recipientId(req.params.id)
    const scope=await resolveAppointmentPermissionScope({salonId,membership:req.currentMembership,
      permissionKey:SALON_PERMISSION_KEYS.APPOINTMENT_CHANGE_CLIENT})
    const data=await changeAppointmentRecipient({salonId,appointmentId,employeeScope:scope.employeeId,body:req.body})
    res.json({data})
  } catch(error) { next(error) }
}
