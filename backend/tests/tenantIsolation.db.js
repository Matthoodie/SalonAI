import test, {
  before,
  after,
} from 'node:test'

import assert from 'node:assert/strict'

import {
  createFixedTenantTestApp,
} from './helpers/fixedTenantTestApp.js'

import pool from '../src/database/pool.js'

let fixture = null
let server = null
let baseUrl = null

let createdForeignSalonId = null

async function createForeignIsolationFixture() {
  const suffix =
    String(Date.now())

  const salonResult =
    await pool.query(
      `
        INSERT INTO salons (
          name,
          timezone,
          active
        )
        VALUES (
          $1,
          'Europe/Zagreb',
          true
        )
        RETURNING id
      `,
      [
        `S1.6.7 Foreign Salon ${suffix}`,
      ]
    )

  createdForeignSalonId =
    Number(salonResult.rows[0].id)

  const phoneNumber =
    suffix.slice(-9)

  const clientResult =
    await pool.query(
      `
        INSERT INTO clients (
          salon_id,
          name,
          phone_country_code,
          phone_number,
          phone_normalized,
          active
        )
        VALUES (
          $1,
          $2,
          '+385',
          $3,
          $4,
          true
        )
        RETURNING id
      `,
      [
        createdForeignSalonId,
        `S1.6.7 Foreign Client ${suffix}`,
        phoneNumber,
        `+385${phoneNumber}`,
      ]
    )

  const employeeResult =
    await pool.query(
      `
        INSERT INTO employees (
          salon_id,
          name,
          active
        )
        VALUES (
          $1,
          $2,
          true
        )
        RETURNING id
      `,
      [
        createdForeignSalonId,
        `S1.6.7 Foreign Employee ${suffix}`,
      ]
    )

  const serviceResult =
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
        VALUES (
          $1,
          $2,
          'Security Test',
          2500,
          30,
          true
        )
        RETURNING id
      `,
      [
        createdForeignSalonId,
        `S1.6.7 Foreign Service ${suffix}`,
      ]
    )

  const clientId =
    Number(clientResult.rows[0].id)

  const employeeId =
    Number(employeeResult.rows[0].id)

  const serviceId =
    Number(serviceResult.rows[0].id)

  await pool.query(
    `
      INSERT INTO employee_services (
        employee_id,
        service_id,
        salon_id
      )
      VALUES ($1, $2, $3)
    `,
    [
      employeeId,
      serviceId,
      createdForeignSalonId,
    ]
  )

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
      VALUES (
        $1,
        $2,
        $3,
        $4,
        '2035-01-15T09:00:00.000Z',
        '2035-01-15T09:30:00.000Z',
        2500,
        30,
        'confirmed',
        'manual',
        'S1.6.7 foreign appointment'
      )
    `,
    [
      createdForeignSalonId,
      clientId,
      employeeId,
      serviceId,
    ]
  )
}

async function getIsolationFixture() {
  const tenantResult = await pool.query(`
    SELECT
      s.id AS salon_id,
      c.id AS client_id,
      es.employee_id,
      es.service_id
    FROM salons s
    JOIN clients c
      ON c.salon_id = s.id
    JOIN employee_services es
      ON es.salon_id = s.id
    JOIN employees e
      ON e.id = es.employee_id
     AND e.salon_id = s.id
    JOIN services sv
      ON sv.id = es.service_id
     AND sv.salon_id = s.id
    WHERE s.name = 'SalonAI Demo Salon'
      AND s.active = true
      AND e.active = true
      AND sv.active = true
    ORDER BY
      c.id,
      es.employee_id,
      es.service_id
    LIMIT 1
  `)

  assert.ok(
    tenantResult.rows[0],
    'Expected an active SalonAI Demo Salon tenant fixture.'
  )

  const tenant =
    tenantResult.rows[0]

  const foreignResourceResult =
    await pool.query(
      `
        SELECT
          s.id AS salon_id,
          c.id AS client_id,
          es.employee_id,
          es.service_id
        FROM salons s
        JOIN clients c
          ON c.salon_id = s.id
        JOIN employee_services es
          ON es.salon_id = s.id
        JOIN employees e
          ON e.id = es.employee_id
         AND e.salon_id = s.id
        JOIN services sv
          ON sv.id = es.service_id
         AND sv.salon_id = s.id
        WHERE s.id <> $1
          AND s.active = true
          AND e.active = true
          AND sv.active = true
        ORDER BY
          s.id,
          c.id,
          es.employee_id,
          es.service_id
        LIMIT 1
      `,
      [
        tenant.salon_id,
      ]
    )

  assert.ok(
    foreignResourceResult.rows[0],
    'Expected a second active salon fixture with client, employee and service.'
  )

  const foreign =
    foreignResourceResult.rows[0]

  const foreignAppointmentResult =
    await pool.query(
      `
        SELECT
          id,
          salon_id
        FROM appointments
        WHERE salon_id <> $1
        ORDER BY id
        LIMIT 1
      `,
      [
        tenant.salon_id,
      ]
    )

  assert.ok(
    foreignAppointmentResult.rows[0],
    'Expected an appointment belonging to another salon.'
  )

  return {
    tenantSalonId:
      Number(tenant.salon_id),

    tenantClientId:
      Number(tenant.client_id),

    tenantEmployeeId:
      Number(tenant.employee_id),

    tenantServiceId:
      Number(tenant.service_id),

    foreignSalonId:
      Number(foreign.salon_id),

    foreignClientId:
      Number(foreign.client_id),

    foreignEmployeeId:
      Number(foreign.employee_id),

    foreignServiceId:
      Number(foreign.service_id),

    foreignAppointmentId:
      Number(
        foreignAppointmentResult.rows[0].id
      ),
  }
}

before(async () => {
  await createForeignIsolationFixture()

  fixture =
    await getIsolationFixture()

  const app =
    createFixedTenantTestApp(
      fixture.tenantSalonId
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
  
    if (createdForeignSalonId !== null) {
    await pool.query(
      `
        DELETE FROM appointments
        WHERE salon_id = $1
      `,
      [createdForeignSalonId]
    )

    await pool.query(
      `
        DELETE FROM employee_services
        WHERE salon_id = $1
      `,
      [createdForeignSalonId]
    )

    await pool.query(
      `
        DELETE FROM clients
        WHERE salon_id = $1
      `,
      [createdForeignSalonId]
    )

    await pool.query(
      `
        DELETE FROM employees
        WHERE salon_id = $1
      `,
      [createdForeignSalonId]
    )

    await pool.query(
      `
        DELETE FROM services
        WHERE salon_id = $1
      `,
      [createdForeignSalonId]
    )

    await pool.query(
      `
        DELETE FROM salons
        WHERE id = $1
      `,
      [createdForeignSalonId]
    )
  }

  await pool.end()
})

test(
  'fixed tenant cannot read appointment from another salon',
  async () => {
    const response = await fetch(
      `${baseUrl}/api/appointments/${fixture.foreignAppointmentId}`,
      {
        headers: {
          'x-test-salon-id':
            String(fixture.foreignSalonId),
        },
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
  'fixed tenant cannot update status of appointment from another salon',
  async () => {
    const response = await fetch(
      `${baseUrl}/api/appointments/${fixture.foreignAppointmentId}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type':
            'application/json',

          'x-test-salon-id':
            String(fixture.foreignSalonId),
        },
        body: JSON.stringify({
          salon_id:
            fixture.foreignSalonId,

          status:
            'cancelled',
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
  'fixed tenant cannot update client from another salon',
  async () => {
    const response = await fetch(
      `${baseUrl}/api/clients/${fixture.foreignClientId}/active`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type':
            'application/json',

          'x-test-salon-id':
            String(fixture.foreignSalonId),
        },
        body: JSON.stringify({
          salon_id:
            fixture.foreignSalonId,

          active: false,
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
      'CLIENT_NOT_FOUND'
    )
  }
)

test(
  'fixed tenant cannot update employee from another salon',
  async () => {
    const response = await fetch(
      `${baseUrl}/api/employees/${fixture.foreignEmployeeId}/active`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type':
            'application/json',

          'x-test-salon-id':
            String(fixture.foreignSalonId),
        },
        body: JSON.stringify({
          salon_id:
            fixture.foreignSalonId,

          active: false,
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
      'EMPLOYEE_NOT_FOUND'
    )
  }
)

test(
  'fixed tenant cannot update service from another salon',
  async () => {
    const response = await fetch(
      `${baseUrl}/api/services/${fixture.foreignServiceId}/active`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type':
            'application/json',

          'x-test-salon-id':
            String(fixture.foreignSalonId),
        },
        body: JSON.stringify({
          salon_id:
            fixture.foreignSalonId,

          active: false,
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
      'SERVICE_NOT_FOUND'
    )
  }
)

test(
  'public booking rejects client from another salon',
  async () => {
    const response = await fetch(
      `${baseUrl}/api/bookings`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          salon_id:
            fixture.tenantSalonId,

          client_id:
            fixture.foreignClientId,

          employee_id:
            fixture.tenantEmployeeId,

          service_id:
            fixture.tenantServiceId,

          date:
            '2030-01-21',

          start_time:
            '10:00',

          notes:
            'Tenant isolation foreign client test',
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
      'CLIENT_NOT_FOUND'
    )
  }
)

test(
  'public booking rejects employee from another salon',
  async () => {
    const response = await fetch(
      `${baseUrl}/api/bookings`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          salon_id:
            fixture.tenantSalonId,

          client_id:
            fixture.tenantClientId,

          employee_id:
            fixture.foreignEmployeeId,

          service_id:
            fixture.tenantServiceId,

          date:
            '2030-01-21',

          start_time:
            '10:00',
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
      'EMPLOYEE_SALON_MISMATCH'
    )
  }
)

test(
  'public booking rejects service from another salon',
  async () => {
    const response = await fetch(
      `${baseUrl}/api/bookings`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          salon_id:
            fixture.tenantSalonId,

          client_id:
            fixture.tenantClientId,

          employee_id:
            fixture.tenantEmployeeId,

          service_id:
            fixture.foreignServiceId,

          date:
            '2030-01-21',

          start_time:
            '10:00',
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
  }
)

test(
  'public availability rejects employee and service from different salons',
  async () => {
    const url =
      new URL(
        `${baseUrl}/api/availability`
      )

    url.searchParams.set(
      'employeeId',
      String(
        fixture.tenantEmployeeId
      )
    )

    url.searchParams.set(
      'serviceId',
      String(
        fixture.foreignServiceId
      )
    )

    url.searchParams.set(
      'date',
      '2030-01-21'
    )

    const response =
      await fetch(url)

    const body =
      await response.json()

    assert.equal(
      response.status,
      400
    )

    assert.equal(
      body.error?.code,
      'SERVICE_EMPLOYEE_SALON_MISMATCH'
    )
  }
)
