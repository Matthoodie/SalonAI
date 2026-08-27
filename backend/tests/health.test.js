import test from 'node:test'
import assert from 'node:assert/strict'

import app from '../src/app.js'

test('GET /api/health returns backend health status', async () => {
  const server = app.listen(0)

  try {
    await new Promise((resolve) => {
      server.once('listening', resolve)
    })

    const address = server.address()

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/health`
    )

    const body = await response.json()

    assert.equal(response.status, 200)

    assert.deepEqual(body, {
      status: 'ok',
      service: 'salonai-backend',
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

test('unknown API route returns standardized 404 error', async () => {
  const server = app.listen(0)

  try {
    await new Promise((resolve) => {
      server.once('listening', resolve)
    })

    const address = server.address()

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/nepostoji`
    )

    const body = await response.json()

    assert.equal(response.status, 404)

    assert.deepEqual(body, {
      error: {
        code: 'NOT_FOUND',
        message:
          'Requested resource was not found.',
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