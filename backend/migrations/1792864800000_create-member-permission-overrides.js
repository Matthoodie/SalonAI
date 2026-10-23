export const shorthands = undefined

export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE salon_memberships
      ADD CONSTRAINT salon_memberships_id_salon_unique
      UNIQUE (id, salon_id);

    CREATE TABLE salon_member_permission_overrides (
      id bigserial PRIMARY KEY,

      salon_id bigint NOT NULL,
      membership_id bigint NOT NULL,

      permission_key varchar(100) NOT NULL,
      permission_value varchar(30) NOT NULL,

      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT salon_member_permissions_same_salon_fkey
        FOREIGN KEY (membership_id, salon_id)
        REFERENCES salon_memberships(id, salon_id)
        ON DELETE CASCADE,

      CONSTRAINT salon_member_permissions_key_check
        CHECK (
          permission_key IN (
            'appointment.create',
            'appointment.reschedule',
            'appointment.change_status',
            'appointment.change_client'
          )
        ),

      CONSTRAINT salon_member_permissions_value_check
        CHECK (permission_value IN ('deny', 'self')),

      CONSTRAINT salon_member_permissions_unique
        UNIQUE (membership_id, permission_key)
    );

    CREATE INDEX salon_member_permissions_salon_membership_idx
      ON salon_member_permission_overrides (salon_id, membership_id);
  `)
}

export const down = (pgm) => {
  pgm.dropTable('salon_member_permission_overrides')

  pgm.dropConstraint(
    'salon_memberships',
    'salon_memberships_id_salon_unique'
  )
}