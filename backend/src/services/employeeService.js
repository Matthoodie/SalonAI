import {
  findEmployeesBySalonId,
} from '../repositories/employeeRepository.js'

export async function getEmployeesForSalon(
  salonId
) {
  return findEmployeesBySalonId(
    salonId
  )
}