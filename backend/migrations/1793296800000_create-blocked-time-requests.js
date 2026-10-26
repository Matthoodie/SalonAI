export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE employee_blocked_time_requests (
      id bigserial PRIMARY KEY,
      salon_id bigint NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      employee_id bigint NOT NULL,
      requester_membership_id bigint NOT NULL,
      requested_by_user_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      starts_at timestamptz NOT NULL,
      ends_at timestamptz NOT NULL,
      type varchar(30) NOT NULL,
      note varchar(250),
      status varchar(20) NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      decided_at timestamptz,
      decided_by_user_id bigint REFERENCES users(id) ON DELETE RESTRICT,
      decision_actor_role varchar(20),
      decision_note varchar(500),
      withdrawn_at timestamptz,

      CONSTRAINT blocked_time_requests_employee_salon_fk
        FOREIGN KEY (employee_id, salon_id)
        REFERENCES employees(id, salon_id) ON DELETE RESTRICT,
      CONSTRAINT blocked_time_requests_membership_salon_fk
        FOREIGN KEY (requester_membership_id, salon_id, requested_by_user_id)
        REFERENCES salon_memberships(id, salon_id, user_id) ON DELETE RESTRICT,
      CONSTRAINT blocked_time_requests_dates_check
        CHECK (isfinite(starts_at) AND isfinite(ends_at) AND starts_at < ends_at),
      CONSTRAINT blocked_time_requests_type_check
        CHECK (type IN ('BREAK', 'PRIVATE', 'MEETING', 'TRAINING', 'OTHER')),
      CONSTRAINT blocked_time_requests_status_check
        CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
      CONSTRAINT blocked_time_requests_created_time_check
        CHECK (isfinite(created_at)),
      CONSTRAINT blocked_time_requests_decision_role_check
        CHECK (decision_actor_role IS NULL OR decision_actor_role IN ('owner', 'admin')),
      CONSTRAINT blocked_time_requests_other_reviewer_check
        CHECK (decided_by_user_id IS NULL OR decided_by_user_id <> requested_by_user_id),
      CONSTRAINT blocked_time_requests_lifecycle_check
        CHECK (
          (
            status = 'pending'
            AND decided_at IS NULL AND decided_by_user_id IS NULL
            AND decision_actor_role IS NULL AND decision_note IS NULL
            AND withdrawn_at IS NULL
          )
          OR (
            status IN ('approved', 'rejected')
            AND decided_at IS NOT NULL AND isfinite(decided_at)
            AND decided_at >= created_at
            AND decided_by_user_id IS NOT NULL AND decision_actor_role IS NOT NULL
            AND withdrawn_at IS NULL
          )
          OR (
            status = 'withdrawn'
            AND withdrawn_at IS NOT NULL AND isfinite(withdrawn_at)
            AND withdrawn_at >= created_at
            AND decided_at IS NULL AND decided_by_user_id IS NULL
            AND decision_actor_role IS NULL AND decision_note IS NULL
          )
        )
    );

    CREATE UNIQUE INDEX blocked_time_requests_pending_range_unique
      ON employee_blocked_time_requests (salon_id, employee_id, starts_at, ends_at)
      WHERE status = 'pending';

    CREATE INDEX blocked_time_requests_salon_status_id_idx
      ON employee_blocked_time_requests (salon_id, status, id DESC);

    CREATE INDEX blocked_time_requests_employee_id_idx
      ON employee_blocked_time_requests (salon_id, employee_id, id DESC);
    ALTER TABLE employee_blocked_time_requests
      ADD CONSTRAINT blocked_time_requests_source_identity_unique
      UNIQUE (id, employee_id, starts_at, ends_at, type, status);

    ALTER TABLE employee_blocked_times
      ADD COLUMN source_request_id bigint,
      ADD COLUMN source_request_status varchar(20)
        GENERATED ALWAYS AS (
          CASE WHEN source_request_id IS NOT NULL THEN 'approved'::varchar(20) END
        ) STORED;

    ALTER TABLE employee_blocked_times
      ADD CONSTRAINT employee_blocked_times_approved_request_fk
      FOREIGN KEY (
        source_request_id, employee_id, starts_at, ends_at, type, source_request_status
      )
      REFERENCES employee_blocked_time_requests (
        id, employee_id, starts_at, ends_at, type, status
      )
      ON DELETE RESTRICT ON UPDATE RESTRICT;

    CREATE UNIQUE INDEX employee_blocked_times_source_request_unique
      ON employee_blocked_times (source_request_id)
      WHERE source_request_id IS NOT NULL;
    ALTER TABLE employee_blocked_time_requests
      ADD COLUMN cancelled_at timestamptz,
      ADD COLUMN cancelled_by_user_id bigint REFERENCES users(id) ON DELETE RESTRICT,
      ADD COLUMN cancellation_actor_role varchar(20),
      ADD COLUMN cancellation_note varchar(500),
      DROP CONSTRAINT blocked_time_requests_status_check,
      DROP CONSTRAINT blocked_time_requests_lifecycle_check;

    ALTER TABLE employee_blocked_time_requests
      ADD CONSTRAINT blocked_time_requests_status_check
        CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn', 'cancelled')),
      ADD CONSTRAINT blocked_time_requests_lifecycle_check
        CHECK (
          (
            status = 'pending'
            AND decided_at IS NULL AND decided_by_user_id IS NULL
            AND decision_actor_role IS NULL AND decision_note IS NULL
            AND withdrawn_at IS NULL
          )
          OR (
            status IN ('approved', 'rejected', 'cancelled')
            AND decided_at IS NOT NULL AND isfinite(decided_at)
            AND decided_at >= created_at
            AND decided_by_user_id IS NOT NULL AND decision_actor_role IS NOT NULL
            AND withdrawn_at IS NULL
          )
          OR (
            status = 'withdrawn'
            AND withdrawn_at IS NOT NULL AND isfinite(withdrawn_at)
            AND withdrawn_at >= created_at
            AND decided_at IS NULL AND decided_by_user_id IS NULL
            AND decision_actor_role IS NULL AND decision_note IS NULL
          )
        ),
      ADD CONSTRAINT blocked_time_requests_cancellation_check CHECK (
        (status <> 'cancelled'
          AND cancelled_at IS NULL AND cancelled_by_user_id IS NULL
          AND cancellation_actor_role IS NULL AND cancellation_note IS NULL)
        OR
        (status = 'cancelled'
          AND cancelled_at IS NOT NULL AND isfinite(cancelled_at)
          AND cancelled_at >= decided_at
          AND cancelled_by_user_id IS NOT NULL
          AND cancelled_by_user_id <> requested_by_user_id
          AND cancellation_actor_role IS NOT NULL
          AND cancellation_actor_role IN ('owner', 'admin')
          AND cancellation_note IS NOT NULL
          AND length(btrim(cancellation_note, E' \t\n\r')) > 0)
      );
  `)
}

export const down = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM employee_blocked_time_requests) THEN
        RAISE EXCEPTION 'Cannot revert: blocked-time request history exists.';
      END IF;
    END $$;
    DROP INDEX employee_blocked_times_source_request_unique;
    ALTER TABLE employee_blocked_times
      DROP CONSTRAINT employee_blocked_times_approved_request_fk,
      DROP COLUMN source_request_status,
      DROP COLUMN source_request_id;
    DROP TABLE employee_blocked_time_requests;
  `)
}
