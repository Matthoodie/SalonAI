import { useEffect, useState } from 'react'
import './ClientForm.css'

const phoneCountryOptions = [
  {
    code: '+385',
    label: 'Hrvatska',
  },
  {
    code: '+386',
    label: 'Slovenija',
  },
  {
    code: '+39',
    label: 'Italija',
  },
  {
    code: '+43',
    label: 'Austrija',
  },
  {
    code: '+49',
    label: 'Njemačka',
  },
]

function ClientForm({
  clientList = [],
  onAddClient,
  onUpdateClient,
  onCancelEdit,
  editingClient,
}) {
  const [name, setName] = useState('')

  const [
    phoneCountryCode,
    setPhoneCountryCode,
  ] = useState('+385')

  const [phoneNumber, setPhoneNumber] =
    useState('')

  const [errors, setErrors] = useState({
    name: '',
    phone: '',
  })

  useEffect(() => {
    if (editingClient) {
      setName(editingClient.name)

      setPhoneCountryCode(
        editingClient.phoneCountryCode ||
          '+385'
      )

      setPhoneNumber(
        editingClient.phoneNumber ||
          ''
      )
    } else {
      setName('')
      setPhoneCountryCode('+385')
      setPhoneNumber('')
    }

    setErrors({
      name: '',
      phone: '',
    })
  }, [editingClient])

  function normalizePhoneNumber(
    countryCode,
    number
  ) {
    const digitsOnly = String(number)
      .replace(/\D/g, '')

    const withoutLeadingZero =
      digitsOnly.startsWith('0')
        ? digitsOnly.slice(1)
        : digitsOnly

    if (!withoutLeadingZero) {
      return ''
    }

    return `${countryCode}${withoutLeadingZero}`
  }

  function handleSubmit() {
    const digitsOnly = phoneNumber.replace(
      /\D/g,
      ''
    )

    const phoneDigitsWithoutLeadingZero =
      digitsOnly.startsWith('0')
        ? digitsOnly.slice(1)
        : digitsOnly

    const newErrors = {
      name: name.trim()
        ? ''
        : 'Upišite ime i prezime klijenta.',

      phone:
        phoneDigitsWithoutLeadingZero.length >= 7
          ? ''
          : 'Unesite ispravan telefonski broj.',
    }

    setErrors(newErrors)

    const hasErrors = Object.values(
      newErrors
    ).some(
      (errorMessage) =>
        errorMessage !== ''
    )

    if (hasErrors) {
      return
    }

    const phoneNormalized =
      normalizePhoneNumber(
        phoneCountryCode,
        phoneNumber
      )

const duplicateClient = clientList.find(
  (client) => {
    const hasSamePhone =
      client.phoneNormalized ===
      phoneNormalized

    const isDifferentClient =
      !editingClient ||
      client.id !== editingClient.id

    return (
      hasSamePhone &&
      isDifferentClient
    )
  }
)

if (duplicateClient) {
  setErrors((currentErrors) => ({
    ...currentErrors,
    phone:
      `Klijent s ovim brojem već postoji: ${duplicateClient.name}.`,
  }))

  return
}

    const cleanedPhoneNumber =
      phoneNormalized.replace(
        phoneCountryCode,
        ''
      )

    if (editingClient) {
      onUpdateClient({
        ...editingClient,
        name: name.trim(),

        phone:
          `${phoneCountryCode} ${cleanedPhoneNumber}`,

        phoneCountryCode,
        phoneNumber:
          cleanedPhoneNumber,
        phoneNormalized,
      })
    } else {
      onAddClient({
        id: Date.now(),
        name: name.trim(),

        phone:
          `${phoneCountryCode} ${cleanedPhoneNumber}`,

        phoneCountryCode,
        phoneNumber:
          cleanedPhoneNumber,
        phoneNormalized,

        visits: 0,
      })
    }

    setName('')
    setPhoneCountryCode('+385')
    setPhoneNumber('')

    setErrors({
      name: '',
      phone: '',
    })
  }

  function handleNameChange(event) {
    setName(event.target.value)

    if (errors.name) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        name: '',
      }))
    }
  }

  function handlePhoneChange(event) {
    const value = event.target.value

    const allowedValue =
      value.replace(
        /[^\d\s()-]/g,
        ''
      )

    setPhoneNumber(allowedValue)

    if (errors.phone) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        phone: '',
      }))
    }
  }

  return (
    <div className="client-form">
      <h2>
        {editingClient
          ? 'Uredi klijenta'
          : 'Novi klijent'}
      </h2>

      <div className="client-form-field">
        <label htmlFor="client-name">
          Ime i prezime
        </label>

        <input
          id="client-name"
          type="text"
          placeholder="Ime i prezime"
          value={name}
          onChange={handleNameChange}
          className={
            errors.name
              ? 'client-input-error'
              : ''
          }
        />

        <p className="client-form-error">
          {errors.name || '\u00A0'}
        </p>
      </div>

      <div className="client-form-field">
        <label htmlFor="client-phone">
          Telefon
        </label>

        <div className="client-phone-field">
          <select
            value={phoneCountryCode}
            onChange={(event) =>
              setPhoneCountryCode(
                event.target.value
              )
            }
          >
            {phoneCountryOptions.map(
              (country) => (
                <option
                  key={country.code}
                  value={country.code}
                >
                  {country.label}{' '}
                  {country.code}
                </option>
              )
            )}
          </select>

          <input
            id="client-phone"
            type="tel"
            placeholder="91 123 4567"
            value={phoneNumber}
            onChange={handlePhoneChange}
            className={
              errors.phone
                ? 'client-input-error'
                : ''
            }
          />
        </div>

        <p className="client-form-error">
          {errors.phone || '\u00A0'}
        </p>
      </div>

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