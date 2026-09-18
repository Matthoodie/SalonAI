import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isValidTime,
  timeToMinutes,
  minutesToTime,
} from '../src/utils/time.js'

test(
  'time utils validate strict HH:MM format',
  () => {
    assert.equal(
      isValidTime('09:00'),
      true
    )

    assert.equal(
      isValidTime('23:59'),
      true
    )

    assert.equal(
      isValidTime('00:00'),
      true
    )

    assert.equal(
      isValidTime('9:00'),
      false
    )

    assert.equal(
      isValidTime('09:0'),
      false
    )

    assert.equal(
      isValidTime('24:00'),
      false
    )

    assert.equal(
      isValidTime('09:00:00'),
      false
    )

    assert.equal(
      isValidTime('12:60'),
      false
    )

    assert.equal(
      isValidTime(null),
      false
    )
  }
)

test(
  'timeToMinutes converts valid time',
  () => {
    assert.equal(
      timeToMinutes('00:00'),
      0
    )

    assert.equal(
      timeToMinutes('09:30'),
      570
    )

    assert.equal(
      timeToMinutes('23:59'),
      1439
    )

    assert.equal(
      isValidTime('09:00:00'),
      false
    )

    assert.equal(
      timeToMinutes('9:30'),
      null
    )
  }
)

test(
  'minutesToTime converts valid minutes',
  () => {
    assert.equal(
      minutesToTime(0),
      '00:00'
    )

    assert.equal(
      minutesToTime(570),
      '09:30'
    )

    assert.equal(
      minutesToTime(1439),
      '23:59'
    )

    assert.equal(
      minutesToTime(-1),
      null
    )

    assert.equal(
      minutesToTime(1440),
      null
    )
  }
)