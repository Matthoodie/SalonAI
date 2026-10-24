export const shorthands = undefined

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE salon_permission_admin_delegations (
      salon_id bigint NOT NULL
        REFERENCES salons(id) ON DELETE CASCADE,

      permission_key varchar(100) NOT NULL,

      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),

      PRIMARY KEY (salon_id, permission_key),

      CONSTRAINT permission_admin_delegations_key_check
        CHECK (
          permission_key IN (
            'appointment.create',
            'appointment.reschedule',
            'appointment.change_status',
            'appointment.change_client'
          )
        )
    );

    CREATE TABLE salon_permission_changes (
      id bigserial PRIMARY KEY,

      salon_id bigint NOT NULL
        REFERENCES salons(id) ON DELETE CASCADE,

      actor_user_id bigint NOT NULL,
      actor_role varchar(20) NOT NULL
        CHECK (actor_role IN ('owner', 'admin')),

      membership_id bigint,
      target_user_id bigint,

      action varchar(30) NOT NULL
        CHECK (action IN ('member_override', 'admin_delegation')),

      permission_key varchar(100) NOT NULL,

      previous_value varchar(30),
      next_value varchar(30),

      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),

      CONSTRAINT permission_changes_key_check
        CHECK (
          permission_key IN (
            'appointment.create',
            'appointment.reschedule',
            'appointment.change_status',
            'appointment.change_client'
          )
        ),

      CONSTRAINT permission_changes_actual_change_check
        CHECK (previous_value IS DISTINCT FROM next_value),

      CONSTRAINT permission_changes_shape_check
        CHECK (
          (
            action = 'member_override'
            AND membership_id IS NOT NULL
            AND target_user_id IS NOT NULL
            AND actor_user_id <> target_user_id
            AND (
              previous_value IS NULL
              OR previous_value IN ('deny', 'self')
            )
            AND (
              next_value IS NULL
              OR next_value IN ('deny', 'self')
            )
          )
          OR
          (
            action = 'admin_delegation'
            AND actor_role = 'owner'
            AND membership_id IS NULL
            AND target_user_id IS NULL
            AND previous_value IS NOT NULL
            AND next_value IS NOT NULL
            AND previous_value IN ('enabled', 'disabled')
            AND next_value IN ('enabled', 'disabled')
          )
        )
    );

    CREATE INDEX salon_permission_changes_salon_id_id_idx
      ON salon_permission_changes (salon_id, id DESC);
  `)
}

export const down = (pgm) => {
  pgm.dropTable('salon_permission_changes')
  pgm.dropTable('salon_permission_admin_delegations')
}