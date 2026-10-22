import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'

import pool from '../src/database/pool.js'

import {
  resolveCurrentSalon,
  getAvailableSalonContexts,
} from '../src/services/currentSalonService.js'

import {
  requireCurrentSalon,
} from '../src/middleware/currentSalonMiddleware.js'

import {
  getAvailableWorkspaces,
} from '../src/controllers/workspaceController.js'

const token = `${Date.now()}-${process.pid}`

const salonIds = []
const userIds = []

let multiUserId
let singleUserId
let emptyUserId
let employeeId

before(async () => {
  for (let index = 0; index < 5; index += 1) {
    const result = await pool.query(
      `
        INSERT INTO salons (name, timezone, active)
        VALUES ($1, 'Europe/Zagreb', $2)
        RETURNING id
      `,
      [
        `Workspace ${token}-${index}`,
        index !== 3,
      ]
    )

    salonIds.push(Number(result.rows[0].id))
  }

  for (let index = 0; index < 3; index += 1) {
    const result = await pool.query(
      `
        INSERT INTO users (
          auth_provider,
          auth_subject,
          email
        )
        VALUES ('test', $1, $2)
        RETURNING id
      `,
      [
        `workspace-${token}-${index}`,
        `workspace-${token}-${index}@example.test`,
      ]
    )

    userIds.push(Number(result.rows[0].id))
  }

  ;[multiUserId, singleUserId, emptyUserId] = userIds

  const employeeResult = await pool.query(
    `
      INSERT INTO employees (salon_id, name)
      VALUES ($1, 'Workspace Employee')
      RETURNING id
    `,
    [salonIds[1]]
  )

  employeeId = Number(employeeResult.rows[0].id)

  await pool.query(
    `
      INSERT INTO salon_memberships (
        user_id, salon_id, role, employee_id, active
      )
      VALUES
        ($1, $3, 'owner', NULL, true),
        ($1, $4, 'employee', $7, true),
        ($1, $5, 'admin', NULL, false),
        ($1, $6, 'admin', NULL, true),
        ($2, $3, 'admin', NULL, true)
    `,
    [
      multiUserId,
      singleUserId,
      salonIds[0],
      salonIds[1],
      salonIds[2],
      salonIds[3],
      employeeId,
    ]
  )
})

after(async () => {
  try {
    if (userIds.length > 0) {
      await pool.query(
        'DELETE FROM users WHERE id = ANY($1::bigint[])',
        [userIds]
      )
    }

    if (salonIds.length > 0) {
      await pool.query(
        'DELETE FROM salons WHERE id = ANY($1::bigint[])',
        [salonIds]
      )
    }
  } finally {
    await pool.end()
  }
})

test('workspace: one available membership is selected automatically', async () => {
  const context = await resolveCurrentSalon(singleUserId)

  assert.equal(Number(context.salon.id), salonIds[0])
  assert.equal(context.membership.role, 'admin')
})

test('workspace: multiple available memberships require selection', async () => {
  await assert.rejects(
    () => resolveCurrentSalon(multiUserId),
    {
      code: 'CURRENT_SALON_SELECTION_REQUIRED',
      statusCode: 409,
    }
  )
})

test('workspace: selected salon supplies its own role and employee identity', async () => {
  const ownerContext = await resolveCurrentSalon(
    multiUserId,
    String(salonIds[0])
  )

  const employeeContext = await resolveCurrentSalon(
    multiUserId,
    String(salonIds[1])
  )

  assert.equal(ownerContext.membership.role, 'owner')
  assert.equal(ownerContext.membership.employeeId, null)
  assert.equal(Number(ownerContext.salon.id), salonIds[0])

  assert.equal(employeeContext.membership.role, 'employee')
  assert.equal(employeeContext.membership.employeeId, employeeId)
  assert.equal(Number(employeeContext.salon.id), salonIds[1])
})

test('workspace: inactive memberships, inactive salons and foreign salons are rejected', async () => {
  for (const selectedId of salonIds.slice(2)) {
    await assert.rejects(
      () => resolveCurrentSalon(multiUserId, String(selectedId)),
      {
        code: 'SALON_ACCESS_DENIED',
        statusCode: 403,
      }
    )
  }
})

test('workspace: invalid selection never falls back to the only available salon', async () => {
  const invalidIds = [
    '',
    ' ',
    '0',
    '-1',
    '1.5',
    '1e2',
    '0x10',
    '1,2',
    'abc',
    null,
    true,
    [],
    ['1'],
    '9007199254740992',
  ]

  for (const selectedId of invalidIds) {
    await assert.rejects(
      () => resolveCurrentSalon(singleUserId, selectedId),
      {
        code: 'INVALID_SELECTED_SALON_ID',
        statusCode: 400,
      }
    )
  }

  await assert.rejects(
    () => resolveCurrentSalon(singleUserId, String(salonIds[1])),
    {
      code: 'SALON_ACCESS_DENIED',
      statusCode: 403,
    }
  )
})

test('workspace: list contains only this user active available memberships', async () => {
  const contexts = await getAvailableSalonContexts(multiUserId)

  assert.deepEqual(
    contexts.map((context) => Number(context.salon.id)),
    salonIds.slice(0, 2)
  )

  assert.deepEqual(
    await getAvailableSalonContexts(emptyUserId),
    []
  )

  await assert.rejects(
    () => resolveCurrentSalon(emptyUserId),
    {
      code: 'NO_SALON_MEMBERSHIP',
      statusCode: 403,
    }
  )
})

test('workspace: middleware uses header and ignores query and body salon selection', async () => {
  const req = {
    currentUser: { id: multiUserId },
    headers: { 'x-salon-id': String(salonIds[1]) },
    query: { salonId: salonIds[0] },
    body: { salon_id: salonIds[0] },
  }

  let called = false
  let forwardedError

  await requireCurrentSalon(req, {}, (error) => {
    called = true
    forwardedError = error
  })

  assert.equal(called, true)
  assert.ifError(forwardedError)
  assert.equal(Number(req.currentSalon.id), salonIds[1])
  assert.equal(req.currentMembership.role, 'employee')

  const noHeaderReq = {
    currentUser: { id: multiUserId },
    query: { salonId: salonIds[0] },
    body: { salon_id: salonIds[0] },
  }

  await requireCurrentSalon(noHeaderReq, {}, (error) => {
    forwardedError = error
  })

  assert.equal(
    forwardedError?.code,
    'CURRENT_SALON_SELECTION_REQUIRED'
  )

  assert.equal(noHeaderReq.currentSalon, undefined)
})

test('workspace: revoked membership is rejected on the next resolution', async () => {
  await pool.query(
    `
      UPDATE salon_memberships
      SET active = false
      WHERE user_id = $1 AND salon_id = $2
    `,
    [multiUserId, salonIds[1]]
  )

  try {
    await assert.rejects(
      () => resolveCurrentSalon(multiUserId, String(salonIds[1])),
      {
        code: 'SALON_ACCESS_DENIED',
        statusCode: 403,
      }
    )

    const contexts = await getAvailableSalonContexts(multiUserId)

    assert.deepEqual(
      contexts.map((context) => Number(context.salon.id)),
      [salonIds[0]]
    )
  } finally {
    await pool.query(
      `
        UPDATE salon_memberships
        SET active = true
        WHERE user_id = $1 AND salon_id = $2
      `,
      [multiUserId, salonIds[1]]
    )
  }
})

test('workspace: list controller returns user and choices without requiring current salon', async () => {
  const req = {
    currentUser: {
      id: multiUserId,
      email: 'workspace@example.test',
      display_name: null,
      active: true,
    },
  }

  const headers = {}
  let statusCode
  let body
  let forwardedError

  const res = {
    set(name, value) {
      headers[name] = value
      return this
    },

    status(code) {
      statusCode = code
      return this
    },

    json(value) {
      body = value
      return this
    },
  }

  await getAvailableWorkspaces(req, res, (error) => {
    forwardedError = error
  })

  assert.ifError(forwardedError)
  assert.equal(statusCode, 200)
  assert.equal(headers['Cache-Control'], 'no-store')
  assert.equal(body.data.authenticated, true)
  assert.equal(body.data.user.id, multiUserId)
  assert.equal(body.data.workspaces.length, 2)

  assert.deepEqual(
    body.data.workspaces.map((workspace) => workspace.membership.role),
    ['owner', 'employee']
  )
})