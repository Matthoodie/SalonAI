import {useLanguage} from '../Language/LanguageProvider'
import {serviceText} from '../Language/serviceText.js'
import { useEffect, useRef, useState } from 'react'
import './ServiceForm.css'
import {focusProblem,serviceExamples} from '../Onboarding/onboardingPresentation.js'

function ServiceForm({
  onAddService,
  onUpdateService,
  onCancel,
  editingService,
  focusRequest = 0,
  businessType,
  isCreating = false,
  isUpdating = false,
}) {
  const {language}=useLanguage()
  const f=source=>serviceText(language,source)

  const examples = serviceExamples(businessType)
  const formRef = useRef(null)
  const nameInputRef = useRef(null)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const form = formRef.current
      const input = nameInputRef.current
      if (!form || !input) return
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      input.focus({ preventScroll: true })
      form.scrollIntoView({
        behavior: reducedMotion ? 'instant' : 'smooth',
        block: 'start',
        inline: 'nearest',
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focusRequest])

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
      focusProblem("service-"+Object.keys(newErrors).find(key=>newErrors[key]))
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
    <div
      ref={formRef}
      className={`service-form${editingService ? ' service-form-editing' : ''}`}
    >
      <div className="service-form-header">
        <div>
          <span className="service-form-eyebrow">
            {editingService
              ? f('Uređivanje usluge')
              : f('Nova usluga')}
          </span>

          <h2>
            {editingService
              ? f('Uredi uslugu')
              : f('Dodaj uslugu')}
          </h2>
        </div>

        <button
          type="button"
          className="service-form-close-button"
          onClick={onCancel}
          aria-label={f("Zatvori formu")}
          disabled={isSaving}
        >
          ×
        </button>
      </div>

      <div className="service-form-field">
        <label htmlFor="service-name">{f("Naziv usluge")} </label>

        <input
          ref={nameInputRef}
          id="service-name"
          aria-required="true"
          aria-invalid={Boolean(errors.name)}
          aria-describedby="service-name-error"
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
          placeholder={f(examples.name)}
          className={
            errors.name
              ? 'service-input-error'
              : ''
          }
        />

        <p id="service-name-error" className="service-form-error">
          {f(errors.name) || '\u00A0'}
        </p>
      </div>

      <div className="service-form-field">
        <label htmlFor="service-category">{f("Kategorija")} </label>

        <input
          id="service-category"
          type="text"
          value={category}
          onChange={(event) =>
            setCategory(
              event.target.value
            )
          }
          placeholder={f(examples.category)}
        />

        <p className="service-form-help">{f("Ako kategoriju ne unesete, usluga će biti spremljena pod \"Ostalo\".")} </p>
      </div>

      <div className="service-form-field">
        <label htmlFor="service-price">{f("Cijena (€)")} </label>

        <input
          id="service-price"
          aria-required="true"
          aria-invalid={Boolean(errors.price)}
          aria-describedby="service-price-error"
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

        <p id="service-price-error" className="service-form-error">
          {f(errors.price) || '\u00A0'}
        </p>
      </div>

      <div className="service-form-field">
        <label htmlFor="service-duration">{f("Zadano trajanje (min)")} </label>

        <input
          id="service-duration"
          aria-required="true"
          aria-invalid={Boolean(errors.duration)}
          aria-describedby="service-duration-error"
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
          placeholder={f("npr. 30")}
          className={
            errors.duration
              ? 'service-input-error'
              : ''
          }
        />

        <p id="service-duration-error" className="service-form-error">
          {f(errors.duration) || '\u00A0'}
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
            ? f('Spremanje...')
            : editingService
              ? f('Spremi promjene')
              : f('Dodaj uslugu')}
        </button>

        <button
          type="button"
          className="service-form-secondary-button"
          onClick={onCancel}
          disabled={isSaving}
        >{f("Odustani")} </button>
      </div>
    </div>
  )
}

export default ServiceForm
