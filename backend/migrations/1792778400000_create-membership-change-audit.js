export const shorthands = undefined

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE salon_membership_changes (
      id bigserial PRIMARY KEY,

      salon_id bigint NOT NULL
        REFERENCES salons(id) ON DELETE CASCADE,

      membership_id bigint NOT NULL,
      target_user_id bigint NOT NULL,
      actor_user_id bigint NOT NULL,

      actor_role varchar(20) NOT NULL
        CHECK (actor_role IN ('owner', 'admin')),

      action varchar(20) NOT NULL
        CHECK (action IN ('role', 'active')),

      old_role varchar(20) NOT NULL
        CHECK (old_role IN ('employee', 'admin')),

      new_role varchar(20) NOT NULL
        CHECK (new_role IN ('employee', 'admin')),

      old_active boolean NOT NULL,
      new_active boolean NOT NULL,

      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),

      CONSTRAINT salon_membership_changes_other_user_check
        CHECK (actor_user_id <> target_user_id),

CONSTRAINT salon_membership_changes_transition_check
        CHECK (
          (
            action = 'role'
            AND old_role <> new_role
            AND old_active = new_active
            AND actor_role = 'owner'
          )
          OR
          (
            action = 'active'
            AND old_role = new_role
            AND old_active <> new_active
            AND (
              old_role = 'employee'
              OR actor_role = 'owner'
            )
          )
        )
    );

    CREATE INDEX salon_membership_changes_salon_id_id_idx
      ON salon_membership_changes (salon_id, id DESC);
  `)
}

export const down = (pgm) => {
  pgm.dropTable('salon_membership_changes')
}