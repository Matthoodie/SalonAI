import { useState } from 'react'
import ServiceSelection from './ServiceSelection.jsx'
import { draftItems, sumItems, sameServiceSelection, employeeSupportsServices, canChangeAppointmentServices } from '../../api/appointmentItemsView.js'

export default function AppointmentServicesEditor({ appointment, services, employee, authContext, onSave, disabled, otherChanges, onDirtyChange }) {
  const originalIds = appointment.serviceIds ?? [appointment.serviceId]
  const [ids, setIds] = useState(originalIds)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  if (!canChangeAppointmentServices(authContext, appointment)) return null
  const changed = !sameServiceSelection(ids, originalIds)
  function changeIds(next) { setIds(next); setError(''); onDirtyChange(!sameServiceSelection(next, originalIds)) }
  async function save() {
    if (disabled || saving || !changed || otherChanges) return
    try {
      setError('')
      const items = draftItems(ids, services, appointment.items ?? [])
      sumItems(items)
      if (!employeeSupportsServices(employee, ids)) throw new Error('Zaposlenik mora pružati sve odabrane usluge.')
      setSaving(true)
      await onSave(appointment, ids)
    } catch (failure) {
      setError(failure.message || 'Usluge nisu spremljene.')
    } finally { setSaving(false) }
  }
  return <section className="appointment-services-editor">
    <h3>Promijeni usluge</h3>
    <p>Početak termina i zaposlenik ostaju isti. Postojeće stavke zadržavaju spremljenu cijenu i trajanje; dodane stavke koriste aktualni cjenik.</p>
    <ServiceSelection ids={ids} onChange={changeIds} services={services} previous={appointment.items ?? []} disabled={disabled || saving} />
    {otherChanges && <p role="status">Najprije spremite ili poništite promjene klijenta i vremena. Usluge se spremaju zasebno.</p>}
    {error && <p role="alert">{error}</p>}
    <button type="button" onClick={save} disabled={disabled || saving || !changed || otherChanges}>
      {saving ? 'Spremanje usluga…' : 'Spremi usluge termina'}
    </button>
    {changed && <button type="button" disabled={disabled || saving} onClick={() => { changeIds(originalIds) }}>Poništi odabir usluga</button>}
  </section>
}
