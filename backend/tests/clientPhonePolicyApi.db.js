import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'

import pool from '../src/database/pool.js'

import {
  createFixedTenantTestApp,
} from './helpers/fixedTenantTestApp.js'

const salonIds = []
const servers = []

let salonId
let otherSalonId
let adminUrl
let employeeUrl
let otherAdminUrl

const phone = {
  phone_country_code: '+385',
  phone_number: '911234567',
  phone_normalized: '+385911234567',
}

async function startServer(id, options) {
  const app = createFixedTenantTestApp(id, options)

  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => {
      resolve(instance)
    })

    instance.once('error', reject)
  })

  servers.push(server)

  return `http://127.0.0.1:${server.address().port}`
}

async function request(baseUrl, method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  return {
    status: response.status,
    body: await response.json(),
  }
}

async function readClient(id) {
  const result = await pool.query(
    'SELECT * FROM clients WHERE id = $1',
    [id]
  )

  return result.rows[0]
}

async function countClients() {
  const result = await pool.query(
    'SELECT count(*)::integer AS count FROM clients WHERE salon_id = $1',
    [salonId]
  )

  return result.rows[0].count
}

async function createOccasionalClient() {
  const result = await request(
    adminUrl,
    'POST',
    '/api/clients',
    {
      name: 'Povremeni klijent',
      is_occasional: true,
    }
  )

  assert.equal(result.status, 201)
  return result.body.data
}

before(async () => {
  for (const suffix of ['A', 'B']) {
    const result = await pool.query(
      `
        INSERT INTO salons (name, timezone)
        VALUES ($1, 'Europe/Zagreb')
        RETURNING id
      `,
      [`Client Phone API ${Date.now()}-${process.pid}-${suffix}`]
    )

    salonIds.push(Number(result.rows[0].id))
  }

  ;[salonId, otherSalonId] = salonIds

  const employeeResult = await pool.query(
    `
      INSERT INTO employees (salon_id, name)
      VALUES ($1, 'Phone API Employee')
      RETURNING id
    `,
    [salonId]
  )

  const employeeId = Number(employeeResult.rows[0].id)

  adminUrl = await startServer(salonId, {
    role: 'admin',
  })

  employeeUrl = await startServer(salonId, {
    role: 'employee',
    employeeId,
  })

  otherAdminUrl = await startServer(otherSalonId, {
    role: 'admin',
  })
})

after(async () => {
  try {
    for (const server of servers) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        })

        server.closeIdleConnections?.()
      })
    }
  } finally {
    try {
      for (const id of salonIds) {
        await pool.query(
          'DELETE FROM salons WHERE id = $1',
          [id]
        )
      }
    } finally {
      await pool.end()
    }
  }
})

test('client phone API: occasional client without phone is persisted', async () => {
  const client = await createOccasionalClient()

  assert.equal(client.is_occasional, true)
  assert.equal(client.phone_country_code, null)
  assert.equal(client.phone_number, null)
  assert.equal(client.phone_normalized, null)

  const stored = await readClient(client.id)

  assert.equal(stored.is_occasional, true)
  assert.equal(stored.phone_country_code, null)
  assert.equal(stored.phone_number, null)
  assert.equal(stored.phone_normalized, null)
})

test('client phone API: complete phone defaults to regular client', async () => {
  const result = await request(
    adminUrl,
    'POST',
    '/api/clients',
    {
      name: 'Stalni klijent',
      ...phone,
    }
  )

  assert.equal(result.status, 201)
  assert.equal(result.body.data.is_occasional, false)

  const stored = await readClient(result.body.data.id)

  assert.equal(stored.is_occasional, false)
  assert.equal(stored.phone_normalized, phone.phone_normalized)
})

test('client phone API: invalid input returns 400 without inserting clients', async () => {
  const countBefore = await countClients()

  const invalidPayloads = [
    {
      name: 'Regular without phone',
    },
    {
      name: 'Explicit regular without phone',
      is_occasional: false,
    },
    {
      name: 'Partial phone',
      is_occasional: true,
      phone_country_code: '+385',
    },
    {
      name: 'String flag',
      is_occasional: 'false',
      ...phone,
    },
    {
      name: 'Null flag',
      is_occasional: null,
      ...phone,
    },
    {
      name: 'Numeric phone',
      is_occasional: true,
      ...phone,
      phone_number: 911234567,
    },
    {
      name: '   ',
      is_occasional: true,
    },
  ]

  for (const payload of invalidPayloads) {
    const result = await request(
      adminUrl,
      'POST',
      '/api/clients',
      payload
    )

    assert.equal(result.status, 400, JSON.stringify(payload))
    assert.equal(result.body.error.code, 'INVALID_CLIENT_INPUT')
  }

  assert.equal(await countClients(), countBefore)
})

test('client phone API: update without flag preserves occasional classification', async () => {
  const client = await createOccasionalClient()

  const result = await request(
    adminUrl,
    'PATCH',
    `/api/clients/${client.id}`,
    {
      name: 'Novo ime povremenog klijenta',
      phone_country_code: null,
      phone_number: null,
      phone_normalized: null,
    }
  )

  assert.equal(result.status, 200)
  assert.equal(result.body.data.is_occasional, true)

  const stored = await readClient(client.id)

  assert.equal(stored.name, 'Novo ime povremenog klijenta')
  assert.equal(stored.is_occasional, true)
  assert.equal(stored.phone_normalized, null)
})

test('client phone API: becoming regular requires phone and rejected update changes nothing', async () => {
  const client = await createOccasionalClient()
  const beforeUpdate = await readClient(client.id)

  const denied = await request(
    adminUrl,
    'PATCH',
    `/api/clients/${client.id}`,
    {
      name: 'Regular conversion',
      is_occasional: false,
    }
  )

  assert.equal(denied.status, 400)
  assert.equal(denied.body.error.code, 'INVALID_CLIENT_INPUT')
  assert.deepEqual(await readClient(client.id), beforeUpdate)

  const allowed = await request(
    adminUrl,
    'PATCH',
    `/api/clients/${client.id}`,
    {
      name: 'Regular conversion',
      is_occasional: false,
      ...phone,
    }
  )

  assert.equal(allowed.status, 200)
  assert.equal(allowed.body.data.is_occasional, false)

  const stored = await readClient(client.id)

  assert.equal(stored.is_occasional, false)
  assert.equal(stored.phone_normalized, phone.phone_normalized)
})

test('client phone API: employee cannot create, edit or archive through CRM routes', async () => {
  const client = await createOccasionalClient()
  const beforeUpdate = await readClient(client.id)
  const countBefore = await countClients()

  const createResult = await request(
    employeeUrl,
    'POST',
    '/api/clients',
    {
      name: 'Employee standalone CRM create',
      is_occasional: true,
    }
  )

  assert.equal(createResult.status, 403)
  assert.equal(await countClients(), countBefore)

  const updateResult = await request(
    employeeUrl,
    'PATCH',
    `/api/clients/${client.id}`,
    {
      name: 'Employee CRM edit',
      is_occasional: true,
    }
  )

  assert.equal(updateResult.status, 403)

  const archiveResult = await request(
    employeeUrl,
    'PATCH',
    `/api/clients/${client.id}/active`,
    {
      active: false,
    }
  )

  assert.equal(archiveResult.status, 403)
  assert.deepEqual(await readClient(client.id), beforeUpdate)
})

test('client phone API: another salon cannot update the client', async () => {
  const client = await createOccasionalClient()
  const beforeUpdate = await readClient(client.id)

  const result = await request(
    otherAdminUrl,
    'PATCH',
    `/api/clients/${client.id}`,
    {
      salon_id: salonId,
      name: 'Cross-tenant attempt',
      is_occasional: true,
    }
  )

  assert.equal(result.status, 404)
  assert.equal(result.body.error.code, 'CLIENT_NOT_FOUND')
  assert.deepEqual(await readClient(client.id), beforeUpdate)
})

test('client phone API: body salon ID cannot redirect client creation', async () => {
  const result = await request(
    adminUrl,
    'POST',
    '/api/clients',
    {
      salon_id: otherSalonId,
      name: 'Tenant authority check',
      is_occasional: true,
    }
  )

  assert.equal(result.status, 201)

  const stored = await readClient(result.body.data.id)

  assert.equal(Number(stored.salon_id), salonId)
})

test('booking client search: employee receives only minimal active salon results', async () => {
  const prefix = `LookupBoundary${Date.now()}`
  const createdIds = []

  for (let index = 0; index < 12; index += 1) {
    const result = await request(
      adminUrl,
      'POST',
      '/api/clients',
      {
        name: `${prefix} ${String(index).padStart(2, '0')}`,
        is_occasional: true,
      }
    )

    assert.equal(result.status, 201)
    createdIds.push(String(result.body.data.id))
  }

  const archived = await request(
    adminUrl,
    'POST',
    '/api/clients',
    {
      name: `${prefix} Archived`,
      is_occasional: true,
    }
  )

  assert.equal(archived.status, 201)

  const archiveResult = await request(
    adminUrl,
    'PATCH',
    `/api/clients/${archived.body.data.id}/active`,
    { active: false }
  )

  assert.equal(archiveResult.status, 200)

  const foreign = await request(
    otherAdminUrl,
    'POST',
    '/api/clients',
    {
      name: `${prefix} Foreign`,
      is_occasional: true,
    }
  )

  assert.equal(foreign.status, 201)

  const response = await fetch(
    `${employeeUrl}/api/clients/search?q=${encodeURIComponent(prefix)}` +
    `&salon_id=${otherSalonId}&limit=1000`
  )

  const body = await response.json()

  assert.equal(response.status, 200, JSON.stringify(body))
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(body.data.length, 10)

  for (const client of body.data) {
    assert.deepEqual(
      Object.keys(client).sort(),
      ['id', 'name', 'phone_hint']
    )

    assert.ok(createdIds.includes(String(client.id)))
    assert.equal(client.phone_hint, null)
  }
})

test('booking client search: invalid and broad queries are rejected', async () => {
  const queries = [
    '',
    'ab',
    '%',
    '___',
    '123',
    'a'.repeat(101),
  ]

  for (const query of queries) {
    const response = await fetch(
      `${employeeUrl}/api/clients/search?q=${encodeURIComponent(query)}`
    )

    const body = await response.json()

    assert.equal(response.status, 400, JSON.stringify({ query, body }))
    assert.equal(body.error.code, 'INVALID_CLIENT_INPUT')
    assert.equal(body.data, undefined)
  }

  const response = await fetch(
    `${employeeUrl}/api/clients/search`
  )

  assert.equal(response.status, 400)
})

test('booking client search: phone is searchable but returned masked', async () => {
  const result = await request(
    adminUrl,
    'POST',
    '/api/clients',
    {
      name: `LookupPhone${Date.now()}`,
      phone_country_code: '+385',
      phone_number: '998765432',
      phone_normalized: '+385998765432',
    }
  )

  assert.equal(result.status, 201)

  for (const query of ['0998765432', '+385998765432']) {
    const response = await fetch(
      `${employeeUrl}/api/clients/search?q=${encodeURIComponent(query)}`
    )

    const body = await response.json()

    assert.equal(response.status, 200, JSON.stringify(body))

    const found = body.data.find(
      (client) => String(client.id) === String(result.body.data.id)
    )

    assert.ok(found)
    assert.deepEqual(
      Object.keys(found).sort(),
      ['id', 'name', 'phone_hint']
    )
    assert.equal(found.phone_hint, '•••• 5432')
  }
})