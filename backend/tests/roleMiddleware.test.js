import test from 'node:test'
import assert from 'node:assert/strict'

import {
  requireSalonRole,
} from '../src/middleware/roleMiddleware.js'

function runMiddleware({
  role,
  allowedRoles,
  includeMembership = true,
}) {
  const req = {}

  if (includeMembership) {
    req.currentMembership = {
      id: 1,
      role,
      active: true,
    }
  }

  let nextError = null
  let nextCalled = false

  const middleware =
    requireSalonRole(...allowedRoles)

  middleware(
    req,
    {},
    (error) => {
      nextCalled = true
      nextError = error ?? null
    }
  )

  return {
    nextCalled,
    nextError,
  }
}

test(
  'owner is allowed through owner/admin guard',
  () => {
    const result =
      runMiddleware({
        role: 'owner',
        allowedRoles: [
          'owner',
          'admin',
        ],
      })

    assert.equal(
      result.nextCalled,
      true
    )

    assert.equal(
      result.nextError,
      null
    )
  }
)

test(
  'admin is allowed through owner/admin guard',
  () => {
    const result =
      runMiddleware({
        role: 'admin',
        allowedRoles: [
          'owner',
          'admin',
        ],
      })

    assert.equal(
      result.nextCalled,
      true
    )

    assert.equal(
      result.nextError,
      null
    )
  }
)

test(
  'employee is rejected by owner/admin guard',
  () => {
    const result =
      runMiddleware({
        role: 'employee',
        allowedRoles: [
          'owner',
          'admin',
        ],
      })

    assert.equal(
      result.nextCalled,
      true
    )

    assert.equal(
      result.nextError?.statusCode,
      403
    )

    assert.equal(
      result.nextError?.code,
      'INSUFFICIENT_SALON_ROLE'
    )
  }
)

test(
  'missing membership context is rejected',
  () => {
    const result =
      runMiddleware({
        role: null,
        allowedRoles: [
          'owner',
          'admin',
        ],
        includeMembership: false,
      })

    assert.equal(
      result.nextError?.statusCode,
      500
    )

    assert.equal(
      result.nextError?.code,
      'SALON_MEMBERSHIP_CONTEXT_REQUIRED'
    )
  }
)

test(
  'invalid current membership role is rejected',
  () => {
    const result =
      runMiddleware({
        role: 'superuser',
        allowedRoles: [
          'owner',
          'admin',
        ],
      })

    assert.equal(
      result.nextError?.statusCode,
      403
    )

    assert.equal(
      result.nextError?.code,
      'INVALID_SALON_ROLE'
    )
  }
)

test(
  'invalid configured role throws immediately',
  () => {
    assert.throws(
      () => {
        requireSalonRole(
          'owner',
          'superuser'
        )
      },
      /Invalid SalonAI role configured/
    )
  }
)
