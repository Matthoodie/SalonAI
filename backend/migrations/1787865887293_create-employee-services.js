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
  pgm.createTable('employee_services', {
    employee_id: {
      type: 'bigint',
      notNull: true,
      references: 'employees',
      onDelete: 'CASCADE',
    },

    service_id: {
      type: 'bigint',
      notNull: true,
      references: 'services',
      onDelete: 'CASCADE',
    },

    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  })

  pgm.addConstraint(
    'employee_services',
    'employee_services_pkey',
    {
      primaryKey: [
        'employee_id',
        'service_id',
      ],
    }
  )
}


/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('employee_services')
}
