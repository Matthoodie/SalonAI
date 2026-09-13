import { useEffect, useState } from 'react'
import './ServiceForm.css'

function ServiceForm({
  onAddService,
  onUpdateService,
  onCancel,
  editingService,
  isCreating = false,
  isUpdating = false,
}) {
  const isSaving =
    isCreating || isUpdating

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('')

  const [
    defaultDurationMinutes,
    setDefaultDurationMinutes,
  ] = useState('')

  const [errors, setErrors] = useState({
    name: '',
    price: '',
    duration: '',
  })

  useEffect(() => {
    if (editingService) {
      setName(editingService.name)

      setCategory(
        editingService.category || ''
      )

      setPrice(
        String(editingService.price)
      )

      setDefaultDurationMinutes(
        editingService.defaultDurationMinutes
          ? String(
            editingService.defaultDurationMinutes
          )
          : ''
      )
    } else {
      setName('')
      setCategory('')
      setPrice('')
      setDefaultDurationMinutes('')
    }

    setErrors({
      name: '',
      price: '',
      duration: '',
    })
  }, [editingService])

  async function handleSubmit() {
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

      duration:
        parsedDuration !== null &&
          Number.isSafeInteger(
            parsedDuration
          ) &&
          parsedDuration > 0
          ? ''
          : 'Upišite ispravno trajanje usluge.',
    }

    setErrors(newErrors)

    const hasErrors =
      Object.values(newErrors).some(
        (errorMessage) =>
          errorMessage !== ''
      )

    if (hasErrors) {
      return
    }

    if (editingService) {
      const updateSucceeded =
        await onUpdateService({
          ...editingService,

          name: name.trim(),

          category:
            category.trim() || 'Ostalo',

          price: parsedPrice,

          defaultDurationMinutes:
            parsedDuration,
        })

      if (!updateSucceeded) {
        return
      }
    } else {
      const createSucceeded =
        await onAddService({
          name: name.trim(),

          category:
            category.trim() || 'Ostalo',

          price: parsedPrice,

          defaultDurationMinutes:
            parsedDuration,
        })

      if (!createSucceeded) {
        return
      }
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
          disabled={isSaving}
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
              setErrors(
                (currentErrors) => ({
                  ...currentErrors,
                  name: '',
                })
              )
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
        <label htmlFor="service-category">
          Kategorija
        </label>

        <input
          id="service-category"
          type="text"
          value={category}
          onChange={(event) =>
            setCategory(
              event.target.value
            )
          }
          placeholder="npr. Šišanje"
        />

        <p className="service-form-help">
          Ako kategoriju ne unesete,
          usluga će biti spremljena pod
          "Ostalo".
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
              setErrors(
                (currentErrors) => ({
                  ...currentErrors,
                  price: '',
                })
              )
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
          value={
            defaultDurationMinutes
          }
          onChange={(event) => {
            setDefaultDurationMinutes(
              event.target.value
            )

            if (errors.duration) {
              setErrors(
                (currentErrors) => ({
                  ...currentErrors,
                  duration: '',
                })
              )
            }
          }}
          placeholder="npr. 30"
          className={
            errors.duration
              ? 'service-input-error'
              : ''
          }
        />

        <p className="service-form-error">
          {errors.duration || '\u00A0'}
        </p>
      </div>

      <div className="service-form-actions">
        <button
          type="button"
          className="service-form-primary-button"
          onClick={handleSubmit}
          disabled={isSaving}
        >
          {isSaving
            ? 'Spremanje...'
            : editingService
              ? 'Spremi promjene'
              : 'Dodaj uslugu'}
        </button>

        <button
          type="button"
          className="service-form-secondary-button"
          onClick={onCancel}
          disabled={isSaving}
        >
          Odustani
        </button>
      </div>
    </div>
  )
}

export default ServiceForm