export const shorthands = undefined
export const up = pgm => {
  pgm.sql(`
    CREATE TABLE service_import_receipts (
      salon_id bigint NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      request_id uuid NOT NULL,
      requested_by_user_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      request_hash varchar(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
      response jsonb NOT NULL CHECK (jsonb_typeof(response) = 'object'),
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      PRIMARY KEY (salon_id, request_id)
    );
    CREATE INDEX service_import_receipts_user_idx ON service_import_receipts (requested_by_user_id);
  `)
}
export const down = pgm => {
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM service_import_receipts) THEN
        RAISE EXCEPTION 'Cannot remove import receipts after confirmed imports; retry protection must be preserved';
      END IF;
    END $$;
    DROP TABLE service_import_receipts;
  `)
}
