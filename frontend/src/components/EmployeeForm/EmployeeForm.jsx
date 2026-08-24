import {
  useEffect,
  useState,
} from 'react'

import './EmployeeForm.css'

function EmployeeForm({
  serviceList = [],
  onAddEmployee,
  onUpdateEmployee,
  onCancelEdit,
  editingEmployee,
}) {
  const [name, setName] = useState('')
  const [selectedServiceIds, setSelectedServiceIds] =
    useState([])

    useEffect(() => {
  if (editingEmployee) {
    setName(
      editingEmployee.name || ''
    )

    setSelectedServiceIds(
      editingEmployee.serviceIds || []
    )
  } else {
    setName('')
    setSelectedServiceIds([])
  }
}, [editingEmployee])

  function toggleService(serviceId) {
    setSelectedServiceIds((currentIds) =>
      currentIds.includes(serviceId)
        ? currentIds.filter(
            (id) => id !== serviceId
          )
        : [...currentIds, serviceId]
    )
  }

  function handleSubmit(event) {
    event.preventDefault()

    const trimmedName = name.trim()

    if (!trimmedName) {
      window.alert(
        'Unesite ime zaposlenika.'
      )

      return
    }

   if (editingEmployee) {
  onUpdateEmployee({
    ...editingEmployee,
    name: trimmedName,
    serviceIds: selectedServiceIds,
  })
} else {
  const newEmployee = {
    id: Date.now(),
    name: trimmedName,
    active: true,
    serviceIds: selectedServiceIds,
  }

  onAddEmployee(newEmployee)
}

    setName('')
    setSelectedServiceIds([])
  }

  return (
    <form
      className="employee-form"
      onSubmit={handleSubmit}
    >
      <div className="employee-form-header">
        <div>
          <span className="employee-form-eyebrow">
  {editingEmployee
    ? 'Uređivanje zaposlenika'
    : 'Novi član tima'}
</span>

<h2>
  {editingEmployee
    ? 'Uredi zaposlenika'
    : 'Dodaj zaposlenika'}
</h2>

<p>
  {editingEmployee
    ? 'Promijenite podatke zaposlenika i njegove usluge.'
    : 'Dodajte zaposlenika i odaberite usluge koje može obavljati.'}
</p>
        </div>
      </div>

      <div className="employee-form-field">
        <label htmlFor="employee-name">
          Ime i prezime
        </label>

        <input
          id="employee-name"
          type="text"
          value={name}
          placeholder="npr. Ivana Horvat"
          onChange={(event) =>
            setName(event.target.value)
          }
        />
      </div>

      <fieldset className="employee-services-fieldset">
        <legend>Usluge zaposlenika</legend>

        {serviceList.length === 0 ? (
          <p className="employee-services-empty">
            Trenutno nema dostupnih usluga.
          </p>
        ) : (
          <div className="employee-service-options">
            {serviceList.map((service) => (
              <label
                key={service.id}
                className="employee-service-option"
              >
                <input
                  type="checkbox"
                  checked={
                    selectedServiceIds.includes(
                      service.id
                    )
                  }
                  onChange={() =>
                    toggleService(service.id)
                  }
                />

                <span>
                  {service.name}
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="employee-form-actions">
  <button
    type="submit"
    className="employee-form-submit"
  >
    {editingEmployee
      ? 'Spremi promjene'
      : 'Dodaj zaposlenika'}
  </button>

  {editingEmployee && (
    <button
      type="button"
      className="employee-form-cancel"
      onClick={onCancelEdit}
    >
      Odustani
    </button>
  )}
</div>
    </form>
  )
}

export default EmployeeForm
