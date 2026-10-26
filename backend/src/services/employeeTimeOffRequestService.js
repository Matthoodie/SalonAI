import { withAppointmentTransaction } from './appointmentTransaction.js'
import { resolveSalonPermission } from './salonPermissionService.js'
import { SALON_PERMISSION_KEYS } from '../permissions/salonPermissions.js'
import { assertEmployeeTimeOffAvailable } from './employeeTimeOffConflictService.js'
import {
  lockTimeOffSalon, readTimeOffRequest, lockTimeOffIdentities,
  lockTimeOffEmployee, insertTimeOffRequest, hasOverlappingTimeOff,
  decideTimeOffRequest, insertApprovedTimeOff, withdrawTimeOffRequest,
} from '../repositories/employeeTimeOffRequestRepository.js'

function fail(message, code, statusCode = 403) {
  return Object.assign(new Error(message), { code, statusCode })
}

function id(value) {
  if (!['string', 'number'].includes(typeof value) ||
      !/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    throw fail('A positive identifier is required.', 'TIME_OFF_INVALID_INPUT', 400)
  }
  return Number(value)
}

function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01') {
    throw fail('A valid YYYY-MM-DD date is required.', 'TIME_OFF_INVALID_INPUT', 400)
  }
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw fail('A valid YYYY-MM-DD date is required.', 'TIME_OFF_INVALID_INPUT', 400)
  }
  return value
}

function note(value) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || value.includes('\0') || [...value].length > 500) {
    throw fail('The note must contain at most 500 characters.', 'TIME_OFF_INVALID_INPUT', 400)
  }
  return value.trim() || null
}

const same = (a, b) => String(a) === String(b)
const activeUser = (identities, userId) =>
  identities.users.some(user => same(user.id, userId) && user.active === true)

async function context(db, salonId, actorUserId, request = null) {
  const identities = await lockTimeOffIdentities(db, salonId, actorUserId, request?.requester_membership_id)
  const actor = identities.members.find(member => same(member.user_id, actorUserId))
  if (!actor || actor.active !== true || !activeUser(identities, actorUserId) ||
      !['owner', 'admin', 'employee'].includes(actor.role)) {
    throw fail('Your current membership cannot perform this action.', 'TIME_OFF_ACTOR_FORBIDDEN')
  }
  return { actor, identities }
}

async function beginSalon(db, salonId) {
  const salon = await lockTimeOffSalon(db, salonId)
  if (salon?.active !== true) {
    throw fail('The salon is unavailable.', 'TIME_OFF_SALON_UNAVAILABLE')
  }
}

async function permission(db, salonId, actor) {
  return resolveSalonPermission({
    salonId, role: actor.role, membershipId: actor.id,
    permissionKey: SALON_PERMISSION_KEYS.SCHEDULE_TIME_OFF,
  }, db)
}

function pending(request) {
  if (!request || request.status !== 'pending') {
    throw fail('The request has already been resolved.', 'TIME_OFF_REQUEST_NOT_PENDING', 409)
  }
}

// Trusted caller supplies salonId/actorUserId from authenticated server context.
// No employeeId, role or status supplied by the client is used as authority.
export async function submitEmployeeTimeOffRequest({
  salonId, actorUserId, startDate, endDate, type, note: suppliedNote,
}) {
  const salon = id(salonId)
  const actorId = id(actorUserId)
  const start = date(startDate)
  const end = date(endDate)
  const requestNote = note(suppliedNote)
  if (start > end || !['vacation', 'sick', 'training', 'personal', 'other'].includes(type)) {
    throw fail('The date range or absence type is invalid.', 'TIME_OFF_INVALID_INPUT', 400)
  }
  try {
    return await withAppointmentTransaction(async db => {
      await beginSalon(db, salon)
      const { actor } = await context(db, salon, actorId)
      const access = await permission(db, salon, actor)
      if (!['approval', 'direct'].includes(access)) {
        throw fail('Your permissions do not allow absence requests.', 'SALON_PERMISSION_DENIED')
      }
      if (actor.employee_id === null) {
        throw fail('A linked employee profile is required.', 'TIME_OFF_EMPLOYEE_REQUIRED', 409)
      }
      const employee = await lockTimeOffEmployee(db, salon, actor.employee_id)
      if (employee?.active !== true) {
        throw fail('The employee profile is unavailable.', 'TIME_OFF_EMPLOYEE_UNAVAILABLE', 409)
      }
      // Pending requests intentionally do not change or reserve availability.
      const request = await insertTimeOffRequest(db, {
        salonId: salon, actorUserId: actorId, employeeId: employee.id,
        membershipId: actor.id, startDate: start, endDate: end, type, note: requestNote,
      })
      return { request }
    })
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'time_off_requests_pending_range_unique') {
      throw fail('A pending request already exists for these dates.', 'TIME_OFF_REQUEST_DUPLICATE', 409)
    }
    throw error
  }
}

export async function withdrawEmployeeTimeOffRequest({ salonId, actorUserId, requestId }) {
  const salon = id(salonId)
  const actorId = id(actorUserId)
  const requestKey = id(requestId)
  return withAppointmentTransaction(async db => {
    await beginSalon(db, salon)
    const { actor } = await context(db, salon, actorId)
    const request = await readTimeOffRequest(db, salon, requestKey)
    if (!request || !same(request.requested_by_user_id, actorId) ||
        !same(request.requester_membership_id, actor.id)) {
      throw fail('The request was not found.', 'TIME_OFF_REQUEST_NOT_FOUND', 404)
    }
    // Revoked submission permission does not prevent withdrawing one's request.
    await lockTimeOffEmployee(db, salon, request.employee_id)
    pending(await readTimeOffRequest(db, salon, requestKey, true))
    const updated = await withdrawTimeOffRequest(db, salon, requestKey)
    if (!updated) throw fail('The request has already been resolved.', 'TIME_OFF_REQUEST_NOT_PENDING', 409)
    return { request: updated }
  })
}

export async function decideEmployeeTimeOffRequest({
  salonId, actorUserId, requestId, decision, decisionNote,
}) {
  const salon = id(salonId)
  const actorId = id(actorUserId)
  const requestKey = id(requestId)
  const reviewNote = note(decisionNote)
  if (!['approved', 'rejected'].includes(decision)) {
    throw fail('The decision must be approved or rejected.', 'TIME_OFF_INVALID_INPUT', 400)
  }
  return withAppointmentTransaction(async db => {
    await beginSalon(db, salon)
    const initial = await readTimeOffRequest(db, salon, requestKey)
    const { actor, identities } = await context(db, salon, actorId, initial)
    if (!['owner', 'admin'].includes(actor.role) || await permission(db, salon, actor) !== 'direct') {
      throw fail('Your permissions do not allow reviewing requests.', 'TIME_OFF_REVIEW_FORBIDDEN')
    }
    if (!initial) {
      throw fail('The request was not found.', 'TIME_OFF_REQUEST_NOT_FOUND', 404)
    }
    if (same(initial.requested_by_user_id, actorId) || same(initial.employee_id, actor.employee_id)) {
      throw fail('You cannot review your own request.', 'TIME_OFF_SELF_REVIEW_FORBIDDEN')
    }
    const employee = await lockTimeOffEmployee(db, salon, initial.employee_id)
    const request = await readTimeOffRequest(db, salon, requestKey, true)
    pending(request)
    if (decision === 'approved') {
      const requester = identities.members.find(member => same(member.id, request.requester_membership_id))
      if (!requester || requester.active !== true ||
          !same(requester.user_id, request.requested_by_user_id) ||
          !same(requester.employee_id, request.employee_id) ||
          !activeUser(identities, request.requested_by_user_id) || employee?.active !== true) {
        throw fail('The requester or employee profile is no longer active or linked.', 'TIME_OFF_REQUESTER_UNAVAILABLE', 409)
      }
      if (await hasOverlappingTimeOff(db, employee.id, request.start_date, request.end_date)) {
        throw fail('The dates overlap an existing absence.', 'TIME_OFF_EXISTING_ABSENCE_CONFLICT', 409)
      }
      await assertEmployeeTimeOffAvailable(db, {
        salonId: salon, employeeId: employee.id, timeOff: [request],
      })
    }
    const updated = await decideTimeOffRequest(db, {
      salonId: salon, requestId: requestKey, decision, actorUserId: actorId,
      role: actor.role, note: reviewNote,
    })
    if (!updated) throw fail('The request has already been resolved.', 'TIME_OFF_REQUEST_NOT_PENDING', 409)
    const timeOff = decision === 'approved' ? await insertApprovedTimeOff(db, updated) : null
    return { request: updated, timeOff }
  })
}
