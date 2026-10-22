import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'

import pool from '../src/database/pool.js'

import {
  createFixedTenantTestApp,
} from './helpers/fixedTenantTestApp.js'

test('client search HTTP: quota returns 429, isolates users and preserves CRM denial', async () => {
  let salonId
  const servers = []

  async function startApp(userId) {
    const app = createFixedTenantTestApp(
      salonId,
      {
        role: 'employee',
        userId,
      }
    )

    const server = app.listen(0, '127.0.0.1')
    servers.push(server)

    await once(server, 'listening')

    return `http://127.0.0.1:${server.address().port}`
  }

  async function search(baseUrl, query) {
    const response = await fetch(
      `${baseUrl}/api/clients/search?${query}`
    )

    const body = await response.json()

    return { response, body }
  }

  try {
    const result = await pool.query(
      `
        INSERT INTO salons (name, timezone)
        VALUES ($1, 'Europe/Zagreb')
        RETURNING id
      `,
      [
        `Search Rate Limit ${Date.now()}-${process.pid}`,
      ]
    )

    salonId = Number(result.rows[0].id)

    const firstUserUrl = await startApp(1)
    const secondUserUrl = await startApp(2)

    for (let index = 0; index < 30; index += 1) {
      const { response, body } = await search(
        firstUserUrl,
        'q=RateLimitProbe'
      )

      assert.equal(
        response.status,
        200,
        `Search ${index + 1} should be allowed.`
      )

      assert.deepEqual(body.data, [])
    }

    const blocked = await search(
      firstUserUrl,
      'q=AnotherProbe&userId=999&salonId=999'
    )

    assert.equal(blocked.response.status, 429)

    assert.equal(
      blocked.body.error?.code,
      'CLIENT_SEARCH_RATE_LIMITED'
    )

    assert.equal(
      blocked.response.headers.get('cache-control'),
      'no-store'
    )

    assert.equal(
      Object.hasOwn(blocked.body, 'data'),
      false
    )

    const retryAfter = Number(
      blocked.response.headers.get('retry-after')
    )

    assert.ok(Number.isInteger(retryAfter))
    assert.ok(retryAfter >= 1 && retryAfter <= 60)

    const otherUser = await search(
      secondUserUrl,
      'q=RateLimitProbe'
    )

    assert.equal(otherUser.response.status, 200)
    assert.deepEqual(otherUser.body.data, [])

    const crmResponse = await fetch(
      `${firstUserUrl}/api/clients`
    )

    const crmBody = await crmResponse.json()

    assert.equal(crmResponse.status, 403)

    assert.equal(
      crmBody.error?.code,
      'INSUFFICIENT_SALON_ROLE'
    )
  } finally {
    try {
      await Promise.all(
        servers.map(
          (server) =>
            new Promise((resolve, reject) => {
              server.close((error) => {
                if (error) {
                  reject(error)
                  return
                }

                resolve()
              })
            })
        )
      )
    } finally {
      try {
        if (salonId) {
          await pool.query(
            'DELETE FROM salons WHERE id = $1',
            [salonId]
          )
        }
      } finally {
        await pool.end()
      }
    }
  }
})