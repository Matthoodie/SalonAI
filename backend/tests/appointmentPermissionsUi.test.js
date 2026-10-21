import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canUseAppointmentPermission,
  canEditAppointment,
} from '../../frontend/src/api/appointmentPermissions.js'

function makeContext({
  role = 'employee',
  employeeId = 34,
  permissions = {},
  active = true,
} = {}) {
  return {
    authenticated: true,
    membership: {
      role,
      employee_id: employeeId,
      active,
    },
    permissions,
  }
}

test('UI permissions: missing or inactive context denies access', () => {
  const key = 'appointment.create'

  assert.equal(
    canUseAppointmentPermission(null, key, 34),
    false
  )

  assert.equal(
    canUseAppointmentPermission(makeContext(), key, 34),
    false
  )

  const inactive = makeContext({
    active: false,
    permissions: { [key]: 'self' },
  })

  assert.equal(
    canUseAppointmentPermission(inactive, key, 34),
    false
  )

  const signedOut = {
    ...makeContext({ permissions: { [key]: 'self' } }),
    authenticated: false,
  }

  assert.equal(
    canUseAppointmentPermission(signedOut, key, 34),
    false
  )
})

test('UI permissions: self allows own employee and rejects coworker', () => {
  const key = 'appointment.create'
  const context = makeContext({
    permissions: { [key]: 'self' },
  })

  assert.equal(
    canUseAppointmentPermission(context, key, 34),
    true
  )

  assert.equal(
    canUseAppointmentPermission(context, key, '34'),
    true
  )

  assert.equal(
    canUseAppointmentPermission(context, key, 35),
    false
  )
})

test('UI permissions: self requires valid own and target identities', () => {
  const key = 'appointment.reschedule'

  for (const invalidId of [null, undefined, '', 0, -1, 'abc', 1.5]) {
    const invalidMembership = makeContext({
      permissions: { [key]: 'self' },
    })

    invalidMembership.membership.employee_id = invalidId

    assert.equal(
      canUseAppointmentPermission(invalidMembership, key, 34),
      false
    )

    const validMembership = makeContext({
      permissions: { [key]: 'self' },
    })

    assert.equal(
      canUseAppointmentPermission(validMembership, key, invalidId),
      false
    )
  }
})

test('UI permissions: deny and unsupported values never grant access', () => {
  const key = 'appointment.change_status'

  for (const value of ['deny', 'approval', 'direct', 'unknown', null]) {
    const context = makeContext({
      permissions: { [key]: value },
    })

    assert.equal(
      canUseAppointmentPermission(context, key, 34),
      false
    )
  }
})

test('UI permissions: all is allowed for owner and admin only', () => {
  const key = 'appointment.change_client'

  for (const role of ['owner', 'admin']) {
    const context = makeContext({
      role,
      employeeId: null,
      permissions: { [key]: 'all' },
    })

    assert.equal(
      canUseAppointmentPermission(context, key, 35),
      true
    )
  }

  for (const role of ['employee', 'superadmin']) {
    const context = makeContext({
      role,
      permissions: { [key]: 'all' },
    })

    assert.equal(
      canUseAppointmentPermission(context, key, 34),
      false
    )
  }
})

test('UI permissions: reschedule-only grant does not grant other actions', () => {
  const context = makeContext({
    permissions: {
      'appointment.create': 'deny',
      'appointment.reschedule': 'self',
      'appointment.change_client': 'deny',
      'appointment.change_status': 'deny',
    },
  })

  assert.equal(
    canEditAppointment(context, { employeeId: 34 }),
    true
  )

  assert.equal(
    canEditAppointment(context, { employeeId: 35 }),
    false
  )

  for (const key of [
    'appointment.create',
    'appointment.change_client',
    'appointment.change_status',
  ]) {
    assert.equal(
      canUseAppointmentPermission(context, key, 34),
      false
    )
  }
})

test('UI permissions: client-only grant does not allow rescheduling', () => {
  const context = makeContext({
    permissions: {
      'appointment.change_client': 'self',
      'appointment.reschedule': 'deny',
    },
  })

  assert.equal(
    canEditAppointment(context, { employeeId: 34 }),
    true
  )

  assert.equal(
    canUseAppointmentPermission(
      context,
      'appointment.reschedule',
      34
    ),
    false
  )
})

test('UI permissions: status-only grant does not enable edit form', () => {
  const context = makeContext({
    permissions: {
      'appointment.change_status': 'self',
      'appointment.reschedule': 'deny',
      'appointment.change_client': 'deny',
    },
  })

  assert.equal(
    canUseAppointmentPermission(
      context,
      'appointment.change_status',
      34
    ),
    true
  )

  assert.equal(
    canEditAppointment(context, { employeeId: 34 }),
    false
  )

  assert.equal(canEditAppointment(context, null), false)
})