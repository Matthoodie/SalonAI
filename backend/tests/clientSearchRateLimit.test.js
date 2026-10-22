import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createClientSearchRateLimit,
} from '../src/middleware/clientSearchRateLimit.js'

function request({
  userId = 1,
  salonId = 1,
  query = {},
} = {}) {
  return {
    currentUser: { id: userId },
    currentSalon: { id: salonId },
    query,
  }
}

function invoke(middleware, req = request()) {
  const result = {
    nextCalled: false,
    error: null,
    status: null,
    headers: {},
    body: null,
  }

  const res = {
    set(name, value) {
      result.headers[name.toLowerCase()] = value
      return this
    },

    status(code) {
      result.status = code
      return this
    },

    json(body) {
      result.body = body
      return this
    },
  }

  middleware(req, res, (error) => {
    result.nextCalled = true
    result.error = error ?? null
  })

  return result
}

test('client search limit: blocks excess requests and resets after window', () => {
  let time = 0

  const middleware = createClientSearchRateLimit({
    limit: 2,
    windowMs: 60_000,
    now: () => time,
  })

  assert.equal(invoke(middleware).nextCalled, true)
  assert.equal(invoke(middleware).nextCalled, true)

  time = 1500

  const blocked = invoke(middleware)

  assert.equal(blocked.nextCalled, false)
  assert.equal(blocked.status, 429)
  assert.equal(blocked.headers['retry-after'], '59')
  assert.equal(blocked.headers['cache-control'], 'no-store')

  assert.equal(
    blocked.body.error.code,
    'CLIENT_SEARCH_RATE_LIMITED'
  )

  time = 60_000

  const allowed = invoke(middleware)

  assert.equal(allowed.nextCalled, true)
  assert.equal(allowed.error, null)
})

test('client search limit: isolates users and salons', () => {
  const middleware = createClientSearchRateLimit({
    limit: 1,
  })

  assert.equal(invoke(middleware).nextCalled, true)
  assert.equal(invoke(middleware).status, 429)

  assert.equal(
    invoke(middleware, request({ userId: 2 })).nextCalled,
    true
  )

  assert.equal(
    invoke(middleware, request({ salonId: 2 })).nextCalled,
    true
  )
})

test('client search limit: query parameters cannot change identity', () => {
  const middleware = createClientSearchRateLimit({
    limit: 1,
  })

  invoke(middleware)

  const result = invoke(
    middleware,
    request({
      query: {
        userId: 999,
        salonId: 999,
        q: 'Drugi upit',
      },
    })
  )

  assert.equal(result.status, 429)
})

test('client search limit: string and numeric identities share quota', () => {
  const middleware = createClientSearchRateLimit({
    limit: 1,
  })

  invoke(middleware)

  assert.equal(
    invoke(
      middleware,
      request({
        userId: '1',
        salonId: '1',
      })
    ).status,
    429
  )
})

test('client search limit: missing or invalid context fails closed', () => {
  const middleware = createClientSearchRateLimit()

  const invalidRequests = [
    {},
    { currentUser: { id: 1 } },
    { currentSalon: { id: 1 } },
  ]

  const invalidIds = [
    null,
    undefined,
    '',
    0,
    -1,
    1.5,
    true,
    [],
    'abc',
  ]

  for (const id of invalidIds) {
    const invalidUserRequest = request()
    invalidUserRequest.currentUser.id = id

    const invalidSalonRequest = request()
    invalidSalonRequest.currentSalon.id = id

    invalidRequests.push(
      invalidUserRequest,
      invalidSalonRequest
    )
  }

  for (const [index, req] of invalidRequests.entries()) {
    const result = invoke(middleware, req)

    assert.equal(
      result.nextCalled,
      true,
      `Case ${index}: middleware must forward the error.`
    )

    assert.equal(
      result.error?.code,
      'CLIENT_SEARCH_CONTEXT_REQUIRED',
      `Case ${index}: invalid identity must be rejected.`
    )

    assert.equal(result.error?.statusCode, 500)
    assert.equal(result.body, null)
  }
})

test('client search limit: capacity does not bypass quotas and expired entries recover', () => {
  let time = 0

  const middleware = createClientSearchRateLimit({
    limit: 1,
    maxEntries: 1,
    windowMs: 1000,
    now: () => time,
  })

  assert.equal(invoke(middleware).nextCalled, true)

  assert.equal(
    invoke(middleware, request({ userId: 2 })).status,
    429
  )

  assert.equal(invoke(middleware).status, 429)

  time = 1000

  assert.equal(
    invoke(middleware, request({ userId: 2 })).nextCalled,
    true
  )
})