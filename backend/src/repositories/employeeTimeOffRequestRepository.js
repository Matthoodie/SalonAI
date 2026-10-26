// All operations use the caller's transaction. Lock order:
// salon -> memberships (id order) -> users (id order) -> employee -> request.
// NO KEY UPDATE on the salon also allows booking FK KEY SHARE checks.
export async function lockTimeOffSalon(db, salonId) {
  const result = await db.query(`
    SELECT id, active FROM salons WHERE id = $1 FOR NO KEY UPDATE
  `, [salonId])
  return result.rows[0] ?? null
}

export async function readTimeOffRequest(db, salonId, requestId, lock = false) {
  const result = await db.query(`
    SELECT *, start_date::text AS start_date, end_date::text AS end_date
    FROM employee_time_off_requests
    WHERE salon_id = $1 AND id = $2
    ${lock ? 'FOR UPDATE' : ''}
  `, [salonId, requestId])
  return result.rows[0] ?? null
}

export async function lockTimeOffIdentities(db, salonId, actorUserId, requesterMembershipId = null) {
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

export async function lockTimeOffEmployee(db, salonId, employeeId) {
  const result = await db.query(`
    SELECT id, salon_id, active FROM employees
    WHERE salon_id = $1 AND id = $2 FOR UPDATE
  `, [salonId, employeeId])
  return result.rows[0] ?? null
}

export async function insertTimeOffRequest(db, data) {
  const result = await db.query(`
    INSERT INTO employee_time_off_requests (
      salon_id, employee_id, requester_membership_id, requested_by_user_id,
      start_date, end_date, type, note
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *, start_date::text AS start_date, end_date::text AS end_date
  `, [data.salonId, data.employeeId, data.membershipId, data.actorUserId,
    data.startDate, data.endDate, data.type, data.note])
  return result.rows[0]
}

export async function hasOverlappingTimeOff(db, employeeId, startDate, endDate) {
  const result = await db.query(`
    SELECT id FROM employee_time_off
    WHERE employee_id = $1 AND start_date <= $3::date AND end_date >= $2::date
    LIMIT 1
  `, [employeeId, startDate, endDate])
  return result.rows.length > 0
}

export async function decideTimeOffRequest(db, data) {
  const result = await db.query(`
    UPDATE employee_time_off_requests
    SET status = $3, decided_at = clock_timestamp(), decided_by_user_id = $4,
        decision_actor_role = $5, decision_note = $6
    WHERE salon_id = $1 AND id = $2 AND status = 'pending'
    RETURNING *, start_date::text AS start_date, end_date::text AS end_date
  `, [data.salonId, data.requestId, data.decision, data.actorUserId, data.role, data.note])
  return result.rows[0] ?? null
}

export async function insertApprovedTimeOff(db, request) {
  const result = await db.query(`
    INSERT INTO employee_time_off (
      employee_id, start_date, end_date, type, note, source_request_id
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *, start_date::text AS start_date, end_date::text AS end_date
  `, [request.employee_id, request.start_date, request.end_date,
    request.type, request.note, request.id])
  return result.rows[0]
}

export async function withdrawTimeOffRequest(db, salonId, requestId) {
  const result = await db.query(`
    UPDATE employee_time_off_requests
    SET status = 'withdrawn', withdrawn_at = clock_timestamp()
    WHERE salon_id = $1 AND id = $2 AND status = 'pending'
    RETURNING *, start_date::text AS start_date, end_date::text AS end_date
  `, [salonId, requestId])
  return result.rows[0] ?? null
}

// Explicit response projection: do not expose future internal columns by default.
const REQUEST_VIEW_COLUMNS = `
  r.id, r.salon_id, r.employee_id, e.name AS employee_name,
  r.requester_membership_id, r.requested_by_user_id,
  r.start_date::text AS start_date, r.end_date::text AS end_date,
  r.type, r.note, r.status, r.created_at, r.decided_at,
  r.decided_by_user_id, r.decision_actor_role, r.decision_note, r.withdrawn_at
`

export async function findTimeOffRequestPage(db, {
  salonId, requesterMembershipId, actorUserId, status, beforeId,
}) {
  const result = await db.query(`
    SELECT ${REQUEST_VIEW_COLUMNS}
    FROM employee_time_off_requests r
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

export async function findVisibleTimeOffRequest(db, {
  salonId, requestId, requesterMembershipId, actorUserId,
}) {
  const result = await db.query(`
    SELECT ${REQUEST_VIEW_COLUMNS}
    FROM employee_time_off_requests r
    JOIN employees e ON e.id = r.employee_id AND e.salon_id = r.salon_id
    WHERE r.salon_id = $1 AND r.id = $2
      AND ($3::bigint IS NULL OR (
        r.requester_membership_id = $3 AND r.requested_by_user_id = $4
      ))
  `, [salonId, requestId, requesterMembershipId, actorUserId])
  return result.rows[0] ?? null
}
