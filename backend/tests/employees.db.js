import test, { after } from 'node:test'
import assert from 'node:assert/strict'

import app from '../src/app.js'
import pool from '../src/database/pool.js'

after(async () => {
  await pool.end()
})

async function getEmployeeTestFixture() {
  const result = await pool.query(`
    SELECT
      s.id AS salon_id,
      sv.id AS service_id
    FROM salons s
    JOIN services sv
      ON sv.salon_id = s.id
    WHERE s.name = 'SalonAI Demo Salon'
      AND sv.name = 'Demo Service'
    ORDER BY
      s.id,
      sv.id
    LIMIT 1
  `)

  assert.ok(
    result.rows[0],
    'Expected SalonAI employee regression seed fixture to exist.'
  )

  return result.rows[0]
}

async function waitForServer(server) {
  if (server.listening) {
    return
  }

  await new Promise((resolve) => {
    server.once(
      'listening',
      resolve
    )
  })
}

async function closeServer(server) {
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

test(
  'POST /api/employees persists BREAK blocked time',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    let employeeId = null

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              'Employee Blocked Time Test',

            active: true,

            service_ids: [
              Number(
                fixture.service_id
              ),
            ],

            working_hours: [],

            date_overrides: [],

            time_off: [],

            blocked_times: [
              {
                starts_at:
                  '2026-09-19T13:00:00.000Z',

                ends_at:
                  '2026-09-19T13:30:00.000Z',

                type:
                  'BREAK',

                reason:
                  'Regression BREAK test',
              },
            ],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        201
      )

      assert.ok(body.data)

      employeeId =
        Number(body.data.id)

      assert.ok(
        Number.isSafeInteger(
          employeeId
        )
      )

      const blockedTimeResult =
        await pool.query(
          `
            SELECT
              starts_at,
              ends_at,
              type,
              reason
            FROM employee_blocked_times
            WHERE employee_id = $1
          `,
          [employeeId]
        )

      assert.equal(
        blockedTimeResult.rows.length,
        1
      )

      const blockedTime =
        blockedTimeResult.rows[0]

      assert.equal(
        blockedTime.type,
        'BREAK'
      )

      assert.equal(
        blockedTime.reason,
        'Regression BREAK test'
      )

      assert.equal(
        blockedTime.starts_at
          .toISOString(),
        '2026-09-19T13:00:00.000Z'
      )

      assert.equal(
        blockedTime.ends_at
          .toISOString(),
        '2026-09-19T13:30:00.000Z'
      )
    } finally {
      if (employeeId) {
        await pool.query(
          `
            DELETE FROM employees
            WHERE id = $1
          `,
          [employeeId]
        )
      }

      await closeServer(server)
    }
  }
)

test(
  'GET /api/employees hydrates blocked times',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const employeeResult =
      await pool.query(
        `
          INSERT INTO employees (
            salon_id,
            name,
            active
          )
          VALUES ($1, $2, $3)
          RETURNING id
        `,
        [
          fixture.salon_id,
          'Employee Hydration Test',
          true,
        ]
      )

    const employeeId =
      Number(
        employeeResult.rows[0].id
      )

    const server = app.listen(0)

    try {
      await waitForServer(server)

      await pool.query(
        `
          INSERT INTO employee_blocked_times (
            employee_id,
            starts_at,
            ends_at,
            type,
            reason
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          employeeId,
          '2026-09-21T10:00:00.000Z',
          '2026-09-21T10:45:00.000Z',
          'BREAK',
          'Hydration regression test',
        ]
      )

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees?salon_id=${fixture.salon_id}`
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        200
      )

      assert.ok(
        Array.isArray(body.data)
      )

      const employee =
        body.data.find(
          (item) =>
            Number(item.id) ===
            employeeId
        )

      assert.ok(
        employee,
        'Expected test employee in GET response.'
      )

      assert.ok(
        Array.isArray(
          employee.blocked_times
        )
      )

      assert.equal(
        employee.blocked_times.length,
        1
      )

      const blockedTime =
        employee.blocked_times[0]

      assert.equal(
        blockedTime.type,
        'BREAK'
      )

      assert.equal(
        blockedTime.reason,
        'Hydration regression test'
      )

      assert.equal(
        new Date(
          blockedTime.starts_at
        ).toISOString(),
        '2026-09-21T10:00:00.000Z'
      )

      assert.equal(
        new Date(
          blockedTime.ends_at
        ).toISOString(),
        '2026-09-21T10:45:00.000Z'
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE id = $1
        `,
        [employeeId]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects non-boolean active',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Active Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active:
              'not-a-boolean',

            service_ids: [],

            working_hours: [],

            date_overrides: [],

            time_off: [],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'active must be a boolean.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'PATCH /api/employees/:id rejects non-boolean active',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const employeeResult =
      await pool.query(
        `
          INSERT INTO employees (
            salon_id,
            name,
            active
          )
          VALUES ($1, $2, $3)
          RETURNING id
        `,
        [
          fixture.salon_id,
          'Employee Patch Active Test',
          true,
        ]
      )

    const employeeId =
      Number(
        employeeResult.rows[0].id
      )

    const server = app.listen(0)

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees/${employeeId}`,
        {
          method: 'PATCH',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              'Employee Patch Active Test',

            active:
              'not-a-boolean',

            service_ids: [],

            working_hours: [],

            date_overrides: [],

            time_off: [],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'active must be a boolean.'
      )

      const persistedEmployee =
        await pool.query(
          `
            SELECT
              name,
              active
            FROM employees
            WHERE id = $1
          `,
          [employeeId]
        )

      assert.equal(
        persistedEmployee.rows.length,
        1
      )

      assert.equal(
        persistedEmployee.rows[0].name,
        'Employee Patch Active Test'
      )

      assert.equal(
        persistedEmployee.rows[0].active,
        true
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE id = $1
        `,
        [employeeId]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects non-array service_ids',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Services Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: 123,

            working_hours: [],

            date_overrides: [],

            time_off: [],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'service_ids must be an array.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects invalid service_ids values',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Service ID Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [
              Number(
                fixture.service_id
              ),
              'abc',
            ],

            working_hours: [],

            date_overrides: [],

            time_off: [],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'service_ids must contain only positive integers.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects duplicate service_ids',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Duplicate Services Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const serviceId =
        Number(
          fixture.service_id
        )

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [
              serviceId,
              serviceId,
            ],

            working_hours: [],

            date_overrides: [],

            time_off: [],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'service_ids must not contain duplicates.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rolls back when service belongs to another salon',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const testEmployeeName =
      'Employee Cross Salon Service Test'

    const otherSalonResult =
      await pool.query(
        `
          INSERT INTO salons (
            name,
            timezone,
            active
          )
          VALUES ($1, $2, $3)
          RETURNING id
        `,
        [
          'Employee Cross Salon Test Salon',
          'Europe/Zagreb',
          true,
        ]
      )

    const otherSalonId =
      Number(
        otherSalonResult.rows[0].id
      )

    const otherServiceResult =
      await pool.query(
        `
          INSERT INTO services (
            salon_id,
            name,
            category,
            price_cents,
            default_duration_minutes,
            active
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `,
        [
          otherSalonId,
          'Cross Salon Test Service',
          'test',
          1000,
          30,
          true,
        ]
      )

    const otherServiceId =
      Number(
        otherServiceResult.rows[0].id
      )

    const server = app.listen(0)

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [
              otherServiceId,
            ],

            working_hours: [],

            date_overrides: [],

            time_off: [],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'SERVICE_SALON_MISMATCH'
      )

      assert.equal(
        body.error?.message,
        'Service does not belong to the selected salon.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0,
        'Employee must not remain persisted after transaction rollback.'
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await pool.query(
        `
          DELETE FROM salons
          WHERE id = $1
        `,
        [otherSalonId]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects non-array working_hours',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Working Hours Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: 123,

            date_overrides: [],

            time_off: [],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'working_hours must be an array.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects invalid working_hours day_of_week',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Working Day Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [
              {
                day_of_week: 8,
                start_time: '09:00',
                end_time: '17:00',
              },
            ],

            date_overrides: [],

            time_off: [],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'working_hours day_of_week must be an integer between 1 and 7.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects invalid working_hours start_time',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Working Start Time Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [
              {
                day_of_week: 1,
                start_time: '9:00',
                end_time: '17:00',
              },
            ],

            date_overrides: [],

            time_off: [],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'working_hours start_time must use HH:MM format.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects invalid working_hours end_time',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Working End Time Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [
              {
                day_of_week: 1,
                start_time: '09:00',
                end_time: '17:0',
              },
            ],

            date_overrides: [],

            time_off: [],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'working_hours end_time must use HH:MM format.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects invalid working_hours time range',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Working Range Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [
              {
                day_of_week: 1,
                start_time: '17:00',
                end_time: '09:00',
              },
            ],

            date_overrides: [],

            time_off: [],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'working_hours start_time must be earlier than end_time.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects duplicate working_hours day_of_week',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Duplicate Working Day Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [
              {
                day_of_week: 1,
                start_time: '09:00',
                end_time: '13:00',
              },
              {
                day_of_week: 1,
                start_time: '14:00',
                end_time: '18:00',
              },
            ],

            date_overrides: [],

            time_off: [],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'working_hours must not contain duplicate day_of_week values.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects non-array date_overrides',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Date Overrides Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [],

            date_overrides: {
              date: '2026-09-18',
              enabled: true,
              start_time: '09:00',
              end_time: '17:00',
            },

            time_off: [],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'date_overrides must be an array.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects invalid date_overrides date',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Date Override Date Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [],

            date_overrides: [
              {
                date: '2026-02-29',
                enabled: true,
                start_time: '09:00',
                end_time: '17:00',
              },
            ],

            time_off: [],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'date_overrides date must be a valid date in YYYY-MM-DD format.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects non-boolean date_overrides enabled',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Date Override Enabled Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [],

            date_overrides: [
              {
                date: '2026-09-18',
                enabled: 'true',
                start_time: '09:00',
                end_time: '17:00',
              },
            ],

            time_off: [],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'date_overrides enabled must be a boolean.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects times when date_overrides enabled is false',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Disabled Date Override Times Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [],

            date_overrides: [
              {
                date: '2026-09-18',
                enabled: false,
                start_time: '09:00',
                end_time: '17:00',
              },
            ],

            time_off: [],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'date_overrides times must be null when enabled is false.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects invalid start_time when date_overrides enabled is true',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Date Override Start Time Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [],

            date_overrides: [
              {
                date: '2026-09-18',
                enabled: true,
                start_time: '9:00',
                end_time: '17:00',
              },
            ],

            time_off: [],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'date_overrides start_time must use HH:MM format when enabled is true.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects invalid end_time when date_overrides enabled is true',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Date Override End Time Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [],

            date_overrides: [
              {
                date: '2026-09-18',
                enabled: true,
                start_time: '09:00',
                end_time: '17:0',
              },
            ],

            time_off: [],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'date_overrides end_time must use HH:MM format when enabled is true.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects invalid date_overrides time range',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Date Override Time Range Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [],

            date_overrides: [
              {
                date: '2026-09-18',
                enabled: true,
                start_time: '17:00',
                end_time: '09:00',
              },
            ],

            time_off: [],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'date_overrides start_time must be earlier than end_time.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects duplicate date_overrides dates',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Duplicate Date Override Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [],

            date_overrides: [
              {
                date: '2026-09-18',
                enabled: true,
                start_time: '09:00',
                end_time: '17:00',
              },
              {
                date: '2026-09-18',
                enabled: false,
                start_time: null,
                end_time: null,
              },
            ],

            time_off: [],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'date_overrides must not contain duplicate dates.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects non-array time_off',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Time Off Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [],

            date_overrides: [],

            time_off: {
              start_date: '2026-09-18',
              end_date: '2026-09-19',
              type: 'vacation',
              note: 'Test',
            },

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'time_off must be an array.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects invalid time_off start_date',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Time Off Start Date Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [],

            date_overrides: [],

            time_off: [
              {
                start_date: '2026-02-29',
                end_date: '2026-03-01',
                type: 'vacation',
                note: 'Test',
              },
            ],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'time_off start_date must be a valid date in YYYY-MM-DD format.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects invalid time_off end_date',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Time Off End Date Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [],

            date_overrides: [],

            time_off: [
              {
                start_date: '2026-09-18',
                end_date: '2026-02-29',
                type: 'vacation',
                note: 'Test',
              },
            ],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'time_off end_date must be a valid date in YYYY-MM-DD format.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects invalid time_off date range',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Time Off Date Range Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [],

            date_overrides: [],

            time_off: [
              {
                start_date: '2026-09-20',
                end_date: '2026-09-18',
                type: 'vacation',
                note: 'Test',
              },
            ],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'time_off start_date must not be after end_date.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects invalid time_off type',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Time Off Type Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [],

            date_overrides: [],

            time_off: [
              {
                start_date: '2026-09-18',
                end_date: '2026-09-19',
                type: 'holiday',
                note: 'Test',
              },
            ],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'time_off type must be one of: vacation, sick, training, personal, other.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects invalid time_off note',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Time Off Note Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [],

            date_overrides: [],

            time_off: [
              {
                start_date: '2026-09-18',
                end_date: '2026-09-19',
                type: 'vacation',
                note: {
                  text: 'Invalid note',
                },
              },
            ],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'time_off note must be a string or null.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects non-array blocked_times',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Blocked Times Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [],

            date_overrides: [],

            time_off: [],

            blocked_times: {
              starts_at:
                '2026-09-18T09:00:00.000Z',

              ends_at:
                '2026-09-18T10:00:00.000Z',

              type: 'BREAK',

              reason: 'Test',
            },
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'blocked_times must be an array.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects invalid blocked_times starts_at',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Blocked Time Start Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [],

            date_overrides: [],

            time_off: [],

            blocked_times: [
              {
                starts_at:
                  '2026-09-18T09:00:00',

                ends_at:
                  '2026-09-18T10:00:00.000Z',

                type: 'BREAK',

                reason: 'Test',
              },
            ],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'blocked_times starts_at must be a valid UTC date-time.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects invalid blocked_times ends_at',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Blocked Time End Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [],

            date_overrides: [],

            time_off: [],

            blocked_times: [
              {
                starts_at:
                  '2026-09-18T09:00:00.000Z',

                ends_at:
                  '2026-09-18T10:00:00',

                type: 'BREAK',

                reason: 'Test',
              },
            ],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'blocked_times ends_at must be a valid UTC date-time.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects invalid blocked_times range',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Blocked Time Range Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [],

            date_overrides: [],

            time_off: [],

            blocked_times: [
              {
                starts_at:
                  '2026-09-18T10:00:00.000Z',

                ends_at:
                  '2026-09-18T09:00:00.000Z',

                type: 'BREAK',

                reason: 'Test',
              },
            ],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'blocked_times starts_at must be earlier than ends_at.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects invalid blocked_times type',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Blocked Time Type Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [],

            date_overrides: [],

            time_off: [],

            blocked_times: [
              {
                starts_at:
                  '2026-09-18T09:00:00.000Z',

                ends_at:
                  '2026-09-18T10:00:00.000Z',

                type: 'LUNCH',

                reason: 'Test',
              },
            ],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'blocked_times type must be one of: BREAK, PRIVATE, MEETING, TRAINING, OTHER.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees rejects invalid blocked_times reason',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Invalid Blocked Time Reason Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [],

            date_overrides: [],

            time_off: [],

            blocked_times: [
              {
                starts_at:
                  '2026-09-18T09:00:00.000Z',

                ends_at:
                  '2026-09-18T10:00:00.000Z',

                type: 'BREAK',

                reason: {
                  text: 'Invalid reason',
                },
              },
            ],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'blocked_times reason must be a string or null.'
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        0
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'POST /api/employees allows omitted time_off note',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Optional Time Off Note Test'

    try {
      await waitForServer(server)

      const address =
        server.address()

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [],

            date_overrides: [],

            time_off: [
              {
                start_date: '2026-09-18',
                end_date: '2026-09-19',
                type: 'vacation',
              },
            ],

            blocked_times: [],
          }),
        }
      )

      assert.ok(
        response.status >= 200 &&
        response.status < 300
      )

      const employeeResult =
        await pool.query(
          `
            SELECT
              eto.note
            FROM employees e
            JOIN employee_time_off eto
              ON eto.employee_id = e.id
            WHERE e.salon_id = $1
              AND e.name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        1
      )

      assert.equal(
        employeeResult.rows[0].note,
        null
      )
    } finally {
      await pool.query(
        `
          DELETE FROM employees
          WHERE salon_id = $1
            AND name = $2
        `,
        [
          fixture.salon_id,
          testEmployeeName,
        ]
      )

      await closeServer(server)
    }
  }
)

test(
  'PATCH /api/employees/:id rejects invalid date_overrides',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Patch Date Override Validation Test'

    let employeeId = null

    try {
      await waitForServer(server)

      const address =
        server.address()

      const createResponse = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [],

            date_overrides: [],

            time_off: [],

            blocked_times: [],
          }),
        }
      )

      assert.ok(
        createResponse.status >= 200 &&
        createResponse.status < 300
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        1
      )

      employeeId =
        Number(
          employeeResult.rows[0].id
        )

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees/${employeeId}`,
        {
          method: 'PATCH',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [],

            date_overrides: [
              {
                date: '2026-02-29',
                enabled: true,
                start_time: '09:00',
                end_time: '17:00',
              },
            ],

            time_off: [],

            blocked_times: [],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'date_overrides date must be a valid date in YYYY-MM-DD format.'
      )

      const afterPatchResult =
        await pool.query(
          `
            SELECT
              name,
              active
            FROM employees
            WHERE id = $1
          `,
          [
            employeeId,
          ]
        )

      assert.equal(
        afterPatchResult.rows.length,
        1
      )

      assert.equal(
        afterPatchResult.rows[0].name,
        testEmployeeName
      )

      assert.equal(
        afterPatchResult.rows[0].active,
        true
      )
    } finally {
      if (employeeId !== null) {
        await pool.query(
          `
            DELETE FROM employees
            WHERE id = $1
          `,
          [
            employeeId,
          ]
        )
      } else {
        await pool.query(
          `
            DELETE FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )
      }

      await closeServer(server)
    }
  }
)

test(
  'PATCH /api/employees/:id rejects invalid blocked_times and preserves existing data',
  async () => {
    const fixture =
      await getEmployeeTestFixture()

    const server = app.listen(0)

    const testEmployeeName =
      'Employee Patch Blocked Time Validation Test'

    let employeeId = null

    try {
      await waitForServer(server)

      const address =
        server.address()

      const createResponse = await fetch(
        `http://127.0.0.1:${address.port}/api/employees`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [],

            date_overrides: [],

            time_off: [],

            blocked_times: [
              {
                starts_at:
                  '2026-09-18T09:00:00.000Z',

                ends_at:
                  '2026-09-18T10:00:00.000Z',

                type: 'BREAK',

                reason:
                  'Original blocked time',
              },
            ],
          }),
        }
      )

      assert.ok(
        createResponse.status >= 200 &&
        createResponse.status < 300
      )

      const employeeResult =
        await pool.query(
          `
            SELECT id
            FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )

      assert.equal(
        employeeResult.rows.length,
        1
      )

      employeeId =
        Number(
          employeeResult.rows[0].id
        )

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/employees/${employeeId}`,
        {
          method: 'PATCH',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            salon_id:
              Number(fixture.salon_id),

            name:
              testEmployeeName,

            active: true,

            service_ids: [],

            working_hours: [],

            date_overrides: [],

            time_off: [],

            blocked_times: [
              {
                starts_at:
                  '2026-09-18T11:00:00.000Z',

                ends_at:
                  '2026-09-18T10:00:00.000Z',

                type: 'BREAK',

                reason:
                  'Invalid replacement',
              },
            ],
          }),
        }
      )

      const body =
        await response.json()

      assert.equal(
        response.status,
        400
      )

      assert.equal(
        body.error?.code,
        'VALIDATION_ERROR'
      )

      assert.equal(
        body.error?.message,
        'blocked_times starts_at must be earlier than ends_at.'
      )

      const blockedTimeResult =
        await pool.query(
          `
            SELECT
              starts_at,
              ends_at,
              type,
              reason
            FROM employee_blocked_times
            WHERE employee_id = $1
          `,
          [
            employeeId,
          ]
        )

      assert.equal(
        blockedTimeResult.rows.length,
        1
      )

      assert.equal(
        blockedTimeResult.rows[0].type,
        'BREAK'
      )

      assert.equal(
        blockedTimeResult.rows[0].reason,
        'Original blocked time'
      )

      assert.equal(
        new Date(
          blockedTimeResult.rows[0].starts_at
        ).toISOString(),
        '2026-09-18T09:00:00.000Z'
      )

      assert.equal(
        new Date(
          blockedTimeResult.rows[0].ends_at
        ).toISOString(),
        '2026-09-18T10:00:00.000Z'
      )
    } finally {
      if (employeeId !== null) {
        await pool.query(
          `
            DELETE FROM employees
            WHERE id = $1
          `,
          [
            employeeId,
          ]
        )
      } else {
        await pool.query(
          `
            DELETE FROM employees
            WHERE salon_id = $1
              AND name = $2
          `,
          [
            fixture.salon_id,
            testEmployeeName,
          ]
        )
      }

      await closeServer(server)
    }
  }
)