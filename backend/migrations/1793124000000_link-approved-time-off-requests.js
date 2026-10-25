export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE employee_time_off_requests
      ADD CONSTRAINT time_off_requests_source_identity_unique
      UNIQUE (id, employee_id, start_date, end_date, type, status);

    ALTER TABLE employee_time_off
      ADD COLUMN source_request_id bigint,
      ADD COLUMN source_request_status varchar(20)
        GENERATED ALWAYS AS (
          CASE WHEN source_request_id IS NOT NULL THEN 'approved'::varchar(20) END
        ) STORED;

    ALTER TABLE employee_time_off
      ADD CONSTRAINT employee_time_off_approved_request_fk
      FOREIGN KEY (
        source_request_id, employee_id, start_date, end_date, type, source_request_status
      )
      REFERENCES employee_time_off_requests (
        id, employee_id, start_date, end_date, type, status
      )
      ON DELETE RESTRICT ON UPDATE RESTRICT;

    CREATE UNIQUE INDEX employee_time_off_source_request_unique
      ON employee_time_off (source_request_id)
      WHERE source_request_id IS NOT NULL;
  `)
}

export const down = (pgm) => {
  pgm.sql(`
    DROP INDEX employee_time_off_source_request_unique;
    ALTER TABLE employee_time_off
      DROP CONSTRAINT employee_time_off_approved_request_fk,
      DROP COLUMN source_request_status,
      DROP COLUMN source_request_id;
    ALTER TABLE employee_time_off_requests
      DROP CONSTRAINT time_off_requests_source_identity_unique;
  `)
}
