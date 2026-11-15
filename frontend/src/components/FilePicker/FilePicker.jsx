import { useId, useRef } from 'react'
import { useLanguage } from '../Language/LanguageProvider'
import './FilePicker.css'

// The parent owns the accepted File. Cancelling the native dialog preserves it.
export default function FilePicker({ id, label, file, accept, disabled = false, onSelect, invalid = false, describedBy }) {
  const generatedId = useId(), inputRef = useRef(null)
  const inputId = id || generatedId
  const { language } = useLanguage()
  const en = language === 'en'
  const buttonText = file ? (en ? 'Change file' : 'Promijeni datoteku') : (en ? 'Choose file' : 'Odaberi datoteku')
  return <div className="app-file-picker">
    <span id={`${inputId}-label`} className="app-file-picker-label">{label}</span>
    <div className="app-file-picker-control" data-disabled={disabled || undefined} data-invalid={invalid || undefined}>
      <input ref={inputRef} id={inputId} type="file" hidden tabIndex={-1} accept={accept} disabled={disabled}
        onChange={event => {
          const selected = event.target.files?.[0]
          event.target.value = ''
          if (selected && !disabled) onSelect(selected)
        }} />
      <button type="button" disabled={disabled} aria-labelledby={`${inputId}-label ${inputId}-button`}
        aria-describedby={[`${inputId}-name`, describedBy].filter(Boolean).join(' ')}
        aria-invalid={invalid || undefined} onClick={() => inputRef.current?.click()}>
        <span id={`${inputId}-button`}>{buttonText}</span>
      </button>
      <span id={`${inputId}-name`} className="app-file-picker-name" role="status" aria-live="polite" aria-atomic="true">
        {file ? file.name : (en ? 'No file selected' : 'Nije odabrana datoteka')}
      </span>
    </div>
  </div>
}
