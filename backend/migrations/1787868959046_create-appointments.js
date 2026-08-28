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
  pgm.createTable('appointments', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },

    salon_id: {
      type: 'bigint',
      notNull: true,
      references: 'salons',
      onDelete: 'CASCADE',
    },

    client_id: {
      type: 'bigint',
      notNull: true,
      references: 'clients',
      onDelete: 'RESTRICT',
    },

    employee_id: {
      type: 'bigint',
      notNull: true,
      references: 'employees',
      onDelete: 'RESTRICT',
    },

    service_id: {
      type: 'bigint',
      notNull: true,
      references: 'services',
      onDelete: 'RESTRICT',
    },

    starts_at: {
      type: 'timestamptz',
      notNull: true,
    },

    ends_at: {
      type: 'timestamptz',
      notNull: true,
    },

    price_cents: {
      type: 'integer',
      notNull: true,
    },

    duration_minutes: {
      type: 'integer',
      notNull: true,
    },

    status: {
      type: 'varchar(30)',
      notNull: true,
      default: 'confirmed',
    },

    source: {
      type: 'varchar(30)',
      notNull: true,
      default: 'manual',
    },

    notes: {
      type: 'varchar(1000)',
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
    'appointments',
    'appointments_time_range_valid',
    {
      check: 'starts_at < ends_at',
    }
  )

  pgm.addConstraint(
    'appointments',
    'appointments_price_nonnegative',
    {
      check: 'price_cents >= 0',
    }
  )

  pgm.addConstraint(
    'appointments',
    'appointments_duration_positive',
    {
      check: 'duration_minutes > 0',
    }
  )

  pgm.addConstraint(
    'appointments',
    'appointments_status_valid',
    {
      check: "status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')",
    }
  )

  pgm.addConstraint(
    'appointments',
    'appointments_source_valid',
    {
      check: "source IN ('manual', 'web', 'whatsapp', 'ai')",
    }
  )
}


/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('appointments')
}
