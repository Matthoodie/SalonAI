export const shorthands = undefined
export const up = pgm => pgm.sql(`
  CREATE TABLE salon_onboarding (
    salon_id bigint PRIMARY KEY REFERENCES salons(id) ON DELETE CASCADE,
    status varchar(20) NOT NULL DEFAULT 'in_progress'
      CHECK (status IN ('in_progress', 'completed')),
    created_by_user_id bigint REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    completed_at timestamptz,
    CONSTRAINT salon_onboarding_completion_check CHECK (
      (status = 'in_progress' AND completed_at IS NULL) OR
      (status = 'completed' AND completed_at IS NOT NULL)
    )
  );
  CREATE INDEX salon_onboarding_creator_idx ON salon_onboarding(created_by_user_id);
  CREATE TABLE salon_creation_receipts (
    user_id bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    request_id uuid NOT NULL,
    request_hash varchar(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
    salon_id bigint UNIQUE REFERENCES salons(id) ON DELETE SET NULL,
    response jsonb NOT NULL CHECK (jsonb_typeof(response) = 'object'),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
  );
`)
export const down = pgm => pgm.sql(`
  DROP TABLE salon_creation_receipts;
  DROP TABLE salon_onboarding;
`)
