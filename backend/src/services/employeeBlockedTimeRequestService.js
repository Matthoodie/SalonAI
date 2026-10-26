import { isValidUtcDateTime } from '../utils/dateTime.js'
import { withAppointmentTransaction } from './appointmentTransaction.js'
import { resolveSalonPermission } from './salonPermissionService.js'
import { SALON_PERMISSION_KEYS } from '../permissions/salonPermissions.js'
import { assertEmployeeBlockedTimesAvailable } from './employeeBlockedTimeConflictService.js'
import {
  lockBlockedTimeSalon, readBlockedTimeRequest, lockBlockedTimeIdentities,
  lockBlockedTimeEmployee, insertBlockedTimeRequest, hasOverlappingBlockedTime,
  decideBlockedTimeRequest, insertApprovedBlockedTime, withdrawBlockedTimeRequest,
  findBlockedTimeRequestPage, findVisibleBlockedTimeRequest,
  deleteRequestBlockedTime, cancelApprovedBlockedTimeRequest, hasBlockedTimeAbsenceConflict,
} from '../repositories/employeeBlockedTimeRequestRepository.js'

function fail(message, code, statusCode = 403) {
  return Object.assign(new Error(message), { code, statusCode })
}

function id(value) {
  if (!['string', 'number'].includes(typeof value) ||
      !/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    throw fail('A positive identifier is required.', 'BLOCKED_TIME_INVALID_INPUT', 400)
  }
  return Number(value)
}

function instant(value) {
  if (!isValidUtcDateTime(value)) {
    throw fail('A valid UTC ISO timestamp is required.', 'BLOCKED_TIME_INVALID_INPUT', 400)
  }
  return new Date(value).toISOString()
}

function note(value, limit = 500) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || value.includes('\0') || [...value].length > limit) {
    throw fail(`The note must contain at most ${limit} characters.`, 'BLOCKED_TIME_INVALID_INPUT', 400)
  }
  return value.trim() || null
}

const same = (a, b) => String(a) === String(b)
const activeUser = (identities, userId) =>
  identities.users.some(user => same(user.id, userId) && user.active === true)

async function context(db, salonId, actorUserId, request = null) {
  const identities = await lockBlockedTimeIdentities(db, salonId, actorUserId, request?.requester_membership_id)
  const actor = identities.members.find(member => same(member.user_id, actorUserId))
  if (!actor || actor.active !== true || !activeUser(identities, actorUserId) ||
      !['owner', 'admin', 'employee'].includes(actor.role)) {
    throw fail('Your current membership cannot perform this action.', 'BLOCKED_TIME_ACTOR_FORBIDDEN')
  }
  return { actor, identities }
}

async function beginSalon(db, salonId) {
  const salon = await lockBlockedTimeSalon(db, salonId)
  if (salon?.active !== true) {
    throw fail('The salon is unavailable.', 'BLOCKED_TIME_SALON_UNAVAILABLE')
  }
}

async function permission(db, salonId, actor) {
  return resolveSalonPermission({
    salonId, role: actor.role, membershipId: actor.id,
    permissionKey: SALON_PERMISSION_KEYS.SCHEDULE_BLOCKED_TIME,
  }, db)
}

function pending(request) {
  if (!request || request.status !== 'pending') {
    throw fail('The request has already been resolved.', 'BLOCKED_TIME_REQUEST_NOT_PENDING', 409)
  }
}

// Trusted caller supplies salonId/actorUserId from authenticated server context.
// No employeeId, role or status supplied by the client is used as authority.
export async function submitEmployeeBlockedTimeRequest({
  salonId, actorUserId, startsAt, endsAt, type, note: suppliedNote,
}) {
  const salon = id(salonId)
  const actorId = id(actorUserId)
  const start = instant(startsAt)
  const end = instant(endsAt)
  const requestNote = note(suppliedNote, 250)
  if (start >= end || !['BREAK', 'PRIVATE', 'MEETING', 'TRAINING', 'OTHER'].includes(type)) {
    throw fail('The date range or absence type is invalid.', 'BLOCKED_TIME_INVALID_INPUT', 400)
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
        throw fail('A linked employee profile is required.', 'BLOCKED_TIME_EMPLOYEE_REQUIRED', 409)
      }
      const employee = await lockBlockedTimeEmployee(db, salon, actor.employee_id)
      if (employee?.active !== true) {
        throw fail('The employee profile is unavailable.', 'BLOCKED_TIME_EMPLOYEE_UNAVAILABLE', 409)
      }
      // Pending requests intentionally do not change or reserve availability.
      const request = await insertBlockedTimeRequest(db, {
        salonId: salon, actorUserId: actorId, employeeId: employee.id,
        membershipId: actor.id, startsAt: start, endsAt: end, type, note: requestNote,
      })
      return { request }
    })
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'blocked_time_requests_pending_range_unique') {
      throw fail('A pending request already exists for these dates.', 'BLOCKED_TIME_REQUEST_DUPLICATE', 409)
    }
    throw error
  }
}

export async function withdrawEmployeeBlockedTimeRequest({ salonId, actorUserId, requestId }) {
  const salon = id(salonId)
  const actorId = id(actorUserId)
  const requestKey = id(requestId)
  return withAppointmentTransaction(async db => {
    await beginSalon(db, salon)
    const { actor } = await context(db, salon, actorId)
    const request = await readBlockedTimeRequest(db, salon, requestKey)
    if (!request || !same(request.requested_by_user_id, actorId) ||
        !same(request.requester_membership_id, actor.id)) {
      throw fail('The request was not found.', 'BLOCKED_TIME_REQUEST_NOT_FOUND', 404)
    }
    // Revoked submission permission does not prevent withdrawing one's request.
    await lockBlockedTimeEmployee(db, salon, request.employee_id)
    pending(await readBlockedTimeRequest(db, salon, requestKey, true))
    const updated = await withdrawBlockedTimeRequest(db, salon, requestKey)
    if (!updated) throw fail('The request has already been resolved.', 'BLOCKED_TIME_REQUEST_NOT_PENDING', 409)
    return { request: updated }
  })
}

export async function decideEmployeeBlockedTimeRequest({
  salonId, actorUserId, requestId, decision, decisionNote,
}) {
  const salon = id(salonId)
  const actorId = id(actorUserId)
  const requestKey = id(requestId)
  const reviewNote = note(decisionNote)
  if (!['approved', 'rejected'].includes(decision)) {
    throw fail('The decision must be approved or rejected.', 'BLOCKED_TIME_INVALID_INPUT', 400)
  }
  return withAppointmentTransaction(async db => {
    await beginSalon(db, salon)
    const initial = await readBlockedTimeRequest(db, salon, requestKey)
    const { actor, identities } = await context(db, salon, actorId, initial)
    if (!['owner', 'admin'].includes(actor.role) || await permission(db, salon, actor) !== 'direct') {
      throw fail('Your permissions do not allow reviewing requests.', 'BLOCKED_TIME_REVIEW_FORBIDDEN')
    }
    if (!initial) {
      throw fail('The request was not found.', 'BLOCKED_TIME_REQUEST_NOT_FOUND', 404)
    }
    if (same(initial.requested_by_user_id, actorId) || same(initial.employee_id, actor.employee_id)) {
      throw fail('You cannot review your own request.', 'BLOCKED_TIME_SELF_REVIEW_FORBIDDEN')
    }
    const employee = await lockBlockedTimeEmployee(db, salon, initial.employee_id)
    const request = await readBlockedTimeRequest(db, salon, requestKey, true)
    pending(request)
    if (decision === 'approved') {
      const requester = identities.members.find(member => same(member.id, request.requester_membership_id))
      if (!requester || requester.active !== true ||
          !same(requester.user_id, request.requested_by_user_id) ||
          !same(requester.employee_id, request.employee_id) ||
          !activeUser(identities, request.requested_by_user_id) || employee?.active !== true) {
        throw fail('The requester or employee profile is no longer active or linked.', 'BLOCKED_TIME_REQUESTER_UNAVAILABLE', 409)
      }
      if (await hasOverlappingBlockedTime(db, employee.id, request.starts_at, request.ends_at)) {
        throw fail('The dates overlap an existing absence.', 'BLOCKED_TIME_EXISTING_ABSENCE_CONFLICT', 409)
      }
      if (await hasBlockedTimeAbsenceConflict(db, salon, employee.id, request.starts_at, request.ends_at)) {
        throw fail('The interval overlaps an absence.', 'BLOCKED_TIME_ABSENCE_CONFLICT', 409)
      }
      await assertEmployeeBlockedTimesAvailable(db, {
        salonId: salon, employeeId: employee.id, blockedTimes: [request],
      })
    }
    const updated = await decideBlockedTimeRequest(db, {
      salonId: salon, requestId: requestKey, decision, actorUserId: actorId,
      role: actor.role, note: reviewNote,
    })
    if (!updated) throw fail('The request has already been resolved.', 'BLOCKED_TIME_REQUEST_NOT_PENDING', 409)
    const blockedTime = decision === 'approved' ? await insertApprovedBlockedTime(db, updated) : null
    return { request: updated, blockedTime }
  })
}

async function readScope(db, salonId, actorUserId) {
  await beginSalon(db, salonId)
  const { actor } = await context(db, salonId, actorUserId)
  const canReview = ['owner', 'admin'].includes(actor.role) &&
    await permission(db, salonId, actor) === 'direct'
  // Reading one's submitted history remains possible after permission denial,
  // profile deactivation or a changed employee link. Membership must be active.
  return {
    requesterMembershipId: canReview ? null : actor.id,
    scope: canReview ? 'salon' : 'self',
  }
}

export async function listEmployeeBlockedTimeRequests({
  salonId, actorUserId, status, beforeId,
}) {
  const salon = id(salonId)
  const actorId = id(actorUserId)
  if (status !== undefined && !['pending', 'approved', 'rejected', 'withdrawn', 'cancelled'].includes(status)) {
    throw fail('The request status filter is invalid.', 'BLOCKED_TIME_INVALID_INPUT', 400)
  }
  const cursor = beforeId === undefined ? null : id(beforeId)
  return withAppointmentTransaction(async db => {
    const scope = await readScope(db, salon, actorId)
    const rows = await findBlockedTimeRequestPage(db, {
      salonId: salon, actorUserId: actorId,
      requesterMembershipId: scope.requesterMembershipId,
      status: status ?? null, beforeId: cursor,
    })
    const requests = rows.slice(0, 50)
    return {
      requests,
      scope: scope.scope,
      nextBeforeId: rows.length > 50 ? requests[requests.length - 1].id : null,
    }
  })
}

export async function getEmployeeBlockedTimeRequest({ salonId, actorUserId, requestId }) {
  const salon = id(salonId)
  const actorId = id(actorUserId)
  const requestKey = id(requestId)
  return withAppointmentTransaction(async db => {
    const scope = await readScope(db, salon, actorId)
    const request = await findVisibleBlockedTimeRequest(db, {
      salonId: salon, actorUserId: actorId, requestId: requestKey,
      requesterMembershipId: scope.requesterMembershipId,
    })
    if (!request) throw fail('The request was not found.', 'BLOCKED_TIME_REQUEST_NOT_FOUND', 404)
    return { request }
  })
}

export async function cancelEmployeeBlockedTimeRequest({
  salonId, actorUserId, requestId, cancellationNote,
}) {
  const salon = id(salonId)
  const actorId = id(actorUserId)
  const requestKey = id(requestId)
  const reason = note(cancellationNote)
  if (!reason) {
    throw fail('A cancellation reason is required.', 'BLOCKED_TIME_CANCELLATION_NOTE_REQUIRED', 400)
  }
  return withAppointmentTransaction(async db => {
    await beginSalon(db, salon)
    const initial = await readBlockedTimeRequest(db, salon, requestKey)
    const { actor } = await context(db, salon, actorId, initial)
    if (!['owner', 'admin'].includes(actor.role) || await permission(db, salon, actor) !== 'direct') {
      throw fail('Your permissions do not allow cancelling approved requests.', 'BLOCKED_TIME_CANCEL_FORBIDDEN')
    }
    if (!initial) {
      throw fail('The request was not found.', 'BLOCKED_TIME_REQUEST_NOT_FOUND', 404)
    }
    if (same(initial.requested_by_user_id, actorId) || same(initial.employee_id, actor.employee_id)) {
      throw fail('You cannot cancel your own approved request.', 'BLOCKED_TIME_SELF_CANCEL_FORBIDDEN')
    }
    // Inactive or unlinked requesters must not prevent authorised schedule cleanup.
    // Use the same employee lock as approvals and appointment creation.
    await lockBlockedTimeEmployee(db, salon, initial.employee_id)
    const request = await readBlockedTimeRequest(db, salon, requestKey, true)
    if (!request || request.status !== 'approved') {
      throw fail('Only an approved request can be cancelled.', 'BLOCKED_TIME_REQUEST_NOT_APPROVED', 409)
    }
    // The source FK references status=approved; delete its child BEFORE changing
    // the status. Both writes roll back together on every failure.
    if (await deleteRequestBlockedTime(db, salon, request) !== 1) {
      throw fail('The linked absence is missing or inconsistent.', 'BLOCKED_TIME_SOURCE_INCONSISTENT', 409)
    }
    const updated = await cancelApprovedBlockedTimeRequest(db, {
      salonId: salon, requestId: requestKey, actorUserId: actorId, role: actor.role, note: reason,
    })
    if (!updated) throw fail('Only an approved request can be cancelled.', 'BLOCKED_TIME_REQUEST_NOT_APPROVED', 409)
    return { request: updated }
  })
}
