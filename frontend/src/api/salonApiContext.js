export function createSalonApiContext({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  let selectedSalonId = null
  let generation = 0

  const pendingControllers = new Set()

  function createStaleContextError() {
    const error = new Error(
      'Zahtjev pripada prethodnom salonu.'
    )

    error.name = 'AbortError'
    error.code = 'STALE_SALON_CONTEXT'

    return error
  }

  function assertCurrentGeneration(requestGeneration) {
    if (requestGeneration !== generation) {
      throw createStaleContextError()
    }
  }

  function setSalon(salonId) {
    let normalizedId = null

    if (salonId !== null) {
      if (
        !['string', 'number'].includes(typeof salonId) ||
        !/^[1-9]\d*$/.test(String(salonId)) ||
        !Number.isSafeInteger(Number(salonId))
      ) {
        throw new Error('Neispravan odabir salona.')
      }

      normalizedId = String(salonId)
    }

    generation += 1
    selectedSalonId = normalizedId

    for (const controller of pendingControllers) {
      controller.abort()
    }

    pendingControllers.clear()
  }

  async function request(path, options = {}) {
    if (
      typeof path !== 'string' ||
      !path.startsWith('/api/') ||
      path.includes('\\')
    ) {
      throw new Error(
        'Salonski zahtjevi moraju koristiti lokalnu /api/ putanju.'
      )
    }

    const { responseType = 'json', ...fetchOptions } = options
    if (!['json', 'blob'].includes(responseType)) throw new Error('Nepodržan format odgovora.')

    const requestGeneration = generation
    const requestSalonId = selectedSalonId
    const controller = new AbortController()
    const callerSignal = options.signal

    const abortFromCaller = () => controller.abort()

    if (callerSignal?.aborted) {
      controller.abort()
    } else {
      callerSignal?.addEventListener(
        'abort',
        abortFromCaller,
        { once: true }
      )
    }

    const headers = new Headers(options.headers)

    headers.delete('X-Salon-Id')

    if (requestSalonId !== null) {
      headers.set('X-Salon-Id', requestSalonId)
    }

    pendingControllers.add(controller)

    try {
      const response = await fetchImpl(path, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
        cache: 'no-store',
      })

      assertCurrentGeneration(requestGeneration)

      // Read the complete body while bound to this salon generation.
      const binary = responseType === 'blob' && response.ok
      const body = binary ? await response.arrayBuffer() : await response.text()

      assertCurrentGeneration(requestGeneration)

      return {
        ok: response.ok,
        status: response.status,
        headers: response.headers,

        async blob() {
          assertCurrentGeneration(requestGeneration)
          if (!binary) throw new Error('Fotografija nije dostupna.')
          return new Blob([body], { type: response.headers.get('content-type') || '' })
        },

        async json() {
          assertCurrentGeneration(requestGeneration)
          if (binary) throw new Error('Očekivan je binarni odgovor.')
          return JSON.parse(body)
        },
      }
    } catch (error) {
      assertCurrentGeneration(requestGeneration)
      throw error
    } finally {
      pendingControllers.delete(controller)

      callerSignal?.removeEventListener(
        'abort',
        abortFromCaller
      )
    }
  }

  return {
    setSalon,
    request,
  }
}

const salonApiContext = createSalonApiContext()

export const setActiveSalonForRequests =
  salonApiContext.setSalon

export const salonFetch =
  salonApiContext.request
