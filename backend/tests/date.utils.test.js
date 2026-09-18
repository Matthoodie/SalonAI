import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isValidDateKey,
} from '../src/utils/date.js'

test(
  'isValidDateKey accepts valid YYYY-MM-DD dates',
  () => {
    assert.equal(
      isValidDateKey(
        '2026-09-18'
      ),
      true
    )

    assert.equal(
      isValidDateKey(
        '2028-02-29'
      ),
      true
    )

    assert.equal(
      isValidDateKey(
        '2000-02-29'
      ),
      true
    )
  }
)

test(
  'isValidDateKey rejects invalid calendar dates',
  () => {
    assert.equal(
      isValidDateKey(
        '2026-02-29'
      ),
      false
    )

    assert.equal(
      isValidDateKey(
        '2026-04-31'
      ),
      false
    )

    assert.equal(
      isValidDateKey(
        '2026-13-01'
      ),
      false
    )

    assert.equal(
      isValidDateKey(
        '2026-00-10'
      ),
      false
    )
  }
)

test(
  'isValidDateKey rejects invalid formats',
  () => {
    assert.equal(
      isValidDateKey(
        '18-09-2026'
      ),
      false
    )

    assert.equal(
      isValidDateKey(
        '2026-9-18'
      ),
      false
    )

    assert.equal(
      isValidDateKey(
        '2026/09/18'
      ),
      false
    )

    assert.equal(
      isValidDateKey(
        ''
      ),
      false
    )

    assert.equal(
      isValidDateKey(
        null
      ),
      false
    )
  }
)