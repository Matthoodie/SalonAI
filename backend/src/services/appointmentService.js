import {
  findAllAppointments,
  findAppointmentById,
} from '../repositories/appointmentRepository.js'

export async function getAllAppointments() {
  return findAllAppointments()
}

export async function getAppointmentById(id) {
  return findAppointmentById(id)
}