/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.addColumn(
    'salon_memberships',
    {
      employee_id: {
        type: 'bigint',
      },
    }
  )

  pgm.sql(`
    ALTER TABLE salon_memberships
    ADD CONSTRAINT salon_memberships_employee_same_salon_fkey
    FOREIGN KEY (employee_id, salon_id)
    REFERENCES employees(id, salon_id)
    ON DELETE RESTRICT
  `)

  pgm.sql(`
    CREATE UNIQUE INDEX salon_memberships_employee_id_unique
    ON salon_memberships(employee_id)
    WHERE employee_id IS NOT NULL
  `)

  pgm.addConstraint(
    'salon_memberships',
    'salon_memberships_employee_role_requires_employee',
    {
      check:
        "role <> 'employee' OR employee_id IS NOT NULL",
    }
  )
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropConstraint(
    'salon_memberships',
    'salon_memberships_employee_role_requires_employee'
  )

  pgm.sql(`
    DROP INDEX IF EXISTS salon_memberships_employee_id_unique
  `)

  pgm.dropConstraint(
    'salon_memberships',
    'salon_memberships_employee_same_salon_fkey'
  )

  pgm.dropColumn(
    'salon_memberships',
    'employee_id'
  )
}
