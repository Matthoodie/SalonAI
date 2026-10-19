import test, {
  before,
  after,
} from 'node:test'

import assert from 'node:assert/strict'

import pool from '../src/database/pool.js'

let salonAId
let salonBId

let salonAEmployeeId
let salonBEmployeeId

let user1Id
let user2Id
let user3Id
let user4Id

const token =
  `${Date.now()}-${process.pid}`

async function createUser(label) {
  const result = await pool.query(
    `
      INSERT INTO users (
        auth_provider,
        auth_subject,
        email,
        display_name
      )
      VALUES (
        'test',
        $1,
        $2,
        $3
      )
      RETURNING id
    `,
    [
      `role-integrity-${label}-${token}`,
      `${label}-${token}@example.test`,
      `Role Integrity ${label}`,
    ]
  )

  return Number(result.rows[0].id)
}

before(async () => {
  const salons =
    await pool.query(
      `
        INSERT INTO salons (
          name,
          timezone
        )
        VALUES
          ($1, 'Europe/Zagreb'),
          ($2, 'Europe/Zagreb')
        RETURNING id, name
      `,
      [
        `Role Integrity Salon A ${token}`,
        `Role Integrity Salon B ${token}`,
      ]
    )

  salonAId =
    Number(salons.rows[0].id)

  salonBId =
    Number(salons.rows[1].id)

  const employees =
    await pool.query(
      `
        INSERT INTO employees (
          salon_id,
          name
        )
        VALUES
          ($1, 'Integrity Employee A'),
          ($2, 'Integrity Employee B')
        RETURNING id, salon_id
      `,
      [
        salonAId,
        salonBId,
      ]
    )

  const employeeA =
    employees.rows.find(
      (row) =>
        Number(row.salon_id) ===
        salonAId
    )

  const employeeB =
    employees.rows.find(
      (row) =>
        Number(row.salon_id) ===
        salonBId
    )

  salonAEmployeeId =
    Number(employeeA.id)

  salonBEmployeeId =
    Number(employeeB.id)

  user1Id =
    await createUser('user1')

  user2Id =
    await createUser('user2')

  user3Id =
    await createUser('user3')

  user4Id =
    await createUser('user4')
})

after(async () => {
  await pool.query(
    `
      DELETE FROM salons
      WHERE id = ANY($1::bigint[])
    `,
    [[salonAId, salonBId]]
  )

  await pool.query(
    `
      DELETE FROM users
      WHERE id = ANY($1::bigint[])
    `,
    [[
      user1Id,
      user2Id,
      user3Id,
      user4Id,
    ]]
  )

  await pool.end()
})

test(
  'employee membership requires employee_id',
  async () => {
    await assert.rejects(
      pool.query(
        `
          INSERT INTO salon_memberships (
            user_id,
            salon_id,
            role
          )
          VALUES ($1, $2, 'employee')
        `,
        [
          user1Id,
          salonAId,
        ]
      ),
      (error) => {
        assert.equal(
          error.code,
          '23514'
        )

        assert.equal(
          error.constraint,
          'salon_memberships_employee_role_requires_employee'
        )

        return true
      }
    )
  }
)

test(
  'membership cannot link employee from another salon',
  async () => {
    await assert.rejects(
      pool.query(
        `
          INSERT INTO salon_memberships (
            user_id,
            salon_id,
            role,
            employee_id
          )
          VALUES (
            $1,
            $2,
            'employee',
            $3
          )
        `,
        [
          user2Id,
          salonAId,
          salonBEmployeeId,
        ]
      ),
      (error) => {
        assert.equal(
          error.code,
          '23503'
        )

        assert.equal(
          error.constraint,
          'salon_memberships_employee_same_salon_fkey'
        )

        return true
      }
    )
  }
)

test(
  'valid employee membership is accepted',
  async () => {
    const result =
      await pool.query(
        `
          INSERT INTO salon_memberships (
            user_id,
            salon_id,
            role,
            employee_id
          )
          VALUES (
            $1,
            $2,
            'employee',
            $3
          )
          RETURNING
            user_id,
            salon_id,
            role,
            employee_id
        `,
        [
          user3Id,
          salonAId,
          salonAEmployeeId,
        ]
      )

    assert.equal(
      Number(result.rows[0].employee_id),
      salonAEmployeeId
    )

    assert.equal(
      result.rows[0].role,
      'employee'
    )
  }
)

test(
  'same employee cannot be linked to another membership',
  async () => {
    await assert.rejects(
      pool.query(
        `
          INSERT INTO salon_memberships (
            user_id,
            salon_id,
            role,
            employee_id
          )
          VALUES (
            $1,
            $2,
            'admin',
            $3
          )
        `,
        [
          user4Id,
          salonAId,
          salonAEmployeeId,
        ]
      ),
      (error) => {
        assert.equal(
          error.code,
          '23505'
        )

        assert.equal(
          error.constraint,
          'salon_memberships_employee_id_unique'
        )

        return true
      }
    )
  }
)
