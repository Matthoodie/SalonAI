/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.addColumn(
    'employee_blocked_times',
    {
      type: {
        type: 'varchar(30)',
        notNull: true,
        default: 'OTHER',
      },
    }
  )

  pgm.addConstraint(
    'employee_blocked_times',
    'employee_blocked_times_type_valid',
    {
      check: `
        type IN (
          'BREAK',
          'PRIVATE',
          'MEETING',
          'TRAINING',
          'OTHER'
        )
      `,
    }
  )
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropConstraint(
    'employee_blocked_times',
    'employee_blocked_times_type_valid'
  )

  pgm.dropColumn(
    'employee_blocked_times',
    'type'
  )
}