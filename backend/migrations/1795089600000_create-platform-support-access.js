export const shorthands = undefined
export const up = pgm => pgm.sql(`
 CREATE TABLE platform_support_access (
  user_id bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  auth_subject varchar(133) NOT NULL CHECK (auth_subject ~ '^user_[A-Za-z0-9]{1,128}$'),
  enabled boolean NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
 );
 CREATE TABLE platform_support_access_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  target_user_id bigint REFERENCES users(id) ON DELETE SET NULL,
  target_user_id_snapshot bigint NOT NULL CHECK (target_user_id_snapshot > 0),
  action varchar(10) NOT NULL CHECK (action IN ('grant','revoke')),
  previous_enabled boolean NOT NULL,
  enabled boolean NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 500),
  actor_kind varchar(30) NOT NULL DEFAULT 'database_operator' CHECK (actor_kind='database_operator'),
  actor_database_role text NOT NULL DEFAULT current_user,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT support_access_audit_action CHECK ((action='grant' AND enabled) OR (action='revoke' AND NOT enabled)),
  CONSTRAINT support_access_audit_revision UNIQUE (target_user_id_snapshot,revision)
 );
 CREATE INDEX platform_support_access_audit_time_idx ON platform_support_access_audit(occurred_at DESC,id DESC);
`)
// Access/audit loss must be a conscious maintenance operation, never an automatic rollback.
export const down = () => {throw new Error('Platform support access rollback requires an explicit data-retention plan. No tables were dropped.')}
