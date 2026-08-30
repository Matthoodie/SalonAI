import test from 'node:test'
import assert from 'node:assert/strict'

import { mapDatabaseError } from '../src/errors/databaseErrorMapper.js'

test('maps appointment overlap database error', () => {
  const result = mapDatabaseError({
    constraint: 'appointments_employee_no_overlap',
  })

  assert.deepEqual(result, {
    status: 409,
    code: 'APPOINTMENT_CONFLICT',
    message:
      'Employee already has an appointment during this time.',
  })
})

test('maps employee qualification database error', () => {
  const result = mapDatabaseError({
    constraint:
      'appointments_employee_service_qualified_fkey',
  })

  assert.deepEqual(result, {
    status: 400,
    code: 'EMPLOYEE_NOT_QUALIFIED',
    message:
      'Employee is not qualified for the selected service.',
  })
})

test('maps client salon mismatch database error', () => {
  const result = mapDatabaseError({
    constraint: 'appointments_client_same_salon_fkey',
  })

  assert.deepEqual(result, {
    status: 400,
    code: 'CLIENT_SALON_MISMATCH',
    message:
      'Client does not belong to the selected salon.',
  })
})

test('maps employee salon mismatch database error', () => {
  const result = mapDatabaseError({
    constraint: 'appointments_employee_same_salon_fkey',
  })

  assert.deepEqual(result, {
    status: 400,
    code: 'EMPLOYEE_SALON_MISMATCH',
    message:
      'Employee does not belong to the selected salon.',
  })
})

test('maps service salon mismatch database error', () => {
  const result = mapDatabaseError({
    constraint: 'appointments_service_same_salon_fkey',
  })

  assert.deepEqual(result, {
    status: 400,
    code: 'SERVICE_SALON_MISMATCH',
    message:
      'Service does not belong to the selected salon.',
  })
})

test('maps appointment duration mismatch database error', () => {
  const result = mapDatabaseError({
    constraint:
      'appointments_duration_matches_time_range',
  })

  assert.deepEqual(result, {
    status: 500,
    code: 'APPOINTMENT_DURATION_MISMATCH',
    message:
      'Appointment duration does not match its time range.',
  })
})

test('returns null for unknown database constraint', () => {
  const result = mapDatabaseError({
    constraint: 'some_unknown_constraint',
  })

  assert.equal(result, null)
})