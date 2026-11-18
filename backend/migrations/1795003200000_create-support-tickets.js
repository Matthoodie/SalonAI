export const shorthands = undefined
export const up = pgm => pgm.sql(`
  CREATE TABLE support_tickets (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    salon_id bigint REFERENCES salons(id) ON DELETE SET NULL,
    request_id uuid NOT NULL,
    request_hash varchar(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
    category varchar(10) NOT NULL CHECK (category IN ('help','bug','idea')),
    subject text NOT NULL CHECK (char_length(subject) BETWEEN 5 AND 160),
    description text NOT NULL CHECK (char_length(description) BETWEEN 20 AND 5000),
    language varchar(2) NOT NULL CHECK (language IN ('hr','en')),
    context jsonb NOT NULL CHECK (jsonb_typeof(context) = 'object'),
    status varchar(20) NOT NULL DEFAULT 'open'
      CHECK (status IN ('open','pending','resolved','closed')),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT support_tickets_user_request_unique UNIQUE (user_id, request_id)
  );
  CREATE INDEX support_tickets_user_list_idx ON support_tickets(user_id,id DESC);
  CREATE INDEX support_tickets_user_created_idx ON support_tickets(user_id,created_at DESC);
  CREATE INDEX support_tickets_salon_idx ON support_tickets(salon_id) WHERE salon_id IS NOT NULL;
`)
// Destructive rollback: export/retain real support data before considering a down migration.
export const down = pgm => pgm.sql('DROP TABLE support_tickets;')
