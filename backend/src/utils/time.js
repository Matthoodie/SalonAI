export function timeToMinutes(
  time
) {
  if (typeof time !== 'string') {
    return null
  }

  const match =
    /^(\d{2}):(\d{2})(?::00)?$/.exec(
      time
    )

  if (!match) {
    return null
  }

  const hours =
    Number(match[1])

  const minutes =
    Number(match[2])

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null
  }

  return hours * 60 + minutes
}

export function isValidTime(
  time
) {
  if (
    typeof time !== 'string' ||
    !/^\d{2}:\d{2}$/.test(time)
  ) {
    return false
  }

  return (
    timeToMinutes(time) !== null
  )
}

export function minutesToTime(
  totalMinutes
) {
  if (
    !Number.isSafeInteger(
      totalMinutes
    ) ||
    totalMinutes < 0 ||
    totalMinutes >= 24 * 60
  ) {
    return null
  }

  const hours =
    Math.floor(
      totalMinutes / 60
    )

  const minutes =
    totalMinutes % 60

  return (
    `${String(hours).padStart(2, '0')}:` +
    `${String(minutes).padStart(2, '0')}`
  )
}