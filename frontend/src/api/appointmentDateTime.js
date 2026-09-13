function getTimeZoneOffsetMilliseconds(
  date,
  timeZone
) {
  const formatter = new Intl.DateTimeFormat(
    'en-US',
    {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }
  )

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter(
        (part) =>
          part.type !== 'literal'
      )
      .map(
        (part) => [
          part.type,
          part.value,
        ]
      )
  )

  const timeZoneAsUtc =
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    )

  return timeZoneAsUtc - date.getTime()
}

export function salonDateTimeToUtcIso(
  date,
  time,
  timeZone
) {
  if (!date || !time || !timeZone) {
    throw new Error(
      'Date, time and timezone are required.'
    )
  }

  const [
    year,
    month,
    day,
  ] = date
    .split('-')
    .map(Number)

  const [
    hour,
    minute,
  ] = time
    .split(':')
    .map(Number)

  const localTimeAsUtc =
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      0
    )

  let utcDate =
    new Date(localTimeAsUtc)

  const firstOffset =
    getTimeZoneOffsetMilliseconds(
      utcDate,
      timeZone
    )

  utcDate =
    new Date(
      localTimeAsUtc -
        firstOffset
    )

  const secondOffset =
    getTimeZoneOffsetMilliseconds(
      utcDate,
      timeZone
    )

  if (secondOffset !== firstOffset) {
    utcDate =
      new Date(
        localTimeAsUtc -
          secondOffset
      )
  }

  return utcDate.toISOString()
}