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
  pgm.createTable('employee_blocked_times', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },

    employee_id: {
      type: 'bigint',
      notNull: true,
      references: 'employees',
      onDelete: 'CASCADE',
    },

    starts_at: {
      type: 'timestamptz',
      notNull: true,
    },

    ends_at: {
      type: 'timestamptz',
      notNull: true,
    },

    reason: {
      type: 'varchar(250)',
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
    'employee_blocked_times',
    'employee_blocked_times_range_valid',
    {
      check: 'starts_at < ends_at',
    }
  )
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('employee_blocked_times')
}
