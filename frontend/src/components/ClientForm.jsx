import { useState } from 'react'

function ClientForm({ onAddClient }) {

const [name, setName] = useState('')
const [phone, setPhone] = useState('')

function handleSubmit() {

  if (!name || !phone) return

  onAddClient({
    id: Date.now(),
    name,
    phone,
    visits: 0,
  })

  setName('')
  setPhone('')

}

  return (
    <div className="client-form">

      <h2>
        Novi klijent
      </h2>

      <input
  type="text"
  placeholder="Ime i prezime"
  value={name}
  onChange={(e) => setName(e.target.value)}
/>

      <input
  type="text"
  placeholder="Telefon"
  value={phone}
  onChange={(e) => setPhone(e.target.value)}
/>

      <button onClick={handleSubmit}>
        Dodaj klijenta
      </button>

    </div>
  )
}

export default ClientForm