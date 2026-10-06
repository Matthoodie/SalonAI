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
  /*
   * USERS
   *
   * Local SalonAI representation of an authenticated user.
   * Authentication itself will be handled by an external
   * provider, while SalonAI keeps its own stable user id.
   */

  pgm.createTable('users', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },

    auth_provider: {
      type: 'varchar(50)',
      notNull: true,
    },

    auth_subject: {
      type: 'varchar(255)',
      notNull: true,
    },

    email: {
      type: 'varchar(320)',
      notNull: true,
    },

    display_name: {
      type: 'varchar(150)',
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
    'users',
    'users_auth_identity_unique',
    {
      unique: [
        'auth_provider',
        'auth_subject',
      ],
    }
  )

  pgm.createIndex(
    'users',
    'email',
    {
      name: 'users_email_idx',
    }
  )

  /*
   * SALON MEMBERSHIPS
   *
   * A user may belong to multiple salons.
   * A salon may contain multiple users.
   *
   * The membership determines the user's role
   * inside that specific salon.
   */

  pgm.createTable(
    'salon_memberships',
    {
      id: {
        type: 'bigserial',
        primaryKey: true,
      },

      user_id: {
        type: 'bigint',
        notNull: true,
        references: 'users',
        onDelete: 'CASCADE',
      },

      salon_id: {
        type: 'bigint',
        notNull: true,
        references: 'salons',
        onDelete: 'CASCADE',
      },

      role: {
        type: 'varchar(20)',
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
        default: pgm.func(
          'CURRENT_TIMESTAMP'
        ),
      },

      updated_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func(
          'CURRENT_TIMESTAMP'
        ),
      },
    }
  )

  pgm.addConstraint(
    'salon_memberships',
    'salon_memberships_user_salon_unique',
    {
      unique: [
        'user_id',
        'salon_id',
      ],
    }
  )

  pgm.addConstraint(
    'salon_memberships',
    'salon_memberships_role_check',
    {
      check:
        "role IN ('owner', 'admin', 'employee')",
    }
  )

  pgm.createIndex(
    'salon_memberships',
    'salon_id',
    {
      name:
        'salon_memberships_salon_id_idx',
    }
  )
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('salon_memberships')
  pgm.dropTable('users')
}