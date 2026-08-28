import test, { after } from 'node:test'
import assert from 'node:assert/strict'

import app from '../src/app.js'
import pool from '../src/database/pool.js'

after(async () => {
  await pool.end()
})

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