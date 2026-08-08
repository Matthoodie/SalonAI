import { useEffect, useState } from 'react'
import './ServiceForm.css'

function ServiceForm({
  onAddService,
  onUpdateService,
  onCancel,
  editingService,
}) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [
    defaultDurationMinutes,
    setDefaultDurationMinutes,
  ] = useState('')

  const [errors, setErrors] = useState({
    name: '',
    price: '',
  })

  useEffect(() => {
    if (editingService) {
      setName(editingService.name)
      setPrice(String(editingService.price))
      setDefaultDurationMinutes(
        editingService.defaultDurationMinutes
          ? String(editingService.defaultDurationMinutes)
          : ''
      )
    } else {
      setName('')
      setPrice('')
      setDefaultDurationMinutes('')
    }

    setErrors({
      name: '',
      price: '',
    })
  }, [editingService])

  function handleSubmit() {
    const parsedPrice = Number(price)

    const parsedDuration =
      defaultDurationMinutes === ''
        ? null
        : Number(defaultDurationMinutes)

    const newErrors = {
      name: name.trim()
        ? ''
        : 'Upišite naziv usluge.',

      price:
        price !== '' &&
        !Number.isNaN(parsedPrice) &&
        parsedPrice >= 0
          ? ''
          : 'Upišite ispravnu cijenu.',
    }

    setErrors(newErrors)

    const hasErrors = Object.values(newErrors).some(
      (errorMessage) => errorMessage !== ''
    )

    if (hasErrors) {
      return
    }

    if (editingService) {
      onUpdateService({
        ...editingService,
        name: name.trim(),
        price: parsedPrice,
        defaultDurationMinutes:
          parsedDuration &&
          parsedDuration > 0
            ? parsedDuration
            : null,
      })
    } else {
      onAddService({
        id: Date.now(),
        name: name.trim(),
        price: parsedPrice,
        defaultDurationMinutes:
          parsedDuration &&
          parsedDuration > 0
            ? parsedDuration
            : null,
        active: true,
      })
    }
  }

  return (
    <div className="service-form">
      <div className="service-form-header">
        <div>
          <span className="service-form-eyebrow">
            {editingService
              ? 'Uređivanje usluge'
              : 'Nova usluga'}
          </span>

          <h2>
            {editingService
              ? 'Uredi uslugu'
              : 'Dodaj uslugu'}
          </h2>
        </div>

        <button
          type="button"
          className="service-form-close-button"
          onClick={onCancel}
          aria-label="Zatvori formu"
        >
          ×
        </button>
      </div>

      <div className="service-form-field">
        <label htmlFor="service-name">
          Naziv usluge
        </label>

        <input
          id="service-name"
          type="text"
          value={name}
          onChange={(event) => {
            setName(event.target.value)

            if (errors.name) {
              setErrors((currentErrors) => ({
                ...currentErrors,
                name: '',
              }))
            }
          }}
          placeholder="npr. Muško šišanje"
          className={
            errors.name
              ? 'service-input-error'
              : ''
          }
        />

        <p className="service-form-error">
          {errors.name || '\u00A0'}
        </p>
      </div>

      <div className="service-form-field">
        <label htmlFor="service-price">
          Cijena (€)
        </label>

        <input
          id="service-price"
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(event) => {
            setPrice(event.target.value)

            if (errors.price) {
              setErrors((currentErrors) => ({
                ...currentErrors,
                price: '',
              }))
            }
          }}
          placeholder="18"
          className={
            errors.price
              ? 'service-input-error'
              : ''
          }
        />

        <p className="service-form-error">
          {errors.price || '\u00A0'}
        </p>
      </div>

      <div className="service-form-field">
        <label htmlFor="service-duration">
          Zadano trajanje (min)
        </label>

        <input
          id="service-duration"
          type="number"
          min="1"
          step="1"
          value={defaultDurationMinutes}
          onChange={(event) =>
            setDefaultDurationMinutes(
              event.target.value
            )
          }
          placeholder="Opcionalno"
        />

        <p className="service-form-help">
          Trajanje je opcionalno i služi kao
          očekivano zadano trajanje usluge.
        </p>
      </div>

      <div className="service-form-actions">
        <button
          type="button"
          className="service-form-primary-button"
          onClick={handleSubmit}
        >
          {editingService
            ? 'Spremi promjene'
            : 'Dodaj uslugu'}
        </button>

        <button
          type="button"
          className="service-form-secondary-button"
          onClick={onCancel}
        >
          Odustani
        </button>
      </div>
    </div>
  )
}

export default ServiceForm