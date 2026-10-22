function normalizeId(value) {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number'
  ) {
    return null
  }

  const id = Number(value)

  return Number.isSafeInteger(id) && id > 0
    ? String(id)
    : null
}

export function createClientSearchRateLimit({
  limit = 30,
  windowMs = 60_000,
  maxEntries = 10_000,
  now = Date.now,
} = {}) {
  for (const value of [limit, windowMs, maxEntries]) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error('Rate limit settings must be positive integers.')
    }
  }

  const buckets = new Map()

  function rejectRequest(res, retryAfterSeconds) {
    res.set('Cache-Control', 'no-store')
    res.set('Retry-After', String(retryAfterSeconds))

    return res.status(429).json({
      error: {
        code: 'CLIENT_SEARCH_RATE_LIMITED',
        message:
          `Previše pretraga klijenata. Pokušajte ponovno za ${retryAfterSeconds} s.`,
      },
    })
  }

  return function clientSearchRateLimit(req, res, next) {
    const userId = normalizeId(req.currentUser?.id)
    const salonId = normalizeId(req.currentSalon?.id)

    if (!userId || !salonId) {
      const error = new Error(
        'Authenticated user and salon context are required for client search.'
      )

      error.code = 'CLIENT_SEARCH_CONTEXT_REQUIRED'
      error.statusCode = 500

      return next(error)
    }

    const currentTime = now()
    const key = `${userId}:${salonId}`

    let bucket = buckets.get(key)

    if (bucket && bucket.resetAt <= currentTime) {
      buckets.delete(key)
      bucket = undefined
    }

    if (!bucket) {
      if (buckets.size >= maxEntries) {
        for (const [storedKey, storedBucket] of buckets) {
          if (storedBucket.resetAt <= currentTime) {
            buckets.delete(storedKey)
          }
        }
      }

      if (buckets.size >= maxEntries) {
        let earliestReset = Infinity

        for (const storedBucket of buckets.values()) {
          earliestReset = Math.min(
            earliestReset,
            storedBucket.resetAt
          )
        }

        return rejectRequest(
          res,
          Math.max(
            1,
            Math.ceil((earliestReset - currentTime) / 1000)
          )
        )
      }

      bucket = {
        count: 0,
        resetAt: currentTime + windowMs,
      }

      buckets.set(key, bucket)
    }

    if (bucket.count >= limit) {
      return rejectRequest(
        res,
        Math.max(
          1,
          Math.ceil((bucket.resetAt - currentTime) / 1000)
        )
      )
    }

    bucket.count += 1

    return next()
  }
}

export const clientSearchRateLimit =
  createClientSearchRateLimit()