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
  pgm.createTable('employee_working_hours', {
    employee_id: {
      type: 'bigint',
      notNull: true,
      references: 'employees',
      onDelete: 'CASCADE',
    },

    day_of_week: {
      type: 'smallint',
      notNull: true,
    },

    start_time: {
      type: 'time',
      notNull: true,
    },

    end_time: {
      type: 'time',
      notNull: true,
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
    'employee_working_hours',
    'employee_working_hours_pkey',
    {
      primaryKey: [
        'employee_id',
        'day_of_week',
      ],
    }
  )

  pgm.addConstraint(
    'employee_working_hours',
    'employee_working_hours_day_valid',
    {
      check: 'day_of_week BETWEEN 1 AND 7',
    }
  )

  pgm.addConstraint(
    'employee_working_hours',
    'employee_working_hours_time_valid',
    {
      check: 'start_time < end_time',
    }
  )
}


/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('employee_working_hours')
}
