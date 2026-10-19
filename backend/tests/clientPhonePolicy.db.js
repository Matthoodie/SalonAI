import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'

import pool from '../src/database/pool.js'

let salonId

before(async () => {
  const result = await pool.query(
    `
      INSERT INTO salons (name, timezone)
      VALUES ($1, 'Europe/Zagreb')
      RETURNING id
    `,
    [`Client Phone Policy ${Date.now()}-${process.pid}`]
  )

  salonId = Number(result.rows[0].id)
})

after(async () => {
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
})

async function insertTestClient({
  occasional,
  countryCode = null,
  phoneNumber = null,
  normalized = null,
}) {
  const result = await pool.query(
    `
      INSERT INTO clients (
        salon_id,
        name,
        is_occasional,
        phone_country_code,
        phone_number,
        phone_normalized
      )
      VALUES ($1, 'Phone Policy Client', $2, $3, $4, $5)
      RETURNING *
    `,
    [
      salonId,
      occasional,
      countryCode,
      phoneNumber,
      normalized,
    ]
  )

  return result.rows[0]
}

test('occasional client can have no phone', async () => {
  const client = await insertTestClient({
    occasional: true,
  })

  assert.equal(client.is_occasional, true)
  assert.equal(client.phone_country_code, null)
  assert.equal(client.phone_number, null)
  assert.equal(client.phone_normalized, null)
})

test('regular client requires phone', async () => {
  await assert.rejects(
    () => insertTestClient({ occasional: false }),
    {
      code: '23514',
      constraint: 'clients_phone_policy_check',
    }
  )
})

test('both client types can have a complete phone', async () => {
  for (const occasional of [false, true]) {
    const client = await insertTestClient({
      occasional,
      countryCode: '+385',
      phoneNumber: '911234567',
      normalized: '+385911234567',
    })

    assert.equal(client.is_occasional, occasional)
    assert.equal(client.phone_normalized, '+385911234567')
  }
})

test('partial phone combinations are rejected', async () => {
  const phoneValues = ['+385', '911234567', '+385911234567']

  for (const occasional of [false, true]) {
    for (let mask = 1; mask < 7; mask += 1) {
      const values = phoneValues.map(
        (value, index) => (mask & (1 << index)) ? value : null
      )

      await assert.rejects(
        () => insertTestClient({
          occasional,
          countryCode: values[0],
          phoneNumber: values[1],
          normalized: values[2],
        }),
        {
          code: '23514',
          constraint: 'clients_phone_policy_check',
        }
      )
    }
  }
})

test('blank phone fields are rejected', async () => {
  for (const field of ['countryCode', 'phoneNumber', 'normalized']) {
    for (const blank of ['', '   ']) {
      await assert.rejects(
        () => insertTestClient({
          occasional: true,
          countryCode: '+385',
          phoneNumber: '911234567',
          normalized: '+385911234567',
          [field]: blank,
        }),
        (error) => {
          assert.equal(error.code, '23514')
          assert.ok([
            'clients_phone_policy_check',
            'clients_phone_normalized_not_empty',
          ].includes(error.constraint))
          return true
        }
      )
    }
  }
})

test('client without phone cannot become regular until phone is provided', async () => {
  const client = await insertTestClient({
    occasional: true,
  })

  await assert.rejects(
    () => pool.query(
      `
        UPDATE clients
        SET is_occasional = false
        WHERE id = $1 AND salon_id = $2
      `,
      [client.id, salonId]
    ),
    {
      code: '23514',
      constraint: 'clients_phone_policy_check',
    }
  )

  const result = await pool.query(
    `
      UPDATE clients
      SET is_occasional = false,
          phone_country_code = '+385',
          phone_number = '919876543',
          phone_normalized = '+385919876543'
      WHERE id = $1 AND salon_id = $2
      RETURNING is_occasional, phone_normalized
    `,
    [client.id, salonId]
  )

  assert.equal(result.rows[0].is_occasional, false)
  assert.equal(result.rows[0].phone_normalized, '+385919876543')
})