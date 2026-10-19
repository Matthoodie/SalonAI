export const shorthands = undefined

export const up = (pgm) => {
  pgm.createTable(
    'salon_permission_overrides',
    {
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

      role: {
        type: 'varchar(20)',
        notNull: true,
      },

      permission_key: {
        type: 'varchar(100)',
        notNull: true,
      },

      permission_value: {
        type: 'varchar(30)',
        notNull: true,
      },

      created_at: {
        type: 'timestamptz',
        notNull: true,
        default:
          pgm.func(
            'CURRENT_TIMESTAMP'
          ),
      },

      updated_at: {
        type: 'timestamptz',
        notNull: true,
        default:
          pgm.func(
            'CURRENT_TIMESTAMP'
          ),
      },
    }
  )

  pgm.addConstraint(
    'salon_permission_overrides',
    'salon_permission_overrides_role_check',
    {
      check:
        "role IN ('admin', 'employee')",
    }
  )

  pgm.addConstraint(
    'salon_permission_overrides',
    'salon_permission_overrides_value_check',
    {
      check:
        "permission_value IN ('deny', 'self', 'all', 'approval', 'direct')",
    }
  )

  pgm.addConstraint(
    'salon_permission_overrides',
    'salon_permission_overrides_unique',
    {
      unique: [
        'salon_id',
        'role',
        'permission_key',
      ],
    }
  )

  pgm.createIndex(
    'salon_permission_overrides',
    [
      'salon_id',
      'role',
    ],
    {
      name:
        'salon_permission_overrides_salon_role_idx',
    }
  )
}

export const down = (pgm) => {
  pgm.dropTable(
    'salon_permission_overrides'
  )
}