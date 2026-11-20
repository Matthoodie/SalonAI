export const shorthands = undefined
export const up = pgm => pgm.sql(`
  CREATE TABLE support_notification_outbox (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    message_id bigint NOT NULL UNIQUE REFERENCES support_ticket_messages(id) ON DELETE CASCADE,
    event_type text NOT NULL DEFAULT 'support_reply' CHECK (event_type = 'support_reply'),
    language varchar(2) NOT NULL CHECK (language IN ('hr','en')),
    state text NOT NULL DEFAULT 'held' CHECK (state = 'held'),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
  );
`)
// No historical backfill and no automatic delivery. Activation is a separate release.
export const down = () => { throw new Error('Support notification retention must be reviewed before a destructive rollback.') }
