/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable('employee_date_overrides', {
    employee_id: {
      type: 'bigint',
      notNull: true,
      references: 'employees',
      onDelete: 'CASCADE',
    },

    date: {
      type: 'date',
      notNull: true,
    },

    enabled: {
      type: 'boolean',
      notNull: true,
      default: true,
    },

    start_time: {
      type: 'time',
    },

    end_time: {
      type: 'time',
    },

    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },

    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  })

  pgm.addConstraint(
    'employee_date_overrides',
    'employee_date_overrides_pkey',
    {
      primaryKey: [
        'employee_id',
        'date',
      ],
    }
  )

  pgm.addConstraint(
    'employee_date_overrides',
    'employee_date_overrides_time_valid',
    {
      check: `
        (
          enabled = false
          AND start_time IS NULL
          AND end_time IS NULL
        )
        OR
        (
          enabled = true
          AND start_time IS NOT NULL
          AND end_time IS NOT NULL
          AND start_time < end_time
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
  pgm.dropTable('employee_date_overrides')
}
