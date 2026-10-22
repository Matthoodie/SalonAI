import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createSalonApiContext,
} from '../../frontend/src/api/salonApiContext.js'

function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

test('salon request: selected context controls header and preserves request body', async () => {
  let capturedOptions

  const context = createSalonApiContext({
    fetchImpl: async (path, options) => {
      assert.equal(path, '/api/appointments')
      capturedOptions = options

      return jsonResponse({ data: { id: 5 } })
    },
  })

  context.setSalon(12)

  const response = await context.request('/api/appointments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Salon-Id': '999',
    },
    body: '{"client_id":7}',
  })

  assert.equal(capturedOptions.headers.get('X-Salon-Id'), '12')
  assert.equal(
    capturedOptions.headers.get('Content-Type'),
    'application/json'
  )
  assert.equal(capturedOptions.method, 'POST')
  assert.equal(capturedOptions.body, '{"client_id":7}')
  assert.equal(capturedOptions.cache, 'no-store')
  assert.deepEqual(await response.json(), { data: { id: 5 } })
})

test('salon request: no selection sends no salon header', async () => {
  const context = createSalonApiContext({
    fetchImpl: async (path, options) => {
      assert.equal(options.headers.has('X-Salon-Id'), false)
      return jsonResponse({ data: [] })
    },
  })

  await context.request('/api/employees', {
    headers: { 'X-Salon-Id': '999' },
  })
})

test('salon request: switching aborts pending request and rejects late response', async () => {
  let finishRequest
  let capturedSignal

  const context = createSalonApiContext({
    fetchImpl: (path, options) => {
      capturedSignal = options.signal

      return new Promise((resolve) => {
        finishRequest = resolve
      })
    },
  })

  context.setSalon(1)

  const pending = context.request('/api/clients')

  context.setSalon(2)

  assert.equal(capturedSignal.aborted, true)

  finishRequest(jsonResponse({ data: ['old salon'] }))

  await assert.rejects(pending, {
    name: 'AbortError',
    code: 'STALE_SALON_CONTEXT',
  })
})

test('salon request: response already received cannot be consumed after switching', async () => {
  const context = createSalonApiContext({
    fetchImpl: async () =>
      jsonResponse({ data: ['old salon'] }),
  })

  context.setSalon(1)

  const response = await context.request('/api/clients')

  context.setSalon(2)

  await assert.rejects(
    () => response.json(),
    {
      code: 'STALE_SALON_CONTEXT',
    }
  )
})

test('salon request: caller cancellation is forwarded', async () => {
  const caller = new AbortController()
  let capturedSignal
  let finishRequest

  const context = createSalonApiContext({
    fetchImpl: (path, options) => {
      capturedSignal = options.signal

      return new Promise((resolve) => {
        finishRequest = resolve
      })
    },
  })

  const pending = context.request('/api/clients/search?q=Ana', {
    signal: caller.signal,
  })

  caller.abort()

  assert.equal(capturedSignal.aborted, true)

  finishRequest(jsonResponse({ data: [] }))
  await pending
})

test('salon request: invalid selection and external URLs are rejected', async () => {
  let fetchCalls = 0

  const context = createSalonApiContext({
    fetchImpl: async () => {
      fetchCalls += 1
      return jsonResponse({})
    },
  })

  for (const value of [
    undefined,
    '',
    0,
    -1,
    1.5,
    true,
    [],
    '1e2',
    '1,2',
  ]) {
    assert.throws(() => context.setSalon(value))
  }

  for (const path of [
    'https://example.test/api/clients',
    '//example.test/api/clients',
    '/clients',
  ]) {
    await assert.rejects(
      () => context.request(path)
    )
  }

  assert.equal(fetchCalls, 0)
})

test('salon request: clearing context removes selection for subsequent requests', async () => {
  const recorded = []

  const context = createSalonApiContext({
    fetchImpl: async (path, options) => {
      recorded.push(options.headers.get('X-Salon-Id'))
      return jsonResponse({})
    },
  })

  context.setSalon(1)
  await context.request('/api/auth/me')

  context.setSalon(null)
  await context.request('/api/auth/me')

  assert.deepEqual(recorded, ['1', null])
})