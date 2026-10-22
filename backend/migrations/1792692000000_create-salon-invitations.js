export const shorthands = undefined

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE salon_invitations (
      id bigserial PRIMARY KEY,

      salon_id bigint NOT NULL
        REFERENCES salons(id) ON DELETE CASCADE,

      email_normalized varchar(320) NOT NULL,

      role varchar(20) NOT NULL,

      employee_id bigint,

      token_hash varchar(64) NOT NULL,

      created_by_user_id bigint NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

      expires_at timestamptz NOT NULL,

      accepted_at timestamptz,

      accepted_by_user_id bigint
        REFERENCES users(id) ON DELETE RESTRICT,

      revoked_at timestamptz,

      revoked_by_user_id bigint
        REFERENCES users(id) ON DELETE RESTRICT,

      CONSTRAINT salon_invitations_role_check
        CHECK (role IN ('employee', 'admin')),

      CONSTRAINT salon_invitations_employee_required_check
        CHECK (role <> 'employee' OR employee_id IS NOT NULL),

      CONSTRAINT salon_invitations_employee_same_salon_fkey
        FOREIGN KEY (employee_id, salon_id)
        REFERENCES employees(id, salon_id)
        ON DELETE RESTRICT,

      CONSTRAINT salon_invitations_email_check
        CHECK (
          email_normalized = lower(btrim(email_normalized))
          AND email_normalized ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
        ),

      CONSTRAINT salon_invitations_token_hash_check
        CHECK (token_hash ~ '^[0-9a-f]{64}$'),

      CONSTRAINT salon_invitations_token_hash_unique
        UNIQUE (token_hash),

      CONSTRAINT salon_invitations_expiry_check
        CHECK (expires_at > created_at),

      CONSTRAINT salon_invitations_acceptance_pair_check
        CHECK (
          (accepted_at IS NULL AND accepted_by_user_id IS NULL)
          OR
          (accepted_at IS NOT NULL AND accepted_by_user_id IS NOT NULL)
        ),

      CONSTRAINT salon_invitations_revocation_pair_check
        CHECK (
          (revoked_at IS NULL AND revoked_by_user_id IS NULL)
          OR
          (revoked_at IS NOT NULL AND revoked_by_user_id IS NOT NULL)
        ),

      CONSTRAINT salon_invitations_terminal_state_check
        CHECK (accepted_at IS NULL OR revoked_at IS NULL),

      CONSTRAINT salon_invitations_acceptance_time_check
        CHECK (
          accepted_at IS NULL
          OR (
            accepted_at >= created_at
            AND accepted_at < expires_at
          )
        ),

      CONSTRAINT salon_invitations_revocation_time_check
        CHECK (
          revoked_at IS NULL
          OR revoked_at >= created_at
        )
    );

    CREATE UNIQUE INDEX salon_invitations_open_email_unique
      ON salon_invitations (salon_id, email_normalized)
      WHERE accepted_at IS NULL AND revoked_at IS NULL;

    CREATE UNIQUE INDEX salon_invitations_open_employee_unique
      ON salon_invitations (salon_id, employee_id)
      WHERE employee_id IS NOT NULL
        AND accepted_at IS NULL
        AND revoked_at IS NULL;
  `)
}

export const down = (pgm) => {
  pgm.dropTable('salon_invitations')
}