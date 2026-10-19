import test, {
  before,
  after,
} from 'node:test'

import assert from 'node:assert/strict'

import {
  createFixedTenantTestApp,
} from './helpers/fixedTenantTestApp.js'

import pool from '../src/database/pool.js'

let server = null
let baseUrl = null
let employeeId = null

before(async () => {
  const result = await pool.query(`
    SELECT id
    FROM salons
    WHERE name = 'SalonAI Demo Salon'
      AND active = true
    ORDER BY id
    LIMIT 1
  `)

  assert.ok(
    result.rows[0],
    'Expected SalonAI Demo Salon test fixture.'
  )

  const salonId =
    Number(result.rows[0].id)

  const employeeResult = await pool.query(
    `
      SELECT id
      FROM employees
      WHERE salon_id = $1
        AND active = true
      ORDER BY id
      LIMIT 1
    `,
    [salonId]
  )

  assert.ok(
    employeeResult.rows[0],
    'Expected an active employee in the demo salon test fixture.'
  )

  employeeId = Number(employeeResult.rows[0].id)

  const app =
    createFixedTenantTestApp(
      salonId,
      {
        role: 'employee',
        employeeId,
      }
    )

  server = app.listen(0)

  await new Promise((resolve) => {
    server.once(
      'listening',
      resolve
    )
  })

  const {
    port,
  } = server.address()

  baseUrl =
    `http://127.0.0.1:${port}`
})

after(async () => {
  if (server) {
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

  await pool.end()
})

async function expectRoleForbidden({
  method,
  path,
  body,
}) {
  const response = await fetch(
    `${baseUrl}${path}`,
    {
      method,

      headers: {
        'Content-Type':
          'application/json',
      },

      body:
        body === undefined
          ? undefined
          : JSON.stringify(body),
    }
  )

  const responseBody =
    await response.json()

  assert.equal(
    response.status,
    403
  )

  assert.equal(
    responseBody.error?.code,
    'INSUFFICIENT_SALON_ROLE'
  )
}

test(
  'employee can read clients',
  async () => {
    const response = await fetch(
      `${baseUrl}/api/clients`
    )

    assert.equal(
      response.status,
      200
    )
  }
)

test(
  'employee cannot create client',
  async () => {
    await expectRoleForbidden({
      method: 'POST',
      path: '/api/clients',
      body: {
        name: 'Blocked Client',
        phone_country_code: '+385',
        phone_number: '999999999',
        phone_normalized:
          '+385999999999',
      },
    })
  }
)

test(
  'employee cannot update client',
  async () => {
    await expectRoleForbidden({
      method: 'PATCH',
      path: '/api/clients/1',
      body: {
        name: 'Blocked Client Update',
        phone_country_code: '+385',
        phone_number: '999999999',
        phone_normalized:
          '+385999999999',
      },
    })
  }
)

test(
  'employee cannot archive or reactivate client',
  async () => {
    await expectRoleForbidden({
      method: 'PATCH',
      path: '/api/clients/1/active',
      body: {
        active: false,
      },
    })
  }
)

test(
  'employee can read only own employee profile',
  async () => {
    const response = await fetch(
      `${baseUrl}/api/employees`
    )

    const responseBody = await response.json()

    assert.equal(
      response.status,
      200,
      JSON.stringify(responseBody)
    )

    assert.ok(Array.isArray(responseBody.data))
    assert.equal(responseBody.data.length, 1)

    assert.equal(
      Number(responseBody.data[0].id),
      employeeId
    )
  }
)

test(
  'employee cannot create employee',
  async () => {
    await expectRoleForbidden({
      method: 'POST',
      path: '/api/employees',
      body: {
        name: 'Blocked Employee',
      },
    })
  }
)

test(
  'employee cannot update employee',
  async () => {
    await expectRoleForbidden({
      method: 'PATCH',
      path: '/api/employees/1',
      body: {
        name: 'Blocked Employee Update',
      },
    })
  }
)

test(
  'employee cannot archive or reactivate employee',
  async () => {
    await expectRoleForbidden({
      method: 'PATCH',
      path: '/api/employees/1/active',
      body: {
        active: false,
      },
    })
  }
)

test(
  'employee can read services',
  async () => {
    const response = await fetch(
      `${baseUrl}/api/services`
    )

    assert.equal(
      response.status,
      200
    )
  }
)

test(
  'employee cannot create service',
  async () => {
    await expectRoleForbidden({
      method: 'POST',
      path: '/api/services',
      body: {
        name: 'Blocked Service',
        category: 'Security Test',
        price_cents: 2500,
        default_duration_minutes: 30,
      },
    })
  }
)

test(
  'employee cannot update service',
  async () => {
    await expectRoleForbidden({
      method: 'PATCH',
      path: '/api/services/1',
      body: {
        name: 'Blocked Service Update',
        category: 'Security Test',
        price_cents: 2500,
        default_duration_minutes: 30,
      },
    })
  }
)

test(
  'employee cannot archive or reactivate service',
  async () => {
    await expectRoleForbidden({
      method: 'PATCH',
      path: '/api/services/1/active',
      body: {
        active: false,
      },
    })
  }
)
