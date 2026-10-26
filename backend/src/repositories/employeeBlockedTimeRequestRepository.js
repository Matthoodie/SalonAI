// All operations use the caller's transaction. Lock order:
// salon -> memberships (id order) -> users (id order) -> employee -> request.
// NO KEY UPDATE on the salon also allows booking FK KEY SHARE checks.
export async function lockBlockedTimeSalon(db, salonId) {
  const result = await db.query(`
    SELECT id, active FROM salons WHERE id = $1 FOR NO KEY UPDATE
  `, [salonId])
  return result.rows[0] ?? null
}

export async function readBlockedTimeRequest(db, salonId, requestId, lock = false) {
  const result = await db.query(`
    SELECT *
    FROM employee_blocked_time_requests
    WHERE salon_id = $1 AND id = $2
    ${lock ? 'FOR UPDATE' : ''}
  `, [salonId, requestId])
  return result.rows[0] ?? null
}

export async function lockBlockedTimeIdentities(db, salonId, actorUserId, requesterMembershipId = null) {
  const members = await db.query(`
    SELECT id, salon_id, user_id, employee_id, role, active
    FROM salon_memberships
    WHERE salon_id = $1 AND (user_id = $2 OR id = $3)
    ORDER BY id FOR SHARE
  `, [salonId, actorUserId, requesterMembershipId])
  const userIds = [...new Set([actorUserId, ...members.rows.map(row => row.user_id)])]
  const users = await db.query(`
    SELECT id, active FROM users WHERE id = ANY($1::bigint[])
    ORDER BY id FOR SHARE
  `, [userIds])
  return { members: members.rows, users: users.rows }
}

export async function lockBlockedTimeEmployee(db, salonId, employeeId) {
  const result = await db.query(`
    SELECT id, salon_id, active FROM employees
    WHERE salon_id = $1 AND id = $2 FOR UPDATE
  `, [salonId, employeeId])
  return result.rows[0] ?? null
}

export async function insertBlockedTimeRequest(db, data) {
  const result = await db.query(`
    INSERT INTO employee_blocked_time_requests (
      salon_id, employee_id, requester_membership_id, requested_by_user_id,
      starts_at, ends_at, type, note
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `, [data.salonId, data.employeeId, data.membershipId, data.actorUserId,
    data.startsAt, data.endsAt, data.type, data.note])
  return result.rows[0]
}

export async function hasOverlappingBlockedTime(db, employeeId, startsAt, endsAt) {
  const result = await db.query(`
    SELECT id FROM employee_blocked_times
    WHERE employee_id = $1 AND starts_at < $3::timestamptz AND ends_at > $2::timestamptz
    LIMIT 1
  `, [employeeId, startsAt, endsAt])
  return result.rows.length > 0
}

export async function decideBlockedTimeRequest(db, data) {
  const result = await db.query(`
    UPDATE employee_blocked_time_requests
    SET status = $3, decided_at = clock_timestamp(), decided_by_user_id = $4,
        decision_actor_role = $5, decision_note = $6
    WHERE salon_id = $1 AND id = $2 AND status = 'pending'
    RETURNING *
  `, [data.salonId, data.requestId, data.decision, data.actorUserId, data.role, data.note])
  return result.rows[0] ?? null
}

export async function insertApprovedBlockedTime(db, request) {
  const result = await db.query(`
    INSERT INTO employee_blocked_times (
      employee_id, starts_at, ends_at, type, reason, source_request_id
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [request.employee_id, request.starts_at, request.ends_at,
    request.type, request.note, request.id])
  return result.rows[0]
}

export async function withdrawBlockedTimeRequest(db, salonId, requestId) {
  const result = await db.query(`
    UPDATE employee_blocked_time_requests
    SET status = 'withdrawn', withdrawn_at = clock_timestamp()
    WHERE salon_id = $1 AND id = $2 AND status = 'pending'
    RETURNING *
  `, [salonId, requestId])
  return result.rows[0] ?? null
}

// Explicit response projection: do not expose future internal columns by default.
const REQUEST_VIEW_COLUMNS = `
  r.id, r.salon_id, r.employee_id, e.name AS employee_name,
  r.requester_membership_id, r.requested_by_user_id,
  r.starts_at, r.ends_at,
  r.type, r.note, r.status, r.created_at, r.decided_at,
  r.decided_by_user_id, r.decision_actor_role, r.decision_note, r.withdrawn_at,
  r.cancelled_at, r.cancelled_by_user_id, r.cancellation_actor_role, r.cancellation_note
`

export async function findBlockedTimeRequestPage(db, {
  salonId, requesterMembershipId, actorUserId, status, beforeId,
}) {
  const result = await db.query(`
    SELECT ${REQUEST_VIEW_COLUMNS}
    FROM employee_blocked_time_requests r
    JOIN employees e ON e.id = r.employee_id AND e.salon_id = r.salon_id
    WHERE r.salon_id = $1
      AND ($2::bigint IS NULL OR (
        r.requester_membership_id = $2 AND r.requested_by_user_id = $3
      ))
      AND ($4::varchar IS NULL OR r.status = $4)
      AND ($5::bigint IS NULL OR r.id < $5)
    ORDER BY r.id DESC
    LIMIT 51
  `, [salonId, requesterMembershipId, actorUserId, status, beforeId])
  return result.rows
}

export async function findVisibleBlockedTimeRequest(db, {
  salonId, requestId, requesterMembershipId, actorUserId,
}) {
  const result = await db.query(`
    SELECT ${REQUEST_VIEW_COLUMNS}
    FROM employee_blocked_time_requests r
    JOIN employees e ON e.id = r.employee_id AND e.salon_id = r.salon_id
    WHERE r.salon_id = $1 AND r.id = $2
      AND ($3::bigint IS NULL OR (
        r.requester_membership_id = $3 AND r.requested_by_user_id = $4
      ))
  `, [salonId, requestId, requesterMembershipId, actorUserId])
  return result.rows[0] ?? null
}

export async function deleteRequestBlockedTime(db, salonId, request) {
  const result = await db.query(`
    DELETE FROM employee_blocked_times t
    USING employees e
    WHERE t.employee_id = e.id AND e.salon_id = $1
      AND t.source_request_id = $2 AND t.employee_id = $3
    RETURNING t.id
  `, [salonId, request.id, request.employee_id])
  return result.rowCount
}

export async function cancelApprovedBlockedTimeRequest(db, data) {
  const result = await db.query(`
    UPDATE employee_blocked_time_requests
    SET status = 'cancelled', cancelled_at = clock_timestamp(),
        cancelled_by_user_id = $3, cancellation_actor_role = $4, cancellation_note = $5
    WHERE salon_id = $1 AND id = $2 AND status = 'approved'
    RETURNING *
  `, [data.salonId, data.requestId, data.actorUserId, data.role, data.note])
  return result.rows[0] ?? null
}

export async function hasBlockedTimeAbsenceConflict(db, salonId, employeeId, startsAt, endsAt) {
  const result = await db.query(`
    SELECT t.id FROM employee_time_off t
    JOIN employees e ON e.id = t.employee_id
    JOIN salons s ON s.id = e.salon_id
    WHERE e.salon_id = $1 AND e.id = $2
      AND $3::timestamptz < ((t.end_date + 1)::timestamp AT TIME ZONE s.timezone)
      AND $4::timestamptz > (t.start_date::timestamp AT TIME ZONE s.timezone)
    LIMIT 1
  `, [salonId, employeeId, startsAt, endsAt])
  return result.rows.length > 0
}
