import { salonFetch } from './salonApiContext.js'
import { serviceIds, serviceSummary, sameServiceSelection } from './appointmentItemsView.js'

export function createAppointmentServicesApi({ request = salonFetch } = {}) {
  async function read(response) {
    const body = await response.json()
    if (!response.ok) {
      const messages = {
        APPOINTMENT_CONFLICT: 'Zaposlenik već ima termin koji se preklapa s ukupnim trajanjem odabranih usluga.',
        EMPLOYEE_NOT_QUALIFIED: 'Zaposlenik ne pruža sve odabrane usluge.',
        SERVICE_INACTIVE: 'Jedna od odabranih usluga više nije aktivna.',
        EMPLOYEE_UNAVAILABLE: 'Zaposlenik nije dostupan u odabranom razdoblju.',
        EMPLOYEE_NOT_WORKING: 'Zaposlenik ne radi odabranog dana.',
        APPOINTMENT_OUTSIDE_WORKING_HOURS: 'Ukupno trajanje usluga ne stane u radno vrijeme zaposlenika.',
        APPOINTMENT_SERVICES_CHANGE_NOT_ALLOWED: 'Usluge je moguće mijenjati samo na aktivnom terminu.',
        APPOINTMENT_TOTAL_TOO_LARGE: 'Ukupna cijena ili trajanje prelaze dopuštenu vrijednost.',
      }
      const error = new Error(messages[body?.error?.code] || body?.error?.message || 'Zahtjev za termin nije uspio.')
      error.code = body?.error?.code || 'APPOINTMENT_REQUEST_FAILED'
      error.status = response.status
      throw error
    }
    return body.data
  }
  return {
    async availability({ employeeId, ids, date, timezone, signal }) {
      const selected = serviceIds(ids)
      const [employee] = serviceIds([employeeId])
      const params = new URLSearchParams({ employeeId: String(employee), serviceIds: selected.join(','), date, slotIntervalMinutes: '15' })
      const data = await read(await request('/api/availability?' + params, { signal }))
      if (String(data?.employeeId) !== String(employee) || data?.date !== date ||
          data?.timezone !== timezone || data?.slotIntervalMinutes !== 15 || !Array.isArray(data?.serviceIds) ||
          !sameServiceSelection(data.serviceIds, selected) ||
          !Number.isSafeInteger(data.durationMinutes) || data.durationMinutes < 1 ||
          !Array.isArray(data.availableSlots) ||
          data.availableSlots.some(slot => typeof slot !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot))) {
        throw new Error('Odgovor dostupnosti ne odgovara odabranim uslugama. Osvježite podatke.')
      }
      return data
    },
    async change(appointmentId, ids) {
      const [id] = serviceIds([appointmentId])
      const selected = serviceIds(ids)
      const data = await read(await request('/api/appointments/' + id + '/services', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_ids: selected }),
      }))
      const summary = serviceSummary(data)
      if (String(data.id) !== String(id) || !sameServiceSelection(summary.serviceIds, selected)) {
        throw new Error('Spremanje nije potvrđeno. Osvježite termine prije ponovnog pokušaja.')
      }
      return data
    },
  }
}
export const appointmentServicesApi = createAppointmentServicesApi()
