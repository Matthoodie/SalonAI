import {
  listEmployeeBlockedTimeRequests,
  getEmployeeBlockedTimeRequest,
  submitEmployeeBlockedTimeRequest,
  withdrawEmployeeBlockedTimeRequest,
  decideEmployeeBlockedTimeRequest,
  cancelEmployeeBlockedTimeRequest,
} from '../services/employeeBlockedTimeRequestService.js'

function fail(message, code, statusCode) {
  return Object.assign(new Error(message), { code, statusCode })
}

function context(req) {
  const actorUserId = req.currentUser?.id
  const salonId = req.currentSalon?.id
  const validId = value => ['number', 'string'].includes(typeof value) &&
    /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value))
  if (!validId(actorUserId)) {
    throw fail('Authentication is required.', 'BLOCKED_TIME_AUTH_REQUIRED', 401)
  }
  if (!validId(salonId) || !req.currentMembership) {
    throw fail('An authenticated salon context is required.', 'BLOCKED_TIME_SALON_CONTEXT_REQUIRED', 403)
  }
  // The service re-reads membership and permissions; middleware role is not
  // sufficient authority. No body/query identity can override this context.
  return { salonId: Number(salonId), actorUserId: Number(actorUserId) }
}

function fields(value, allowed, allowMissing = false) {
  if (value === undefined && allowMissing) return {}
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !allowed.includes(key))) {
    throw fail('The request contains unsupported fields.', 'BLOCKED_TIME_INVALID_INPUT', 400)
  }
  return value
}

function endpoint(operation) {
  return async (req, res, next) => {
    res.set('Cache-Control', 'no-store')
    try { await operation(req, res, context(req)) } catch (error) { next(error) }
  }
}

export const listBlockedTimeRequests = endpoint(async (req, res, actor) => {
  const query = fields(req.query, ['status', 'before_id'])
  const result = await listEmployeeBlockedTimeRequests({
    ...actor, status: query.status, beforeId: query.before_id,
  })
  res.status(200).json({
    data: result.requests,
    meta: { scope: result.scope, next_before_id: result.nextBeforeId },
  })
})

export const getBlockedTimeRequest = endpoint(async (req, res, actor) => {
  fields(req.query, [])
  const result = await getEmployeeBlockedTimeRequest({ ...actor, requestId: req.params.id })
  res.status(200).json({ data: result.request })
})

export const createBlockedTimeRequest = endpoint(async (req, res, actor) => {
  fields(req.query, [])
  const body = fields(req.body, ['starts_at', 'ends_at', 'type', 'note'])
  const result = await submitEmployeeBlockedTimeRequest({
    ...actor, startsAt: body.starts_at, endsAt: body.ends_at,
    type: body.type, note: body.note,
  })
  res.status(201).json({ data: result.request })
})

export const withdrawBlockedTimeRequest = endpoint(async (req, res, actor) => {
  fields(req.query, [])
  fields(req.body, [], true)
  const result = await withdrawEmployeeBlockedTimeRequest({ ...actor, requestId: req.params.id })
  res.status(200).json({ data: result.request })
})

export const decideBlockedTimeRequest = endpoint(async (req, res, actor) => {
  fields(req.query, [])
  const body = fields(req.body, ['decision', 'decision_note'])
  const result = await decideEmployeeBlockedTimeRequest({
    ...actor, requestId: req.params.id,
    decision: body.decision, decisionNote: body.decision_note,
  })
  res.status(200).json({ data: { request: result.request, blocked_time: result.blockedTime } })
})

export const cancelBlockedTimeRequest = endpoint(async (req, res, actor) => {
  fields(req.query, [])
  const body = fields(req.body, ['cancellation_note'])
  const result = await cancelEmployeeBlockedTimeRequest({
    ...actor, requestId: req.params.id, cancellationNote: body.cancellation_note,
  })
  res.status(200).json({ data: result.request })
})
