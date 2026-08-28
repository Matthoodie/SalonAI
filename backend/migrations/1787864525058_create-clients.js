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
  pgm.createTable('clients', {
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

    phone_country_code: {
      type: 'varchar(10)',
      notNull: true,
    },

    phone_number: {
      type: 'varchar(30)',
      notNull: true,
    },

    phone_normalized: {
      type: 'varchar(30)',
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
    'clients',
    'clients_phone_normalized_not_empty',
    {
      check: "length(trim(phone_normalized)) > 0",
    }
  )

  pgm.addConstraint(
    'clients',
    'clients_name_not_empty',
    {
      check: "length(trim(name)) > 0",
    }
  )
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('clients')
}
