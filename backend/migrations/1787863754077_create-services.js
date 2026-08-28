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
  pgm.createTable('services', {
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

    name: {
      type: 'varchar(150)',
      notNull: true,
    },

    category: {
      type: 'varchar(100)',
      notNull: true,
    },

    price_cents: {
      type: 'integer',
      notNull: true,
    },

    default_duration_minutes: {
      type: 'integer',
      notNull: true,
    },

    active: {
      type: 'boolean',
      notNull: true,
      default: true,
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
    'services',
    'services_price_cents_nonnegative',
    {
      check: 'price_cents >= 0',
    }
  )

  pgm.addConstraint(
    'services',
    'services_duration_positive',
    {
      check:
        'default_duration_minutes > 0',
    }
  )
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('services')
}
