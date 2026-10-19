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

let salonId
let clientId
let serviceId
let employeeAId
let employeeBId
let appointmentAId
let appointmentBId

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
        `Employee Read Scope Salon ${token}`,
      ]
    )

  salonId =
    Number(salonResult.rows[0].id)

  const clientResult =
    await pool.query(
      `
        INSERT INTO clients (
          salon_id,
          name,
          phone_country_code,
          phone_number,
          phone_normalized
        )
        VALUES (
          $1,
          'Employee Scope Client',
          '+385',
          $2,
          $3
        )
        RETURNING id
      `,
      [
        salonId,
        `99${Date.now()}`,
        `+38599${Date.now()}`,
      ]
    )

  clientId =
    Number(clientResult.rows[0].id)

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
          'Employee Scope Service',
          'Security Test',
          3000,
          30
        )
        RETURNING id
      `,
      [salonId]
    )

  serviceId =
    Number(serviceResult.rows[0].id)

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
            'Employee Scope A'
          ),
          (
            $1,
            'Employee Scope B'
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
          'Employee Scope A'
      ).id
    )

  employeeBId =
    Number(
      employeesResult.rows.find(
        (row) =>
          row.name ===
          'Employee Scope B'
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
            '2032-02-10T09:00:00Z',
            '2032-02-10T09:30:00Z',
            3000,
            30,
            'confirmed',
            'manual',
            'Employee Scope Appointment A'
          ),
          (
            $1,
            $2,
            $4,
            $5,
            '2032-02-10T10:00:00Z',
            '2032-02-10T10:30:00Z',
            3000,
            30,
            'confirmed',
            'manual',
            'Employee Scope Appointment B'
          )
        RETURNING
          id,
          employee_id,
          notes
      `,
      [
        salonId,
        clientId,
        employeeAId,
        employeeBId,
        serviceId,
      ]
    )

  appointmentAId =
    Number(
      appointmentsResult.rows.find(
        (row) =>
          row.notes ===
          'Employee Scope Appointment A'
      ).id
    )

  appointmentBId =
    Number(
      appointmentsResult.rows.find(
        (row) =>
          row.notes ===
          'Employee Scope Appointment B'
      ).id
    )

  const app =
    createFixedTenantTestApp(
      salonId,
      {
        role: 'employee',
        employeeId: employeeAId,
      }
    )

  server =
    app.listen(0)

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
  'employee appointment list contains only own appointments',
  async () => {
    const response =
      await fetch(
        `${baseUrl}/api/appointments`
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

    assert.ok(
      body.data.some(
        (appointment) =>
          Number(
            appointment.id
          ) === appointmentAId
      )
    )

    assert.equal(
      body.data.some(
        (appointment) =>
          Number(
            appointment.id
          ) === appointmentBId
      ),
      false
    )

    for (
      const appointment
      of body.data
    ) {
      assert.equal(
        Number(
          appointment.employee_id
        ),
        employeeAId
      )
    }
  }
)

test(
  'employee can read own appointment',
  async () => {
    const response =
      await fetch(
        `${baseUrl}/api/appointments/${appointmentAId}`
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
  'employee cannot read another employees appointment',
  async () => {
    const response =
      await fetch(
        `${baseUrl}/api/appointments/${appointmentBId}`
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
  'employee calendar contains only own appointments',
  async () => {
    const response =
      await fetch(
        `${baseUrl}/api/calendar?from=2032-02-10&to=2032-02-10`
      )

    const body =
      await response.json()

    assert.equal(
      response.status,
      200
    )

    assert.ok(
      Array.isArray(
        body.data.appointments
      )
    )

    assert.ok(
      body.data.appointments.some(
        (appointment) =>
          Number(
            appointment.id
          ) === appointmentAId
      )
    )

    assert.equal(
      body.data.appointments.some(
        (appointment) =>
          Number(
            appointment.id
          ) === appointmentBId
      ),
      false
    )

    for (
      const appointment
      of body.data.appointments
    ) {
      assert.equal(
        Number(
          appointment.employee.id
        ),
        employeeAId
      )
    }
  }
)

test(
  'employee cannot spoof another employee through calendar employeeId query',
  async () => {
    const response =
      await fetch(
        `${baseUrl}/api/calendar?from=2032-02-10&to=2032-02-10&employeeId=${employeeBId}`
      )

    const body =
      await response.json()

    assert.equal(
      response.status,
      200
    )

    assert.ok(
      body.data.appointments.some(
        (appointment) =>
          Number(
            appointment.id
          ) === appointmentAId
      )
    )

    assert.equal(
      body.data.appointments.some(
        (appointment) =>
          Number(
            appointment.id
          ) === appointmentBId
      ),
      false
    )

    for (
      const appointment
      of body.data.appointments
    ) {
      assert.equal(
        Number(
          appointment.employee.id
        ),
        employeeAId
      )
    }
  }
)
