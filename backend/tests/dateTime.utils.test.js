import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isValidUtcDateTime,
} from '../src/utils/dateTime.js'

test(
  'isValidUtcDateTime accepts valid UTC ISO date-times',
  () => {
    assert.equal(
      isValidUtcDateTime(
        '2026-09-18T09:00:00.000Z'
      ),
      true
    )

    assert.equal(
      isValidUtcDateTime(
        '2026-09-18T09:00:00Z'
      ),
      true
    )

    assert.equal(
      isValidUtcDateTime(
        '2028-02-29T23:59:59.999Z'
      ),
      true
    )
  }
)

test(
  'isValidUtcDateTime rejects invalid calendar date-times',
  () => {
    assert.equal(
      isValidUtcDateTime(
        '2026-02-29T09:00:00Z'
      ),
      false
    )

    assert.equal(
      isValidUtcDateTime(
        '2026-04-31T09:00:00Z'
      ),
      false
    )

    assert.equal(
      isValidUtcDateTime(
        '2026-09-18T24:00:00Z'
      ),
      false
    )

    assert.equal(
      isValidUtcDateTime(
        '2026-09-18T09:60:00Z'
      ),
      false
    )
  }
)

test(
  'isValidUtcDateTime rejects ambiguous or invalid formats',
  () => {
    assert.equal(
      isValidUtcDateTime(
        '2026-09-18 09:00'
      ),
      false
    )

    assert.equal(
      isValidUtcDateTime(
        '2026-09-18T09:00:00'
      ),
      false
    )

    assert.equal(
      isValidUtcDateTime(
        '2026-09-18T09:00:00+02:00'
      ),
      false
    )

    assert.equal(
      isValidUtcDateTime(
        'banana'
      ),
      false
    )

    assert.equal(
      isValidUtcDateTime(
        null
      ),
      false
    )
  }
)