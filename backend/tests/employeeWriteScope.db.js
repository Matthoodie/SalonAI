import test, {
  before,
  after,
} from 'node:test'

import assert from 'node:assert/strict'

import {
  createFixedTenantTestApp,
} from './helpers/fixedTenantTestApp.js'

import pool from '../src/database/pool.js'

import {
  SALON_PERMISSION_KEYS,
} from '../src/permissions/salonPermissions.js'

let employeeServer = null
let adminServer = null

let employeeBaseUrl = null
let adminBaseUrl = null

let salonId
let employeeAId
let employeeBId
let clientAId
let clientBId
let serviceId

let statusOwnId
let statusCoworkerId

let scheduleOwnId
let scheduleCoworkerId

let clientOwnId
let clientCoworkerId

const token =
  `${Date.now()}-${process.pid}`

before(async () => {
  const salonResult =
    await pool.query(
      `
        INSERT INTO salons (
          name,
          timezone
        )
        VALUES (
          $1,
          'Europe/Zagreb'
        )
        RETURNING id
      `,
      [
        `Employee Write Scope ${token}`,
      ]
    )

  salonId =
    Number(
      salonResult.rows[0].id
    )

  const clientsResult =
    await pool.query(
      `
        INSERT INTO clients (
          salon_id,
          name,
          phone_country_code,
          phone_number,
          phone_normalized
        )
        VALUES
          (
            $1,
            'Write Scope Client A',
            '+385',
            $2,
            $3
          ),
          (
            $1,
            'Write Scope Client B',
            '+385',
            $4,
            $5
          )
        RETURNING
          id,
          name
      `,
      [
        salonId,
        `91${Date.now()}`,
        `+38591${Date.now()}`,
        `92${Date.now()}`,
        `+38592${Date.now()}`,
      ]
    )

  clientAId =
    Number(
      clientsResult.rows.find(
        (row) =>
          row.name ===
          'Write Scope Client A'
      ).id
    )

  clientBId =
    Number(
      clientsResult.rows.find(
        (row) =>
          row.name ===
          'Write Scope Client B'
      ).id
    )

  const serviceResult =
    await pool.query(
      `
        INSERT INTO services (
          salon_id,
          name,
          category,
          price_cents,
          default_duration_minutes
        )
        VALUES (
          $1,
          'Write Scope Service',
          'Security Test',
          3000,
          30
        )
        RETURNING id
      `,
      [salonId]
    )

  serviceId =
    Number(
      serviceResult.rows[0].id
    )

  const employeesResult =
    await pool.query(
      `
        INSERT INTO employees (
          salon_id,
          name
        )
        VALUES
          (
            $1,
            'Write Scope Employee A'
          ),
          (
            $1,
            'Write Scope Employee B'
          )
        RETURNING
          id,
          name
      `,
      [salonId]
    )

  employeeAId =
    Number(
      employeesResult.rows.find(
        (row) =>
          row.name ===
          'Write Scope Employee A'
      ).id
    )

  employeeBId =
    Number(
      employeesResult.rows.find(
        (row) =>
          row.name ===
          'Write Scope Employee B'
      ).id
    )

  await pool.query(
    `
      INSERT INTO employee_services (
        employee_id,
        service_id,
        salon_id
      )
      VALUES
        ($1, $3, $4),
        ($2, $3, $4)
    `,
    [
      employeeAId,
      employeeBId,
      serviceId,
      salonId,
    ]
  )

  await pool.query(
    `
      INSERT INTO employee_date_overrides (
        employee_id,
        date,
        enabled,
        start_time,
        end_time
      )
      VALUES
        (
          $1,
          '2032-02-10',
          true,
          '08:00',
          '20:00'
        ),
        (
          $2,
          '2032-02-10',
          true,
          '08:00',
          '20:00'
        )
    `,
    [
      employeeAId,
      employeeBId,
    ]
  )

  const appointmentsResult =
    await pool.query(
      `
        INSERT INTO appointments (
          salon_id,
          client_id,
          employee_id,
          service_id,
          starts_at,
          ends_at,
          price_cents,
          duration_minutes,
          status,
          source,
          notes
        )
        VALUES
          (
            $1,
            $2,
            $3,
            $5,
            '2032-02-10T08:00:00Z',
            '2032-02-10T08:30:00Z',
            3000,
            30,
            'confirmed',
            'manual',
            'STATUS OWN'
          ),
          (
            $1,
            $2,
            $4,
            $5,
            '2032-02-10T09:00:00Z',
            '2032-02-10T09:30:00Z',
            3000,
            30,
            'confirmed',
            'manual',
            'STATUS COWORKER'
          ),
          (
            $1,
            $2,
            $3,
            $5,
            '2032-02-10T10:00:00Z',
            '2032-02-10T10:30:00Z',
            3000,
            30,
            'confirmed',
            'manual',
            'SCHEDULE OWN'
          ),
          (
            $1,
            $2,
            $4,
            $5,
            '2032-02-10T11:00:00Z',
            '2032-02-10T11:30:00Z',
            3000,
            30,
            'confirmed',
            'manual',
            'SCHEDULE COWORKER'
          ),
          (
            $1,
            $2,
            $3,
            $5,
            '2032-02-10T13:00:00Z',
            '2032-02-10T13:30:00Z',
            3000,
            30,
            'confirmed',
            'manual',
            'CLIENT OWN'
          ),
          (
            $1,
            $2,
            $4,
            $5,
            '2032-02-10T14:00:00Z',
            '2032-02-10T14:30:00Z',
            3000,
            30,
            'confirmed',
            'manual',
            'CLIENT COWORKER'
          )
        RETURNING
          id,
          notes
      `,
      [
        salonId,
        clientAId,
        employeeAId,
        employeeBId,
        serviceId,
      ]
    )

  function idFor(notes) {
    return Number(
      appointmentsResult.rows.find(
        (row) =>
          row.notes === notes
      ).id
    )
  }

  statusOwnId =
    idFor('STATUS OWN')

  statusCoworkerId =
    idFor('STATUS COWORKER')

  scheduleOwnId =
    idFor('SCHEDULE OWN')

  scheduleCoworkerId =
    idFor('SCHEDULE COWORKER')

  clientOwnId =
    idFor('CLIENT OWN')

  clientCoworkerId =
    idFor('CLIENT COWORKER')

  // This fixture explicitly grants own-appointment editing.
  // Production employee defaults deny these three actions.
  await pool.query(
    `
      INSERT INTO salon_permission_overrides (
        salon_id, role, permission_key, permission_value
      )
      VALUES
        ($1, 'employee', $2, 'self'),
        ($1, 'employee', $3, 'self'),
        ($1, 'employee', $4, 'self')
    `,
    [
      salonId,
      SALON_PERMISSION_KEYS.APPOINTMENT_RESCHEDULE,
      SALON_PERMISSION_KEYS.APPOINTMENT_CHANGE_STATUS,
      SALON_PERMISSION_KEYS.APPOINTMENT_CHANGE_CLIENT,
    ]
  )

  const employeeApp =
    createFixedTenantTestApp(
      salonId,
      {
        role: 'employee',
        employeeId: employeeAId,
      }
    )

  employeeServer =
    employeeApp.listen(0)

  await new Promise((resolve) => {
    employeeServer.once(
      'listening',
      resolve
    )
  })

  employeeBaseUrl =
    `http://127.0.0.1:${
      employeeServer.address().port
    }`

  const adminApp =
    createFixedTenantTestApp(
      salonId,
      {
        role: 'admin',
      }
    )

  adminServer =
    adminApp.listen(0)

  await new Promise((resolve) => {
    adminServer.once(
      'listening',
      resolve
    )
  })

  adminBaseUrl =
    `http://127.0.0.1:${
      adminServer.address().port
    }`
})

after(async () => {
  for (
    const server
    of [
      employeeServer,
      adminServer,
    ]
  ) {
    if (!server) {
      continue
    }

    await new Promise(
      (resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }

          resolve()
        })
      }
    )
  }

  if (salonId) {
    await pool.query(
      `
        DELETE FROM salons
        WHERE id = $1
      `,
      [salonId]
    )
  }

  await pool.end()
})

test(
  'employee can change status of own appointment',
  async () => {
    const response =
      await fetch(
        `${employeeBaseUrl}/api/appointments/${statusOwnId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            status: 'completed',
          }),
        }
      )

    assert.equal(
      response.status,
      200
    )

    const body =
      await response.json()

    assert.equal(
      body.data.status,
      'completed'
    )
  }
)

test(
  'employee cannot change status of coworker appointment',
  async () => {
    const response =
      await fetch(
        `${employeeBaseUrl}/api/appointments/${statusCoworkerId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            status: 'completed',
          }),
        }
      )

    const body =
      await response.json()

    assert.equal(
      response.status,
      404
    )

    assert.equal(
      body.error?.code,
      'APPOINTMENT_NOT_FOUND'
    )
  }
)

test(
  'employee can reschedule own appointment',
  async () => {
    const response =
      await fetch(
        `${employeeBaseUrl}/api/appointments/${scheduleOwnId}/schedule`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            starts_at:
              '2032-02-10T12:00:00Z',
          }),
        }
      )

    const body =
      await response.json()

    assert.equal(
      response.status,
      200
    )

    assert.equal(
      Number(
        body.data.employee_id
      ),
      employeeAId
    )
  }
)

test(
  'employee cannot reschedule coworker appointment',
  async () => {
    const response =
      await fetch(
        `${employeeBaseUrl}/api/appointments/${scheduleCoworkerId}/schedule`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            starts_at:
              '2032-02-10T16:00:00Z',
          }),
        }
      )

    const body =
      await response.json()

    assert.equal(
      response.status,
      404
    )

    assert.equal(
      body.error?.code,
      'APPOINTMENT_NOT_FOUND'
    )
  }
)

test(
  'employee can change client on own appointment',
  async () => {
    const response =
      await fetch(
        `${employeeBaseUrl}/api/appointments/${clientOwnId}/client`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            client_id: clientBId,
          }),
        }
      )

    const body =
      await response.json()

    assert.equal(
      response.status,
      200
    )

    assert.equal(
      Number(
        body.data.client_id
      ),
      clientBId
    )
  }
)

test(
  'employee cannot change client on coworker appointment',
  async () => {
    const response =
      await fetch(
        `${employeeBaseUrl}/api/appointments/${clientCoworkerId}/client`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            client_id: clientBId,
          }),
        }
      )

    const body =
      await response.json()

    assert.equal(
      response.status,
      404
    )

    assert.equal(
      body.error?.code,
      'APPOINTMENT_NOT_FOUND'
    )
  }
)

test(
  'deny override blocks employee status change with 403',
  async () => {
    await pool.query(
      `
        INSERT INTO salon_permission_overrides (
          salon_id,
          role,
          permission_key,
          permission_value
        )
        VALUES (
          $1,
          'employee',
          $2,
          'deny'
        )
        ON CONFLICT (salon_id, role, permission_key)
        DO UPDATE SET permission_value = EXCLUDED.permission_value
      `,
      [
        salonId,
        SALON_PERMISSION_KEYS
          .APPOINTMENT_CHANGE_STATUS,
      ]
    )

    const response =
      await fetch(
        `${employeeBaseUrl}/api/appointments/${statusCoworkerId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            status: 'completed',
          }),
        }
      )

    const body =
      await response.json()

    assert.equal(
      response.status,
      403
    )

    assert.equal(
      body.error?.code,
      'SALON_PERMISSION_DENIED'
    )
  }
)

test(
  'admin can change coworker appointment because admin scope is all',
  async () => {
    const response =
      await fetch(
        `${adminBaseUrl}/api/appointments/${statusCoworkerId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            status: 'completed',
          }),
        }
      )

    assert.equal(
      response.status,
      200
    )
  }
)

async function requestAppointmentCreation(
  baseUrl,
  employeeId,
  startsAt,
  notes
) {
  const response = await fetch(
    `${baseUrl}/api/appointments`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientAId,
        employee_id: employeeId,
        service_id: serviceId,
        starts_at: startsAt,
        notes,
      }),
    }
  )

  const body = await response.json()

  return { response, body }
}

async function findCreatedAppointments(notes) {
  const result = await pool.query(
    `
      SELECT employee_id, client_id, service_id
      FROM appointments
      WHERE salon_id = $1
        AND notes = $2
    `,
    [salonId, notes]
  )

  return result.rows
}

test('create permission: employee can create own appointment', async () => {
  const notes = 'CREATE PERMISSION OWN'

  const { response, body } = await requestAppointmentCreation(
    employeeBaseUrl,
    employeeAId,
    '2032-02-10T15:00:00Z',
    notes
  )

  assert.equal(response.status, 201, JSON.stringify(body))

  const rows = await findCreatedAppointments(notes)

  assert.equal(rows.length, 1)
  assert.equal(Number(rows[0].employee_id), employeeAId)
  assert.equal(Number(rows[0].client_id), clientAId)
  assert.equal(Number(rows[0].service_id), serviceId)
})

test('create permission: employee cannot create coworker appointment', async () => {
  const notes = 'CREATE PERMISSION COWORKER'

  const { response, body } = await requestAppointmentCreation(
    employeeBaseUrl,
    employeeBId,
    '2032-02-10T16:00:00Z',
    notes
  )

  assert.equal(response.status, 403, JSON.stringify(body))
  assert.equal(
    body.error?.code,
    'EMPLOYEE_APPOINTMENT_SCOPE_VIOLATION'
  )

  const rows = await findCreatedAppointments(notes)
  assert.equal(rows.length, 0)
})

test('create permission: deny override blocks own creation', async () => {
  const notes = 'CREATE PERMISSION DENIED'

  await pool.query(
    `
      INSERT INTO salon_permission_overrides (
        salon_id,
        role,
        permission_key,
        permission_value
      )
      VALUES ($1, 'employee', $2, 'deny')
    `,
    [salonId, SALON_PERMISSION_KEYS.APPOINTMENT_CREATE]
  )

  try {
    const { response, body } = await requestAppointmentCreation(
      employeeBaseUrl,
      employeeAId,
      '2032-02-10T17:00:00Z',
      notes
    )

    assert.equal(response.status, 403, JSON.stringify(body))
    assert.equal(body.error?.code, 'SALON_PERMISSION_DENIED')

    const rows = await findCreatedAppointments(notes)
    assert.equal(rows.length, 0)
  } finally {
    await pool.query(
      `
        DELETE FROM salon_permission_overrides
        WHERE salon_id = $1
          AND role = 'employee'
          AND permission_key = $2
      `,
      [salonId, SALON_PERMISSION_KEYS.APPOINTMENT_CREATE]
    )
  }
})

test('create permission: admin can create for selected employee', async () => {
  const notes = 'CREATE PERMISSION ADMIN'

  const { response, body } = await requestAppointmentCreation(
    adminBaseUrl,
    employeeBId,
    '2032-02-10T18:00:00Z',
    notes
  )

  assert.equal(response.status, 201, JSON.stringify(body))

  const rows = await findCreatedAppointments(notes)

  assert.equal(rows.length, 1)
  assert.equal(Number(rows[0].employee_id), employeeBId)
  assert.equal(Number(rows[0].client_id), clientAId)
  assert.equal(Number(rows[0].service_id), serviceId)
})

const defaultDeniedActions = [
  {
    name: 'status',
    permissionKey:
      SALON_PERMISSION_KEYS.APPOINTMENT_CHANGE_STATUS,
    appointmentId: () => statusOwnId,
    path: 'status',
    payload: () => ({ status: 'cancelled' }),
  },
  {
    name: 'reschedule',
    permissionKey:
      SALON_PERMISSION_KEYS.APPOINTMENT_RESCHEDULE,
    appointmentId: () => scheduleOwnId,
    path: 'schedule',
    payload: () => ({
      starts_at: '2032-02-10T16:00:00Z',
    }),
  },
  {
    name: 'client change',
    permissionKey:
      SALON_PERMISSION_KEYS.APPOINTMENT_CHANGE_CLIENT,
    appointmentId: () => clientOwnId,
    path: 'client',
    payload: () => ({ client_id: clientAId }),
  },
]

for (const action of defaultDeniedActions) {
  test(
    `default employee deny: ${action.name} leaves own appointment unchanged`,
    async () => {
      const savedOverride = await pool.query(
        `
          DELETE FROM salon_permission_overrides
          WHERE salon_id = $1
            AND role = 'employee'
            AND permission_key = $2
          RETURNING permission_value
        `,
        [salonId, action.permissionKey]
      )

      const appointmentId = action.appointmentId()

      async function readAppointment() {
        const result = await pool.query(
          `
            SELECT *
            FROM appointments
            WHERE salon_id = $1
              AND id = $2
          `,
          [salonId, appointmentId]
        )

        assert.equal(result.rows.length, 1)
        return result.rows[0]
      }

      try {
        const before = await readAppointment()

        const response = await fetch(
          `${employeeBaseUrl}/api/appointments/${appointmentId}/${action.path}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(action.payload()),
          }
        )

        const body = await response.json()

        assert.equal(
          response.status,
          403,
          JSON.stringify(body)
        )

        assert.equal(
          body.error?.code,
          'SALON_PERMISSION_DENIED'
        )

        const after = await readAppointment()
        assert.deepEqual(after, before)
      } finally {
        if (savedOverride.rows.length > 0) {
          await pool.query(
            `
              INSERT INTO salon_permission_overrides (
                salon_id,
                role,
                permission_key,
                permission_value
              )
              VALUES ($1, 'employee', $2, $3)
            `,
            [
              salonId,
              action.permissionKey,
              savedOverride.rows[0].permission_value,
            ]
          )
        }
      }
    }
  )
}

test('employee profile scope: employee receives only own profile', async () => {
  const response = await fetch(
    `${employeeBaseUrl}/api/employees`
  )

  const body = await response.json()

  assert.equal(response.status, 200, JSON.stringify(body))
  assert.ok(Array.isArray(body.data))

  assert.deepEqual(
    body.data.map((employee) => Number(employee.id)),
    [employeeAId]
  )

  const ownProfile = body.data[0]

  assert.equal(Number(ownProfile.salon_id), salonId)
  assert.ok(
    ownProfile.service_ids.some(
      (id) => Number(id) === serviceId
    )
  )

  assert.equal(ownProfile.date_overrides.length, 1)
  assert.equal(
    ownProfile.date_overrides[0].date,
    '2032-02-10'
  )
})

test('employee profile scope: query cannot select coworker', async () => {
  const response = await fetch(
    `${employeeBaseUrl}/api/employees?employeeId=${employeeBId}&employee_id=${employeeBId}`
  )

  const body = await response.json()

  assert.equal(response.status, 200, JSON.stringify(body))
  assert.ok(Array.isArray(body.data))

  assert.deepEqual(
    body.data.map((employee) => Number(employee.id)),
    [employeeAId]
  )
})

test('employee profile scope: admin retains salon employee list', async () => {
  const response = await fetch(
    `${adminBaseUrl}/api/employees`
  )

  const body = await response.json()

  assert.equal(response.status, 200, JSON.stringify(body))
  assert.ok(Array.isArray(body.data))

  const employeeIds = body.data
    .map((employee) => Number(employee.id))
    .sort((a, b) => a - b)

  assert.deepEqual(
    employeeIds,
    [employeeAId, employeeBId].sort((a, b) => a - b)
  )

  assert.ok(
    body.data.every(
      (employee) => Number(employee.salon_id) === salonId
    )
  )
})

async function requestNewClientBooking({
  name,
  employeeId = employeeAId,
  startsAt = '2032-02-10T17:30:00Z',
  extra = {},
}) {
  const response = await fetch(
    `${employeeBaseUrl}/api/appointments`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        employee_id: employeeId,
        service_id: serviceId,
        starts_at: startsAt,
        notes: name,
        new_client: {
          name,
          is_occasional: true,
        },
        ...extra,
      }),
    }
  )

  return {
    status: response.status,
    body: await response.json(),
  }
}

async function countBookingClients(name) {
  const result = await pool.query(
    `
      SELECT count(*)::integer AS count
      FROM clients
      WHERE salon_id = $1 AND name = $2
    `,
    [salonId, name]
  )

  return result.rows[0].count
}

test('new client booking: employee creates own appointment and client together', async () => {
  const name = `Atomic success ${token}`

  const result = await requestNewClientBooking({ name })

  assert.equal(result.status, 201, JSON.stringify(result.body))

  const stored = await pool.query(
    `
      SELECT
        a.employee_id,
        a.salon_id,
        c.name,
        c.is_occasional,
        c.phone_normalized
      FROM appointments a
      JOIN clients c
        ON c.id = a.client_id
       AND c.salon_id = a.salon_id
      WHERE a.id = $1
    `,
    [result.body.data.id]
  )

  assert.equal(stored.rows.length, 1)
  assert.equal(Number(stored.rows[0].employee_id), employeeAId)
  assert.equal(Number(stored.rows[0].salon_id), salonId)
  assert.equal(stored.rows[0].name, name)
  assert.equal(stored.rows[0].is_occasional, true)
  assert.equal(stored.rows[0].phone_normalized, null)
  assert.equal(await countBookingClients(name), 1)

  await pool.query(
    'DELETE FROM appointments WHERE id = $1 AND salon_id = $2',
    [result.body.data.id, salonId]
  )
})

test('new client booking: unavailable time rolls back new client', async () => {
  const name = `Atomic unavailable ${token}`

  const result = await requestNewClientBooking({
    name,
    startsAt: '2032-02-10T22:00:00Z',
  })

  assert.ok(
    result.status >= 400 && result.status < 500,
    JSON.stringify(result)
  )
  assert.ok(result.body.error?.code)
  assert.equal(await countBookingClients(name), 0)
  assert.equal((await findCreatedAppointments(name)).length, 0)
})

test('new client booking: coworker scope denial creates nothing', async () => {
  const name = `Atomic coworker ${token}`

  const result = await requestNewClientBooking({
    name,
    employeeId: employeeBId,
  })

  assert.equal(result.status, 403)
  assert.equal(
    result.body.error.code,
    'EMPLOYEE_APPOINTMENT_SCOPE_VIOLATION'
  )
  assert.equal(await countBookingClients(name), 0)
  assert.equal((await findCreatedAppointments(name)).length, 0)
})

test('new client booking: existing and new client together are rejected', async () => {
  const name = `Atomic ambiguous ${token}`

  const result = await requestNewClientBooking({
    name,
    extra: {
      client_id: clientAId,
    },
  })

  assert.equal(result.status, 400)
  assert.equal(result.body.error.code, 'VALIDATION_ERROR')
  assert.equal(await countBookingClients(name), 0)
  assert.equal((await findCreatedAppointments(name)).length, 0)
})

test('new client booking: invalid client data creates nothing', async () => {
  const name = `Atomic invalid ${token}`

  const result = await requestNewClientBooking({
    name,
    extra: {
      new_client: {
        name,
        is_occasional: false,
      },
    },
  })

  assert.equal(result.status, 400)
  assert.equal(result.body.error.code, 'INVALID_CLIENT_INPUT')
  assert.equal(await countBookingClients(name), 0)
  assert.equal((await findCreatedAppointments(name)).length, 0)
})

test('new client booking: deny override prevents both writes', async () => {
  const name = `Atomic permission ${token}`

  await pool.query(
    `
      INSERT INTO salon_permission_overrides (
        salon_id, role, permission_key, permission_value
      )
      VALUES ($1, 'employee', $2, 'deny')
    `,
    [salonId, SALON_PERMISSION_KEYS.APPOINTMENT_CREATE]
  )

  try {
    const result = await requestNewClientBooking({ name })

    assert.equal(result.status, 403)
    assert.equal(result.body.error.code, 'SALON_PERMISSION_DENIED')
    assert.equal(await countBookingClients(name), 0)
    assert.equal((await findCreatedAppointments(name)).length, 0)
  } finally {
    await pool.query(
      `
        DELETE FROM salon_permission_overrides
        WHERE salon_id = $1
          AND role = 'employee'
          AND permission_key = $2
      `,
      [salonId, SALON_PERMISSION_KEYS.APPOINTMENT_CREATE]
    )
  }
})

test('new client booking: appointment conflict rolls back only the second client', async () => {
  const firstName = `Atomic conflict first ${token}`
  const secondName = `Atomic conflict second ${token}`
  let appointmentId

  try {
    const first = await requestNewClientBooking({
      name: firstName,
      startsAt: '2032-02-10T17:30:00Z',
    })

    assert.equal(
      first.status,
      201,
      JSON.stringify(first.body)
    )

    appointmentId = first.body.data.id

    const second = await requestNewClientBooking({
      name: secondName,
      startsAt: '2032-02-10T17:30:00Z',
    })

    assert.equal(
      second.status,
      409,
      JSON.stringify(second.body)
    )

    assert.equal(await countBookingClients(firstName), 1)
    assert.equal(await countBookingClients(secondName), 0)

    assert.equal(
      (await findCreatedAppointments(firstName)).length,
      1
    )

    assert.equal(
      (await findCreatedAppointments(secondName)).length,
      0
    )
  } finally {
    if (appointmentId) {
      await pool.query(
        `
          DELETE FROM appointments
          WHERE id = $1 AND salon_id = $2
        `,
        [appointmentId, salonId]
      )
    }
  }
})