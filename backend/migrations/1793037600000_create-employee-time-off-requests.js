export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE salon_memberships
      ADD CONSTRAINT salon_memberships_id_salon_user_unique
      UNIQUE (id, salon_id, user_id);

    CREATE TABLE employee_time_off_requests (
      id bigserial PRIMARY KEY,
      salon_id bigint NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      employee_id bigint NOT NULL,
      requester_membership_id bigint NOT NULL,
      requested_by_user_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      start_date date NOT NULL,
      end_date date NOT NULL,
      type varchar(30) NOT NULL,
      note varchar(500),
      status varchar(20) NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      decided_at timestamptz,
      decided_by_user_id bigint REFERENCES users(id) ON DELETE RESTRICT,
      decision_actor_role varchar(20),
      decision_note varchar(500),
      withdrawn_at timestamptz,

      CONSTRAINT time_off_requests_employee_salon_fk
        FOREIGN KEY (employee_id, salon_id)
        REFERENCES employees(id, salon_id) ON DELETE RESTRICT,
      CONSTRAINT time_off_requests_membership_salon_fk
        FOREIGN KEY (requester_membership_id, salon_id, requested_by_user_id)
        REFERENCES salon_memberships(id, salon_id, user_id) ON DELETE RESTRICT,
      CONSTRAINT time_off_requests_dates_check
        CHECK (isfinite(start_date) AND isfinite(end_date) AND start_date <= end_date),
      CONSTRAINT time_off_requests_type_check
        CHECK (type IN ('vacation', 'sick', 'training', 'personal', 'other')),
      CONSTRAINT time_off_requests_status_check
        CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
      CONSTRAINT time_off_requests_created_time_check
        CHECK (isfinite(created_at)),
      CONSTRAINT time_off_requests_decision_role_check
        CHECK (decision_actor_role IS NULL OR decision_actor_role IN ('owner', 'admin')),
      CONSTRAINT time_off_requests_other_reviewer_check
        CHECK (decided_by_user_id IS NULL OR decided_by_user_id <> requested_by_user_id),
      CONSTRAINT time_off_requests_lifecycle_check
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

    CREATE UNIQUE INDEX time_off_requests_pending_range_unique
      ON employee_time_off_requests (salon_id, employee_id, start_date, end_date)
      WHERE status = 'pending';

    CREATE INDEX time_off_requests_salon_status_id_idx
      ON employee_time_off_requests (salon_id, status, id DESC);

    CREATE INDEX time_off_requests_employee_id_idx
      ON employee_time_off_requests (salon_id, employee_id, id DESC);
  `)
}

export const down = (pgm) => {
  pgm.sql(`
    DROP TABLE employee_time_off_requests;
    ALTER TABLE salon_memberships
      DROP CONSTRAINT salon_memberships_id_salon_user_unique;
  `)
}
