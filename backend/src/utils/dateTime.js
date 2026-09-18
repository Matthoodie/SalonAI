export function isValidUtcDateTime(
  value
) {
  if (typeof value !== 'string') {
    return false
  }

  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/.exec(
      value
    )

  if (!match) {
    return false
  }

  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    millisecondText,
  ] = match

  const year =
    Number(yearText)

  const month =
    Number(monthText)

  const day =
    Number(dayText)

  const hour =
    Number(hourText)

  const minute =
    Number(minuteText)

  const second =
    Number(secondText)

  const millisecond =
    millisecondText === undefined
      ? 0
      : Number(millisecondText)

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        hour,
        minute,
        second,
        millisecond
      )
    )

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second &&
    date.getUTCMilliseconds() ===
      millisecond
  )
}