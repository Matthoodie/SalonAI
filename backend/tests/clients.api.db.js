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

test(
  'PATCH /api/clients/:id updates a client in the selected salon',
  async () => {
    const server = app.listen(0)
    let createdClientId = null

    try {
      await new Promise((resolve) => {
        server.once('listening', resolve)
      })

      const { port } = server.address()
      const baseUrl = `http://127.0.0.1:${port}`

      const phoneNumber = `98${Date.now()}`

      const createResponse = await fetch(
        `${baseUrl}/api/clients`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            salon_id: 1,
            name: 'Client Before Update',
            phone_country_code: '+385',
            phone_number: phoneNumber,
            phone_normalized: `+385${phoneNumber}`,
          }),
        }
      )

      const createBody = await createResponse.json()

      assert.equal(createResponse.status, 201)

      createdClientId = createBody.data.id

      const updateResponse = await fetch(
        `${baseUrl}/api/clients/${createdClientId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            salon_id: 1,
            name: 'Client After Update',
            phone_country_code: '+385',
            phone_number: '981234567',
            phone_normalized: '+385981234567',
          }),
        }
      )

      const updateBody = await updateResponse.json()

      assert.equal(updateResponse.status, 200)
      assert.equal(
        String(updateBody.data.id),
        String(createdClientId)
      )
      assert.equal(
        updateBody.data.name,
        'Client After Update'
      )
      assert.equal(
        updateBody.data.phone_normalized,
        '+385981234567'
      )

      const savedClientResult = await pool.query(
        `
          SELECT
            id,
            salon_id,
            name,
            phone_country_code,
            phone_number,
            phone_normalized
          FROM clients
          WHERE id = $1
            AND salon_id = $2
        `,
        [createdClientId, 1]
      )

      assert.equal(savedClientResult.rows.length, 1)

      const savedClient = savedClientResult.rows[0]

      assert.equal(
        savedClient.name,
        'Client After Update'
      )
      assert.equal(
        savedClient.phone_number,
        '981234567'
      )
      assert.equal(
        savedClient.phone_normalized,
        '+385981234567'
      )
    } finally {
      try {
        if (createdClientId !== null) {
          await pool.query(
            'DELETE FROM clients WHERE id = $1 AND salon_id = $2',
            [createdClientId, 1]
          )
        }
      } finally {
        await new Promise((resolve) => {
          server.close(resolve)
        })
      }
    }
  }
)

test(
  'PATCH /api/clients/:id rejects a client from another salon',
  async () => {
    const server = app.listen(0)
    let createdClientId = null

    try {
      await new Promise((resolve) => {
        server.once('listening', resolve)
      })

      const { port } = server.address()
      const baseUrl = `http://127.0.0.1:${port}`

      const phoneNumber = `97${Date.now()}`

      const createResponse = await fetch(
        `${baseUrl}/api/clients`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            salon_id: 1,
            name: 'Client Before Rejected Update',
            phone_country_code: '+385',
            phone_number: phoneNumber,
            phone_normalized: `+385${phoneNumber}`,
          }),
        }
      )

      const createBody = await createResponse.json()

      assert.equal(createResponse.status, 201)

      createdClientId = createBody.data.id

      const updateResponse = await fetch(
        `${baseUrl}/api/clients/${createdClientId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            salon_id: 999999,
            name: 'This Name Must Not Be Saved',
            phone_country_code: '+385',
            phone_number: '971234567',
            phone_normalized: '+385971234567',
          }),
        }
      )

      const updateBody = await updateResponse.json()

      assert.equal(updateResponse.status, 404)
      assert.equal(
        updateBody.error.code,
        'CLIENT_NOT_FOUND'
      )

      const savedClientResult = await pool.query(
        `
          SELECT salon_id, name, phone_normalized
          FROM clients
          WHERE id = $1
        `,
        [createdClientId]
      )

      assert.equal(savedClientResult.rows.length, 1)

      const savedClient = savedClientResult.rows[0]

      assert.equal(String(savedClient.salon_id), '1')
      assert.equal(
        savedClient.name,
        'Client Before Rejected Update'
      )
      assert.equal(
        savedClient.phone_normalized,
        `+385${phoneNumber}`
      )
    } finally {
      try {
        if (createdClientId !== null) {
          await pool.query(
            'DELETE FROM clients WHERE id = $1 AND salon_id = $2',
            [createdClientId, 1]
          )
        }
      } finally {
        await new Promise((resolve) => {
          server.close(resolve)
        })
      }
    }
  }
)

test(
  'PATCH /api/clients/:id rejects invalid input without changing client',
  async () => {
    const server = app.listen(0)
    let createdClientId = null

    try {
      await new Promise((resolve) => {
        server.once('listening', resolve)
      })

      const { port } = server.address()
      const baseUrl = `http://127.0.0.1:${port}`

      const phoneNumber = `96${Date.now()}`
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
            name: 'Client Before Invalid Update',
            phone_country_code: '+385',
            phone_number: phoneNumber,
            phone_normalized: phoneNormalized,
          }),
        }
      )

      const createBody = await createResponse.json()

      assert.equal(createResponse.status, 201)

      createdClientId = createBody.data.id

      const updateResponse = await fetch(
        `${baseUrl}/api/clients/${createdClientId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            salon_id: 1,
            name: '   ',
            phone_country_code: '+385',
            phone_number: '961234567',
            phone_normalized: '+385961234567',
          }),
        }
      )

      const updateBody = await updateResponse.json()

      assert.equal(updateResponse.status, 400)
      assert.equal(
        updateBody.error.code,
        'INVALID_CLIENT_INPUT'
      )

      const savedClientResult = await pool.query(
        `
          SELECT name, phone_normalized
          FROM clients
          WHERE id = $1
            AND salon_id = $2
        `,
        [createdClientId, 1]
      )

      assert.equal(savedClientResult.rows.length, 1)
      assert.equal(
        savedClientResult.rows[0].name,
        'Client Before Invalid Update'
      )
      assert.equal(
        savedClientResult.rows[0].phone_normalized,
        phoneNormalized
      )
    } finally {
      try {
        if (createdClientId !== null) {
          await pool.query(
            'DELETE FROM clients WHERE id = $1 AND salon_id = $2',
            [createdClientId, 1]
          )
        }
      } finally {
        await new Promise((resolve) => {
          server.close(resolve)
        })
      }
    }
  }
)