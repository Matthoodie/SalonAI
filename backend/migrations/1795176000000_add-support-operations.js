export const shorthands = undefined
export const up = pgm => pgm.sql(`
  ALTER TABLE support_tickets ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK (revision > 0);
  CREATE TABLE support_ticket_messages (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ticket_id bigint NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    operator_user_id bigint REFERENCES users(id) ON DELETE SET NULL,
    body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
  );
  CREATE INDEX support_ticket_messages_page_idx ON support_ticket_messages(ticket_id,id);
  CREATE INDEX support_ticket_messages_quota_idx ON support_ticket_messages(operator_user_id,created_at);
  CREATE TABLE support_ticket_operations (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ticket_id bigint NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    operator_user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id uuid NOT NULL,
    request_hash varchar(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
    result_revision integer NOT NULL CHECK (result_revision > 0),
    result_status varchar(20) NOT NULL CHECK (result_status IN ('open','pending','resolved','closed')),
    message_id bigint REFERENCES support_ticket_messages(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(operator_user_id,request_id)
  );
  CREATE TABLE support_ticket_audit (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    operator_user_id bigint REFERENCES users(id) ON DELETE SET NULL,
    operator_user_id_snapshot bigint NOT NULL CHECK (operator_user_id_snapshot > 0),
    access_revision integer NOT NULL CHECK (access_revision > 0),
    ticket_id bigint REFERENCES support_tickets(id) ON DELETE SET NULL,
    ticket_id_snapshot bigint,
    action varchar(20) NOT NULL CHECK (action IN ('list','detail','messages','reply','status')),
    previous_status varchar(20), new_status varchar(20), ticket_revision integer,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
  );
  CREATE INDEX support_ticket_audit_ticket_idx ON support_ticket_audit(ticket_id,id);
  CREATE INDEX support_tickets_status_list_idx ON support_tickets(status,id DESC);
`)
export const down = () => { throw new Error('Support messages and audit require an explicit retention plan; automatic down is disabled.') }
