export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE employee_time_off_requests
      ADD COLUMN cancelled_at timestamptz,
      ADD COLUMN cancelled_by_user_id bigint REFERENCES users(id) ON DELETE RESTRICT,
      ADD COLUMN cancellation_actor_role varchar(20),
      ADD COLUMN cancellation_note varchar(500),
      DROP CONSTRAINT time_off_requests_status_check,
      DROP CONSTRAINT time_off_requests_lifecycle_check;

    ALTER TABLE employee_time_off_requests
      ADD CONSTRAINT time_off_requests_status_check
        CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn', 'cancelled')),
      ADD CONSTRAINT time_off_requests_lifecycle_check
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
      ADD CONSTRAINT time_off_requests_cancellation_check CHECK (
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
    -- Never silently erase cancellation history or resurrect an absence.
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM employee_time_off_requests WHERE status = 'cancelled') THEN
        RAISE EXCEPTION 'Cannot revert: cancelled time-off requests exist. Preserve their audit history.';
      END IF;
    END $$;
    ALTER TABLE employee_time_off_requests
      DROP CONSTRAINT time_off_requests_cancellation_check,
      DROP CONSTRAINT time_off_requests_lifecycle_check,
      DROP CONSTRAINT time_off_requests_status_check,
      DROP COLUMN cancellation_note,
      DROP COLUMN cancellation_actor_role,
      DROP COLUMN cancelled_by_user_id,
      DROP COLUMN cancelled_at;
    ALTER TABLE employee_time_off_requests
      ADD CONSTRAINT time_off_requests_status_check
        CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
      ADD CONSTRAINT time_off_requests_lifecycle_check
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
        );
  `)
}
