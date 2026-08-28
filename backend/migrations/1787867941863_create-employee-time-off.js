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
  pgm.createTable('employee_time_off', {
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

    start_date: {
      type: 'date',
      notNull: true,
    },

    end_date: {
      type: 'date',
      notNull: true,
    },

    type: {
      type: 'varchar(30)',
      notNull: true,
    },

    note: {
      type: 'varchar(500)',
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
    'employee_time_off',
    'employee_time_off_date_range_valid',
    {
      check: 'start_date <= end_date',
    }
  )

  pgm.addConstraint(
    'employee_time_off',
    'employee_time_off_type_valid',
    {
      check: "type IN ('vacation', 'sick', 'training', 'personal', 'other')",
    }
  )
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('employee_time_off')
}
