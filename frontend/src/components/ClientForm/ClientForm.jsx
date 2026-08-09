import { useEffect, useState } from 'react'
import './ClientForm.css'

function ClientForm({
  onAddClient,
  onUpdateClient,
  onCancelEdit,
  editingClient,
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (editingClient) {
      setName(editingClient.name)
      setPhone(editingClient.phone)
    } else {
      setName('')
      setPhone('')
    }
  }, [editingClient])

  function handleSubmit() {
    if (!name.trim() || !phone.trim()) {
      return
    }

    if (editingClient) {
      onUpdateClient({
        ...editingClient,
        name: name.trim(),
        phone: phone.trim(),
      })
    } else {
      onAddClient({
        id: Date.now(),
        name: name.trim(),
        phone: phone.trim(),
        visits: 0,
      })
    }

    setName('')
    setPhone('')
  }

  return (
    <div className="client-form">
      <h2>
        {editingClient
          ? 'Uredi klijenta'
          : 'Novi klijent'}
      </h2>

      <input
        type="text"
        placeholder="Ime i prezime"
        value={name}
        onChange={(event) =>
          setName(event.target.value)
        }
      />

      <input
        type="text"
        placeholder="Telefon"
        value={phone}
        onChange={(event) =>
          setPhone(event.target.value)
        }
      />

      <div className="client-form-actions">
        <button
          type="button"
          onClick={handleSubmit}
        >
          {editingClient
            ? 'Spremi promjene'
            : 'Dodaj klijenta'}
        </button>

        {editingClient && (
          <button
            type="button"
            onClick={onCancelEdit}
          >
            Odustani
          </button>
        )}
      </div>
    </div>
  )
}

export default ClientForm