import {
  listEmployeeTimeOffRequests,
  getEmployeeTimeOffRequest,
  submitEmployeeTimeOffRequest,
  withdrawEmployeeTimeOffRequest,
  decideEmployeeTimeOffRequest,
} from '../services/employeeTimeOffRequestService.js'

function fail(message, code, statusCode) {
  return Object.assign(new Error(message), { code, statusCode })
}

function context(req) {
  const actorUserId = req.currentUser?.id
  const salonId = req.currentSalon?.id
  const validId = value => ['number', 'string'].includes(typeof value) &&
    /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value))
  if (!validId(actorUserId)) {
    throw fail('Authentication is required.', 'TIME_OFF_AUTH_REQUIRED', 401)
  }
  if (!validId(salonId) || !req.currentMembership) {
    throw fail('An authenticated salon context is required.', 'TIME_OFF_SALON_CONTEXT_REQUIRED', 403)
  }
  // The service re-reads membership and permissions; middleware role is not
  // sufficient authority. No body/query identity can override this context.
  return { salonId: Number(salonId), actorUserId: Number(actorUserId) }
}

function fields(value, allowed, allowMissing = false) {
  if (value === undefined && allowMissing) return {}
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !allowed.includes(key))) {
    throw fail('The request contains unsupported fields.', 'TIME_OFF_INVALID_INPUT', 400)
  }
  return value
}

function endpoint(operation) {
  return async (req, res, next) => {
    res.set('Cache-Control', 'no-store')
    try { await operation(req, res, context(req)) } catch (error) { next(error) }
  }
}

export const listTimeOffRequests = endpoint(async (req, res, actor) => {
  const query = fields(req.query, ['status', 'before_id'])
  const result = await listEmployeeTimeOffRequests({
    ...actor, status: query.status, beforeId: query.before_id,
  })
  res.status(200).json({
    data: result.requests,
    meta: { scope: result.scope, next_before_id: result.nextBeforeId },
  })
})

export const getTimeOffRequest = endpoint(async (req, res, actor) => {
  fields(req.query, [])
  const result = await getEmployeeTimeOffRequest({ ...actor, requestId: req.params.id })
  res.status(200).json({ data: result.request })
})

export const createTimeOffRequest = endpoint(async (req, res, actor) => {
  fields(req.query, [])
  const body = fields(req.body, ['start_date', 'end_date', 'type', 'note'])
  const result = await submitEmployeeTimeOffRequest({
    ...actor, startDate: body.start_date, endDate: body.end_date,
    type: body.type, note: body.note,
  })
  res.status(201).json({ data: result.request })
})

export const withdrawTimeOffRequest = endpoint(async (req, res, actor) => {
  fields(req.query, [])
  fields(req.body, [], true)
  const result = await withdrawEmployeeTimeOffRequest({ ...actor, requestId: req.params.id })
  res.status(200).json({ data: result.request })
})

export const decideTimeOffRequest = endpoint(async (req, res, actor) => {
  fields(req.query, [])
  const body = fields(req.body, ['decision', 'decision_note'])
  const result = await decideEmployeeTimeOffRequest({
    ...actor, requestId: req.params.id,
    decision: body.decision, decisionNote: body.decision_note,
  })
  res.status(200).json({ data: { request: result.request, time_off: result.timeOff } })
})
