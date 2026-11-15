import { useLanguage } from '../Language/LanguageProvider.jsx'
import { requestText } from '../Language/requestText.js'
import { Component, Suspense } from 'react'
import { useLocation } from 'react-router-dom'

class PageErrorBoundary extends Component {
  state = {
    hasError: false,
  }

  static getDerivedStateFromError() {
    return {
      hasError: true,
    }
  }

  componentDidCatch(error, info) {
    console.error(
      'Neuspješno učitavanje ili prikaz stranice:',
      error,
      info.componentStack
    )
  }

  render() {
    const tx = source => requestText(this.props.language, source)
    if (this.state.hasError) {
      return (
        <section
          aria-labelledby="page-error-title"
          style={{ padding: '20px 0' }}
        >
          <h2 id="page-error-title">
            {tx("Stranicu nije moguće prikazati")}
          </h2>

          <p role="alert">
            {tx("Provjerite internetsku vezu pa ponovno učitajte aplikaciju. Možete pokušati otvoriti i drugu stranicu putem bočnog izbornika.")}
          </p>

          <p>
            {tx("Ponovno učitavanje aplikacije odbacit će nespremljene unose.")}
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
          >
            {tx("Ponovno učitaj aplikaciju")}
          </button>
        </section>
      )
    }

    return this.props.children
  }
}

function PageBoundary({ children }) {
  const location = useLocation()
  const { language } = useLanguage()

  return (
    <PageErrorBoundary key={location.pathname} language={language}>
      <Suspense
        fallback={
          <div
            role="status"
            aria-live="polite"
            style={{ padding: '20px 0' }}
          >
            {requestText(language, 'Učitavanje stranice…')}
          </div>
        }
      >
        {children}
      </Suspense>
    </PageErrorBoundary>
  )
}

export default PageBoundary
