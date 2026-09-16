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