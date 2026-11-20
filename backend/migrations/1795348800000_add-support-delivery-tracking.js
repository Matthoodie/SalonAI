export const shorthands = undefined
export const up = pgm => pgm.sql(`
 ALTER TABLE support_notification_outbox DROP CONSTRAINT support_notification_outbox_state_check;
 ALTER TABLE support_notification_outbox ADD CONSTRAINT support_notification_outbox_state_check
   CHECK (state IN ('held','ready','sending','accepted','rejected','uncertain','suppressed'));
 CREATE TABLE support_notification_delivery (
   event_id bigint PRIMARY KEY REFERENCES support_notification_outbox(id) ON DELETE CASCADE,
   idempotency_key uuid NOT NULL UNIQUE,
   recipient text NOT NULL CHECK (length(recipient) BETWEEN 3 AND 254),
   subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 200),
   text_body text NOT NULL CHECK (length(text_body) BETWEEN 1 AND 10000),
   prepared_at timestamptz NOT NULL DEFAULT clock_timestamp(),
   activation_after timestamptz NOT NULL,
   first_attempt_at timestamptz,
   retry_until timestamptz,
   next_attempt_at timestamptz,
   attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 3),
   lease_token uuid,
   lease_until timestamptz,
   provider_id text,
   last_outcome text CHECK (last_outcome IN ('accepted','rejected','rate_limited','unknown','blocked','disabled','lease_expired','retry_exhausted','contact_changed')),
   accepted_at timestamptz,
   CHECK ((lease_token IS NULL) = (lease_until IS NULL)),
   CHECK ((first_attempt_at IS NULL) = (retry_until IS NULL)),
   CHECK (retry_until IS NULL OR (retry_until > first_attempt_at AND retry_until <= first_attempt_at + interval '23 hours'))
 );
 CREATE TABLE support_notification_attempts (
   token uuid PRIMARY KEY,
   event_id bigint NOT NULL REFERENCES support_notification_delivery(event_id) ON DELETE CASCADE,
   attempt_number integer NOT NULL CHECK (attempt_number BETWEEN 1 AND 3),
   started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
   finished_at timestamptz,
   outcome text NOT NULL DEFAULT 'started' CHECK (outcome IN ('started','accepted','rejected','rate_limited','unknown','blocked','disabled','lease_expired')),
   provider_id text,
   UNIQUE (event_id, attempt_number)
 );
 CREATE FUNCTION protect_support_delivery_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
   IF ROW(NEW.event_id,NEW.idempotency_key,NEW.recipient,NEW.subject,NEW.text_body,NEW.prepared_at,NEW.activation_after)
      IS DISTINCT FROM ROW(OLD.event_id,OLD.idempotency_key,OLD.recipient,OLD.subject,OLD.text_body,OLD.prepared_at,OLD.activation_after) THEN
     RAISE EXCEPTION 'Support delivery snapshot is immutable';
   END IF;
   RETURN NEW;
 END;
 $$;
 CREATE TRIGGER support_delivery_snapshot_immutable BEFORE UPDATE ON support_notification_delivery
   FOR EACH ROW EXECUTE FUNCTION protect_support_delivery_snapshot();
 CREATE INDEX support_notification_delivery_lease_idx ON support_notification_delivery(lease_until) WHERE lease_token IS NOT NULL;
 -- No existing held events are prepared, changed or sent by this migration.
`)
export const down = () => { throw new Error('Delivery evidence retention requires a reviewed rollback; no automatic drop.') }
