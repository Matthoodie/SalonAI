import test, { after } from 'node:test'
import assert from 'node:assert/strict'

import app from '../src/app.js'
import pool from '../src/database/pool.js'

after(async () => {
  await pool.end()
})


async function getSeedFixture() {
  const result = await pool.query(`
    SELECT
      s.id AS salon_id,
      c.id AS client_id,
      e.id AS employee_id,
      sv.id AS service_id
    FROM salons s
    JOIN clients c
      ON c.salon_id = s.id
    JOIN employees e
      ON e.salon_id = s.id
    JOIN services sv
      ON sv.salon_id = s.id
    JOIN employee_services es
      ON es.employee_id = e.id
     AND es.service_id = sv.id
     AND es.salon_id = s.id
    WHERE s.name = 'SalonAI Demo Salon'
      AND c.name = 'Demo Client'
      AND e.name = 'Demo Employee'
      AND sv.name = 'Demo Service'
    ORDER BY
      s.id,
      c.id,
      e.id,
      sv.id
    LIMIT 1
  `)

  assert.ok(
    result.rows[0],
    'Expected SalonAI regression seed fixture to exist.'
  )

  return result.rows[0]
}

test('GET /api/appointments reads seeded appointments from test database', async () => {
  const server = app.listen(0)

  try {
    await new Promise((resolve) => {
      server.once('listening', resolve)
    })

    const address = server.address()

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/appointments`
    )

    const body = await response.json()

    assert.equal(response.status, 200)
    assert.ok(Array.isArray(body.data))

    const seededAppointment = body.data.find(
      (appointment) =>
        appointment.notes ===
        'SalonAI development seed appointment'
    )

    assert.ok(
      seededAppointment,
      'Expected seeded development appointment to exist.'
    )

    assert.equal(
      seededAppointment.status,
      'confirmed'
    )

    assert.equal(
      seededAppointment.source,
      'manual'
    )
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})

test('GET /api/appointments/:id returns seeded appointment from test database', async () => {
  const server = app.listen(0)

  try {
    await new Promise((resolve) => {
      server.once('listening', resolve)
    })

    const address = server.address()
    const baseUrl = `http://127.0.0.1:${address.port}`

    const listResponse = await fetch(
      `${baseUrl}/api/appointments`
    )

    const listBody = await listResponse.json()

    assert.equal(listResponse.status, 200)
    assert.ok(Array.isArray(listBody.data))

    const seededAppointment = listBody.data.find(
      (appointment) =>
        appointment.notes ===
        'SalonAI development seed appointment'
    )

    assert.ok(
      seededAppointment,
      'Expected seeded development appointment to exist.'
    )

    const response = await fetch(
      `${baseUrl}/api/appointments/${seededAppointment.id}`
    )

    const body = await response.json()

    assert.equal(response.status, 200)

    assert.equal(
      body.data.id,
      seededAppointment.id
    )

    assert.equal(
      body.data.notes,
      'SalonAI development seed appointment'
    )

    assert.equal(
      body.data.status,
      'confirmed'
    )

    assert.equal(
      body.data.source,
      'manual'
    )
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})

test('GET /api/appointments/:id returns 404 for missing appointment', async () => {
  const server = app.listen(0)

  try {
    await new Promise((resolve) => {
      server.once('listening', resolve)
    })

    const address = server.address()

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/appointments/999999`
    )

    const body = await response.json()

    assert.equal(response.status, 404)

    assert.deepEqual(body, {
      error: {
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Appointment was not found.',
      },
    })
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})

test('POST /api/appointments creates appointment from seeded test data', async () => {
  const fixture = await getSeedFixture()

  const server = app.listen(0)

  let createdAppointmentId = null

  try {
    await new Promise((resolve) => {
      server.once('listening', resolve)
    })

    const address = server.address()
    const baseUrl =
      `http://127.0.0.1:${address.port}`

    const response = await fetch(
      `${baseUrl}/api/appointments`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          salon_id: fixture.salon_id,
          client_id: fixture.client_id,
          employee_id: fixture.employee_id,
          service_id: fixture.service_id,
          starts_at:
            '2030-01-07T10:00:00+01:00',
          notes:
            'SalonAI regression create appointment test',
        }),
      }
    )

    const body = await response.json()

    assert.equal(response.status, 201)

    assert.equal(
      body.data.notes,
      'SalonAI regression create appointment test'
    )

    assert.equal(
      body.data.status,
      'confirmed'
    )

    assert.equal(
      body.data.source,
      'manual'
    )

    assert.ok(body.data.id)

    createdAppointmentId = body.data.id
  } finally {
    if (createdAppointmentId) {
      await pool.query(
        `
          DELETE FROM appointments
          WHERE id = $1
        `,
        [createdAppointmentId]
      )
    }

    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})

test('POST /api/appointments rejects appointment outside employee working hours', async () => {
  const fixture = await getSeedFixture()

  const server = app.listen(0)

  try {
    await new Promise((resolve) => {
      server.once('listening', resolve)
    })

    const address = server.address()
    const baseUrl =
      `http://127.0.0.1:${address.port}`

    const response = await fetch(
      `${baseUrl}/api/appointments`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          salon_id: fixture.salon_id,
          client_id: fixture.client_id,
          employee_id: fixture.employee_id,
          service_id: fixture.service_id,
          starts_at:
            '2030-01-07T16:45:00+01:00',
          notes:
            'SalonAI regression outside working hours test',
        }),
      }
    )

    const body = await response.json()

    assert.equal(response.status, 409)

    assert.deepEqual(body, {
      error: {
        code: 'APPOINTMENT_OUTSIDE_WORKING_HOURS',
        message:
          'Appointment is outside employee working hours.',
      },
    })
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})

test('POST /api/appointments allows appointment ending exactly at working hours boundary', async () => {
  const fixture = await getSeedFixture()

  const server = app.listen(0)

  let createdAppointmentId = null

  try {
    await new Promise((resolve) => {
      server.once('listening', resolve)
    })

    const address = server.address()
    const baseUrl =
      `http://127.0.0.1:${address.port}`

    const response = await fetch(
      `${baseUrl}/api/appointments`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          salon_id: fixture.salon_id,
          client_id: fixture.client_id,
          employee_id: fixture.employee_id,
          service_id: fixture.service_id,
          starts_at:
            '2030-01-07T16:30:00+01:00',
          notes:
            'SalonAI regression working hours boundary test',
        }),
      }
    )

    const body = await response.json()

    assert.equal(response.status, 201)

    assert.equal(
      body.data.notes,
      'SalonAI regression working hours boundary test'
    )

    assert.equal(
      body.data.duration_minutes,
      30
    )

    createdAppointmentId = body.data.id
  } finally {
    if (createdAppointmentId) {
      await pool.query(
        `
          DELETE FROM appointments
          WHERE id = $1
        `,
        [createdAppointmentId]
      )
    }

    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})

test('POST /api/appointments rejects appointment when employee is not working that day', async () => {
  const fixture = await getSeedFixture()

  const server = app.listen(0)

  try {
    await new Promise((resolve) => {
      server.once('listening', resolve)
    })

    const address = server.address()
    const baseUrl =
      `http://127.0.0.1:${address.port}`

    const response = await fetch(
      `${baseUrl}/api/appointments`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          salon_id: fixture.salon_id,
          client_id: fixture.client_id,
          employee_id: fixture.employee_id,
          service_id: fixture.service_id,

          // Sunday — seeded employee works Monday-Friday.
          starts_at:
            '2030-01-06T10:00:00+01:00',

          notes:
            'SalonAI regression employee not working test',
        }),
      }
    )

    const body = await response.json()

    assert.equal(response.status, 409)

    assert.deepEqual(body, {
      error: {
        code: 'EMPLOYEE_NOT_WORKING',
        message:
          'Employee is not working on the selected day.',
      },
    })
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})

test('POST /api/appointments rejects appointment when date override disables employee availability', async () => {
  const fixture = await getSeedFixture()

  const overrideDate = '2030-01-08'

  let server

  try {
    await pool.query(
      `
        INSERT INTO employee_date_overrides (
          employee_id,
          date,
          enabled,
          start_time,
          end_time
        )
        VALUES (
          $1,
          $2,
          false,
          NULL,
          NULL
        )
        ON CONFLICT (employee_id, date)
        DO UPDATE SET
          enabled = false,
          start_time = NULL,
          end_time = NULL,
          updated_at = CURRENT_TIMESTAMP
      `,
      [
        fixture.employee_id,
        overrideDate,
      ]
    )

    server = app.listen(0)

    await new Promise((resolve) => {
      server.once('listening', resolve)
    })

    const address = server.address()
    const baseUrl =
      `http://127.0.0.1:${address.port}`

    const response = await fetch(
      `${baseUrl}/api/appointments`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          salon_id: fixture.salon_id,
          client_id: fixture.client_id,
          employee_id: fixture.employee_id,
          service_id: fixture.service_id,
          starts_at:
            '2030-01-08T10:00:00+01:00',
          notes:
            'SalonAI regression disabled date override test',
        }),
      }
    )

    const body = await response.json()

    assert.equal(response.status, 409)

    assert.deepEqual(body, {
      error: {
        code: 'EMPLOYEE_UNAVAILABLE',
        message:
          'Employee is not available on the selected date.',
      },
    })
  } finally {
    await pool.query(
      `
        DELETE FROM employee_date_overrides
        WHERE employee_id = $1
          AND date = $2
      `,
      [
        fixture.employee_id,
        overrideDate,
      ]
    )

    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})

test('POST /api/appointments rejects appointment during employee time off', async () => {
  const fixture = await getSeedFixture()

  const timeOffDate = '2030-01-09'

  let server

  try {
    await pool.query(
      `
        INSERT INTO employee_time_off (
          employee_id,
          start_date,
          end_date,
          type,
          note
        )
        VALUES (
          $1,
          $2,
          $2,
          'vacation',
          'SalonAI regression time off test'
        )
      `,
      [
        fixture.employee_id,
        timeOffDate,
      ]
    )

    server = app.listen(0)

    await new Promise((resolve) => {
      server.once('listening', resolve)
    })

    const address = server.address()
    const baseUrl =
      `http://127.0.0.1:${address.port}`

    const response = await fetch(
      `${baseUrl}/api/appointments`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          salon_id: fixture.salon_id,
          client_id: fixture.client_id,
          employee_id: fixture.employee_id,
          service_id: fixture.service_id,
          starts_at:
            '2030-01-09T10:00:00+01:00',
          notes:
            'SalonAI regression time off API test',
        }),
      }
    )

    const body = await response.json()

    assert.equal(response.status, 409)

    assert.deepEqual(body, {
      error: {
        code: 'EMPLOYEE_TIME_OFF',
        message:
          'Employee is unavailable due to time off.',
      },
    })
  } finally {
    await pool.query(
      `
        DELETE FROM employee_time_off
        WHERE employee_id = $1
          AND start_date = $2
          AND end_date = $2
          AND note = 'SalonAI regression time off test'
      `,
      [
        fixture.employee_id,
        timeOffDate,
      ]
    )

    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }

          resolve()
        })
      })
    }
  }
})

test('POST /api/appointments rejects appointment overlapping employee blocked time', async () => {
  const fixture = await getSeedFixture()

  const blockedStart =
    '2030-01-10T10:00:00+01:00'
  const blockedEnd =
    '2030-01-10T11:00:00+01:00'

  let server

  try {
    await pool.query(
      `
        INSERT INTO employee_blocked_times (
          employee_id,
          starts_at,
          ends_at,
          reason
        )
        VALUES (
          $1,
          $2,
          $3,
          'SalonAI regression blocked time test'
        )
      `,
      [
        fixture.employee_id,
        blockedStart,
        blockedEnd,
      ]
    )

    server = app.listen(0)

    await new Promise((resolve) => {
      server.once('listening', resolve)
    })

    const address = server.address()
    const baseUrl =
      `http://127.0.0.1:${address.port}`

    const response = await fetch(
      `${baseUrl}/api/appointments`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          salon_id: fixture.salon_id,
          client_id: fixture.client_id,
          employee_id: fixture.employee_id,
          service_id: fixture.service_id,

          // 10:30–11:00 overlaps blocked 10:00–11:00.
          starts_at:
            '2030-01-10T10:30:00+01:00',

          notes:
            'SalonAI regression blocked time API test',
        }),
      }
    )

    const body = await response.json()

    assert.equal(response.status, 409)

    assert.deepEqual(body, {
      error: {
        code: 'EMPLOYEE_BLOCKED_TIME',
        message:
          'Employee is unavailable during the selected time.',
      },
    })
  } finally {
    await pool.query(
      `
        DELETE FROM employee_blocked_times
        WHERE employee_id = $1
          AND starts_at = $2
          AND ends_at = $3
          AND reason =
            'SalonAI regression blocked time test'
      `,
      [
        fixture.employee_id,
        blockedStart,
        blockedEnd,
      ]
    )

    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }

          resolve()
        })
      })
    }
  }
})

test('POST /api/appointments allows appointment starting exactly when blocked time ends', async () => {
  const fixture = await getSeedFixture()

  const blockedStart =
    '2030-01-10T10:00:00+01:00'
  const blockedEnd =
    '2030-01-10T11:00:00+01:00'

  let server
  let createdAppointmentId = null

  try {
    await pool.query(
      `
        INSERT INTO employee_blocked_times (
          employee_id,
          starts_at,
          ends_at,
          reason
        )
        VALUES (
          $1,
          $2,
          $3,
          'SalonAI regression blocked time boundary test'
        )
      `,
      [
        fixture.employee_id,
        blockedStart,
        blockedEnd,
      ]
    )

    server = app.listen(0)

    await new Promise((resolve) => {
      server.once('listening', resolve)
    })

    const address = server.address()
    const baseUrl =
      `http://127.0.0.1:${address.port}`

    const response = await fetch(
      `${baseUrl}/api/appointments`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          salon_id: fixture.salon_id,
          client_id: fixture.client_id,
          employee_id: fixture.employee_id,
          service_id: fixture.service_id,
          starts_at:
            '2030-01-10T11:00:00+01:00',
          notes:
            'SalonAI regression blocked time boundary API test',
        }),
      }
    )

    const body = await response.json()

    assert.equal(response.status, 201)

    assert.equal(
      body.data.notes,
      'SalonAI regression blocked time boundary API test'
    )

    assert.equal(
      body.data.duration_minutes,
      30
    )

    createdAppointmentId = body.data.id
  } finally {
    if (createdAppointmentId) {
      await pool.query(
        `
          DELETE FROM appointments
          WHERE id = $1
        `,
        [createdAppointmentId]
      )
    }

    await pool.query(
      `
        DELETE FROM employee_blocked_times
        WHERE employee_id = $1
          AND starts_at = $2
          AND ends_at = $3
          AND reason =
            'SalonAI regression blocked time boundary test'
      `,
      [
        fixture.employee_id,
        blockedStart,
        blockedEnd,
      ]
    )

    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }

          resolve()
        })
      })
    }
  }
})

test('POST /api/appointments uses enabled date override instead of regular working hours', async () => {
  const fixture = await getSeedFixture()

  const overrideDate = '2030-01-07'

  let server
  let createdAppointmentId = null

  try {
    await pool.query(
      `
        INSERT INTO employee_date_overrides (
          employee_id,
          date,
          enabled,
          start_time,
          end_time
        )
        VALUES (
          $1,
          $2,
          true,
          '18:00:00',
          '20:00:00'
        )
        ON CONFLICT (employee_id, date)
        DO UPDATE SET
          enabled = true,
          start_time = '18:00:00',
          end_time = '20:00:00',
          updated_at = CURRENT_TIMESTAMP
      `,
      [
        fixture.employee_id,
        overrideDate,
      ]
    )

    server = app.listen(0)

    await new Promise((resolve) => {
      server.once('listening', resolve)
    })

    const address = server.address()
    const baseUrl =
      `http://127.0.0.1:${address.port}`

    const response = await fetch(
      `${baseUrl}/api/appointments`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          salon_id: fixture.salon_id,
          client_id: fixture.client_id,
          employee_id: fixture.employee_id,
          service_id: fixture.service_id,
          starts_at:
            '2030-01-07T18:00:00+01:00',
          notes:
            'SalonAI regression enabled date override test',
        }),
      }
    )

    const body = await response.json()

    assert.equal(response.status, 201)

    assert.equal(
      body.data.notes,
      'SalonAI regression enabled date override test'
    )

    assert.equal(
      body.data.duration_minutes,
      30
    )

    createdAppointmentId = body.data.id
  } finally {
    if (createdAppointmentId) {
      await pool.query(
        `
          DELETE FROM appointments
          WHERE id = $1
        `,
        [createdAppointmentId]
      )
    }

    await pool.query(
      `
        DELETE FROM employee_date_overrides
        WHERE employee_id = $1
          AND date = $2
      `,
      [
        fixture.employee_id,
        overrideDate,
      ]
    )

    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }

          resolve()
        })
      })
    }
  }
})

test('POST /api/appointments rejects overlapping appointment', async () => {
  const fixture = await getSeedFixture()

  let server
  let firstAppointmentId = null

  try {
    server = app.listen(0)

    await new Promise((resolve) => {
      server.once('listening', resolve)
    })

    const address = server.address()
    const baseUrl =
      `http://127.0.0.1:${address.port}`

    const firstResponse = await fetch(
      `${baseUrl}/api/appointments`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          salon_id: fixture.salon_id,
          client_id: fixture.client_id,
          employee_id: fixture.employee_id,
          service_id: fixture.service_id,
          starts_at:
            '2030-01-11T10:00:00+01:00',
          notes:
            'SalonAI regression overlap base appointment',
        }),
      }
    )

    const firstBody = await firstResponse.json()

    assert.equal(firstResponse.status, 201)

    firstAppointmentId = firstBody.data.id

    const secondResponse = await fetch(
      `${baseUrl}/api/appointments`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          salon_id: fixture.salon_id,
          client_id: fixture.client_id,
          employee_id: fixture.employee_id,
          service_id: fixture.service_id,
          starts_at:
            '2030-01-11T10:15:00+01:00',
          notes:
            'SalonAI regression overlap conflicting appointment',
        }),
      }
    )

    const secondBody = await secondResponse.json()

    assert.equal(secondResponse.status, 409)

    assert.deepEqual(secondBody, {
      error: {
        code: 'APPOINTMENT_CONFLICT',
        message:
          'Employee already has an appointment during this time.',
      },
    })
  } finally {
    if (firstAppointmentId) {
      await pool.query(
        `
          DELETE FROM appointments
          WHERE id = $1
        `,
        [firstAppointmentId]
      )
    }

    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }

          resolve()
        })
      })
    }
  }
})