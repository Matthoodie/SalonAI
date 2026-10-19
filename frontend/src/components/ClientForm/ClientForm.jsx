import { useEffect, useState } from 'react'
import './ClientForm.css'

const phoneCountryOptions = [
  { code: '+385', label: 'Hrvatska' },
  { code: '+386', label: 'Slovenija' },
  { code: '+39', label: 'Italija' },
  { code: '+43', label: 'Austrija' },
  { code: '+49', label: 'Njemačka' },
]

function ClientForm({
  clientList = [],
  onAddClient,
  onUpdateClient,
  onCancelEdit,
  editingClient,
}) {
  const [name, setName] = useState('')
  const [isOccasional, setIsOccasional] = useState(false)
  const [phoneCountryCode, setPhoneCountryCode] = useState('+385')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [errors, setErrors] = useState({ name: '', phone: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    setName(editingClient?.name ?? '')
    setIsOccasional(editingClient?.isOccasional === true)
    setPhoneCountryCode(editingClient?.phoneCountryCode || '+385')
    setPhoneNumber(editingClient?.phoneNumber || '')
    setErrors({ name: '', phone: '' })
    setSaveError('')
  }, [editingClient])

  async function handleSubmit() {
    if (isSaving) {
      return
    }

    setSaveError('')

    const cleanName = name.trim()
    const hasPhoneInput = phoneNumber.trim() !== ''
    const digitsOnly = phoneNumber.replace(/\D/g, '')
    const cleanedPhoneNumber = digitsOnly.startsWith('0')
      ? digitsOnly.slice(1)
      : digitsOnly

    const requiresPhoneValidation =
      !isOccasional || hasPhoneInput

    const phoneNormalized = hasPhoneInput
      ? `${phoneCountryCode}${cleanedPhoneNumber}`
      : null

    const newErrors = {
      name:
        cleanName.length > 0 && cleanName.length <= 150
          ? ''
          : 'Upišite ime klijenta, najviše 150 znakova.',
      phone:
        requiresPhoneValidation &&
        (
          cleanedPhoneNumber.length < 7 ||
          cleanedPhoneNumber.length > 30 ||
          (phoneNormalized?.length ?? 0) > 30
        )
          ? 'Unesite ispravan telefonski broj.'
          : '',
    }

    setErrors(newErrors)

    if (Object.values(newErrors).some(Boolean)) {
      return
    }

    const duplicateClient = phoneNormalized
      ? clientList.find((client) => (
          client.phoneNormalized === phoneNormalized &&
          (
            !editingClient ||
            String(client.id) !== String(editingClient.id)
          )
        ))
      : null

    if (duplicateClient) {
      setErrors((current) => ({
        ...current,
        phone:
          `Klijent s ovim brojem već postoji: ${duplicateClient.name}.`,
      }))
      return
    }

    const clientPayload = {
      ...(editingClient ?? {}),
      name: cleanName,
      isOccasional,
      phoneCountryCode: hasPhoneInput ? phoneCountryCode : null,
      phoneNumber: hasPhoneInput ? cleanedPhoneNumber : null,
      phoneNormalized,
      phone: hasPhoneInput
        ? `${phoneCountryCode} ${cleanedPhoneNumber}`
        : '',
    }

    setIsSaving(true)

    try {
      const result = editingClient
        ? await onUpdateClient(clientPayload)
        : await onAddClient(clientPayload)

      if (result === false) {
        setSaveError('Podaci nisu spremljeni. Pokušajte ponovno.')
        return
      }

      setName('')
      setIsOccasional(false)
      setPhoneCountryCode('+385')
      setPhoneNumber('')
      setErrors({ name: '', phone: '' })
    } catch (error) {
      setSaveError(
        error?.message ||
        'Klijenta nije moguće spremiti. Pokušajte ponovno.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  function handleNameChange(event) {
    setName(event.target.value)
    setErrors((current) => ({ ...current, name: '' }))
  }

  function handlePhoneChange(event) {
    setPhoneNumber(
      event.target.value.replace(/[^\d\s()-]/g, '')
    )
    setErrors((current) => ({ ...current, phone: '' }))
  }

  return (
    <div className="client-form">
      <h2>
        {editingClient ? 'Uredi klijenta' : 'Novi klijent'}
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
          maxLength={150}
          disabled={isSaving}
          onChange={handleNameChange}
          className={errors.name ? 'client-input-error' : ''}
        />

        <p className="client-form-error">
          {errors.name || '\u00A0'}
        </p>
      </div>

      <div className="client-form-field">
        <label htmlFor="client-type">
          Vrsta klijenta
        </label>

        <select
          id="client-type"
          value={isOccasional ? 'occasional' : 'regular'}
          disabled={isSaving}
          onChange={(event) => {
            setIsOccasional(event.target.value === 'occasional')
            setErrors((current) => ({ ...current, phone: '' }))
          }}
        >
          <option value="regular">Stalni klijent</option>
          <option value="occasional">Povremeni klijent</option>
        </select>
      </div>

      <div className="client-form-field">
        <label htmlFor="client-phone">
          {isOccasional ? 'Telefon (neobavezno)' : 'Telefon'}
        </label>

        <div className="client-phone-field">
          <select
            aria-label="Pozivni broj države"
            value={phoneCountryCode}
            disabled={isSaving}
            onChange={(event) => {
              setPhoneCountryCode(event.target.value)
              setErrors((current) => ({ ...current, phone: '' }))
            }}
          >
            {!phoneCountryOptions.some(
              (country) => country.code === phoneCountryCode
            ) && (
              <option value={phoneCountryCode}>
                {phoneCountryCode}
              </option>
            )}

            {phoneCountryOptions.map((country) => (
              <option key={country.code} value={country.code}>
                {country.label} {country.code}
              </option>
            ))}
          </select>

          <input
            id="client-phone"
            type="tel"
            placeholder="91 123 4567"
            value={phoneNumber}
            disabled={isSaving}
            onChange={handlePhoneChange}
            className={errors.phone ? 'client-input-error' : ''}
          />
        </div>

        <p className="client-form-error">
          {errors.phone || '\u00A0'}
        </p>
      </div>

      {saveError && (
        <p className="client-form-error" role="alert">
          {saveError}
        </p>
      )}

      <div className="client-form-actions">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
        >
          {isSaving
            ? 'Spremanje...'
            : editingClient
              ? 'Spremi promjene'
              : 'Dodaj klijenta'}
        </button>

        {editingClient && (
          <button
            type="button"
            onClick={onCancelEdit}
            disabled={isSaving}
          >
            Odustani
          </button>
        )}
      </div>
    </div>
  )
}

export default ClientForm