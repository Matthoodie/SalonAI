// Transport only: no database access, scheduling or automatic retries.
// Caller owns durable idempotency keys, frozen payloads and retry deadlines.
const FROM = 'ZRIHTAN <notifications@notify.zrihtan.com>'
const email = value => typeof value === 'string' && value.length <= 254 && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(value)
const validText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max

export function createSupportResendTransport({ enabled = false, apiKey, allowedRecipients = [], fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  if (typeof enabled !== 'boolean') throw new Error('Invalid delivery configuration.')
  if (!enabled) return async () => ({ outcome: 'disabled' })
  if (typeof apiKey !== 'string' || !/^re_[A-Za-z0-9_-]+$/.test(apiKey) ||
      !Array.isArray(allowedRecipients) || allowedRecipients.length !== 1 || !email(allowedRecipients[0]) ||
      typeof fetchImpl !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) {
    throw new Error('Invalid delivery configuration.')
  }
  const recipient = allowedRecipients[0]
  return async function send({ to, subject, text, idempotencyKey } = {}) {
    if (!email(to) || to !== recipient) return { outcome: 'blocked', reason: 'recipient_not_allowed' }
    if (!validText(subject, 200) || /[\r\n]/.test(subject) || !validText(text, 10000) ||
        typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9_/-]{16,200}$/.test(idempotencyKey)) {
      return { outcome: 'blocked', reason: 'invalid_payload' }
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ from: FROM, to: [to], subject, text }),
      })
      if (response.status >= 200 && response.status < 300) {
        const data = await response.json()
        if (typeof data?.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(data.id)) return { outcome: 'unknown' }
        return { outcome: 'accepted', providerId: data.id }
      }
      // No provider response body is exposed: it may contain sensitive data.
      if (response.status === 429) return { outcome: 'rate_limited', status: 429 }
      if (response.status >= 400 && response.status < 500 && ![408,409].includes(response.status)) {
        return { outcome: 'rejected', status: response.status }
      }
      return { outcome: 'unknown', status: response.status }
    } catch {
      // Timeout/network/invalid success response do not prove non-delivery.
      return { outcome: 'unknown' }
    } finally { clearTimeout(timer) }
  }
}
