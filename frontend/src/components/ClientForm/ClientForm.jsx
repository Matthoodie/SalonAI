import {useLanguage} from '../Language/LanguageProvider'
import {bookingText,bookingError} from '../Language/bookingText.js'
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
  const {language}=useLanguage()
  const f=source=>bookingText(language,source)

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
          {kind:'duplicateClient',name:duplicateClient.name},
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
    <div className={`client-form${editingClient ? ' client-form-editing' : ''}`}>
      <div className="client-form-heading">
      <span className="client-form-eyebrow">{editingClient ? f('Uređivanje podataka') : f('Novi kontakt')}</span>
      <h2 tabIndex={-1}>
        {editingClient ? f('Uredi klijenta') : f('Novi klijent')}
      </h2>
      <p className="client-form-description">
        {editingClient
          ? <>{f("Uređujete klijenta:")} <strong>{editingClient.name}</strong>{f(". Promjene potvrdite gumbom „Spremi promjene”.")}</>
          : f('Unesite osnovne podatke za novi profil klijenta.')}
      </p>
      </div>

      <div className="client-form-field">
        <label htmlFor="client-name">{f("Ime i prezime")} </label>

        <input
          id="client-name"
          type="text"
          placeholder={f("Ime i prezime")}
          value={name}
          maxLength={150}
          disabled={isSaving}
          onChange={handleNameChange}
          className={errors.name ? 'client-input-error' : ''}
        />

        <p className="client-form-error">
          {errors.name ? bookingError(language,errors.name) : '\u00A0'}
        </p>
      </div>

      <div className="client-form-field">
        <label htmlFor="client-type">{f("Vrsta klijenta")} </label>

        <select
          id="client-type"
          value={isOccasional ? 'occasional' : 'regular'}
          disabled={isSaving}
          onChange={(event) => {
            setIsOccasional(event.target.value === 'occasional')
            setErrors((current) => ({ ...current, phone: '' }))
          }}
        >
          <option value="regular">{f("Stalni klijent")}</option>
          <option value="occasional">{f("Povremeni klijent")}</option>
        </select>
      </div>

      <div className="client-form-field">
        <label htmlFor="client-phone">
          {isOccasional ? f('Telefon (neobavezno)') : f('Telefon')}
        </label>

        <div className="client-phone-field">
          <select
            aria-label={f("Pozivni broj države")}
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
                {f(country.label)} {country.code}
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
          {errors.phone ? bookingError(language,errors.phone) : '\u00A0'}
        </p>
      </div>

      {saveError && (
        <p className="client-form-error" role="alert">
          {bookingError(language,saveError)}
        </p>
      )}

      <div className="client-form-actions">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
        >
          {isSaving
            ? f('Spremanje...')
            : editingClient
              ? f('Spremi promjene')
              : f('Dodaj klijenta')}
        </button>

        {editingClient && (
          <button
            type="button"
            onClick={onCancelEdit}
            disabled={isSaving}
          >{f("Odustani")} </button>
        )}
      </div>
    </div>
  )
}

export default ClientForm
