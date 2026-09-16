export function getSalonLocalDateParts(
  isoDateTime,
  timeZone
) {
  if (!isoDateTime || !timeZone) {
    throw new Error(
      'ISO datetime and timezone are required.'
    )
  }

  const formatter =
    new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }
    )

  const parts =
    Object.fromEntries(
      formatter
        .formatToParts(
          new Date(isoDateTime)
        )
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

  return {
    date:
      `${parts.year}-${parts.month}-${parts.day}`,

    time:
      `${parts.hour}:${parts.minute}`,
  }
}