import test from 'node:test'
import assert from 'node:assert/strict'

import app from '../src/app.js'

test('GET /api/appointments/:id rejects invalid appointment ID', async () => {
  const server = app.listen(0)

  try {
    await new Promise((resolve) => {
      server.once('listening', resolve)
    })

    const address = server.address()

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/appointments/banana`
    )

    const body = await response.json()

    assert.equal(response.status, 400)

    assert.deepEqual(body, {
      error: {
        code: 'INVALID_APPOINTMENT_ID',
        message:
          'Appointment ID must be a positive integer.',
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