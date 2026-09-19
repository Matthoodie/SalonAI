import test, { after } from 'node:test'
import assert from 'node:assert/strict'

import app from '../src/app.js'
import pool from '../src/database/pool.js'

after(async () => {
  await pool.end()
})

test(
  'GET /api/clients returns clients belonging to selected salon',
  async () => {
    const server = app.listen(0)

    try {
      await new Promise((resolve) => {
        server.once('listening', resolve)
      })

      const { port } = server.address()

      const response = await fetch(
        `http://127.0.0.1:${port}/api/clients?salon_id=1`
      )

      const body = await response.json()

      assert.equal(response.status, 200)

      assert.ok(Array.isArray(body.data))

      for (const client of body.data) {
        assert.equal(String(client.salon_id), '1')
        assert.ok(client.id)
        assert.ok(client.name)
      }
    } finally {
      await new Promise((resolve) => {
        server.close(resolve)
      })
    }
  }
)

test(
  'POST /api/clients creates a client that can be fetched',
  async () => {
    const server = app.listen(0)
    let createdClientId = null

    try {
      await new Promise((resolve) => {
        server.once('listening', resolve)
      })

      const { port } = server.address()
      const baseUrl = `http://127.0.0.1:${port}`

      const phoneNumber = `99${Date.now()}`
      const phoneNormalized = `+385${phoneNumber}`

      const createResponse = await fetch(
        `${baseUrl}/api/clients`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            salon_id: 1,
            name: 'Client API Test',
            phone_country_code: '+385',
            phone_number: phoneNumber,
            phone_normalized: phoneNormalized,
          }),
        }
      )

      const createBody = await createResponse.json()

      createdClientId = createBody.data?.id ?? null

      assert.equal(createResponse.status, 201)
      assert.ok(createdClientId)
      assert.equal(createBody.data.name, 'Client API Test')
      assert.equal(String(createBody.data.salon_id), '1')
      assert.equal(
        createBody.data.phone_normalized,
        phoneNormalized
      )

      const getResponse = await fetch(
        `${baseUrl}/api/clients?salon_id=1`
      )

      const getBody = await getResponse.json()

      assert.equal(getResponse.status, 200)

      const savedClient = getBody.data.find(
        (client) =>
          String(client.id) === String(createdClientId)
      )

      assert.ok(savedClient)
      assert.equal(savedClient.name, 'Client API Test')
    } finally {
      if (createdClientId !== null) {
        await pool.query(
          'DELETE FROM clients WHERE id = $1 AND salon_id = $2',
          [createdClientId, 1]
        )
      }

      await new Promise((resolve) => {
        server.close(resolve)
      })
    }
  }
)