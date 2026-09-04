function getTimeZoneOffsetMilliseconds(
    date,
    timeZone
) {
    const formatter = new Intl.DateTimeFormat(
        'en-CA',
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
            .map((part) => [
                part.type,
                part.value,
            ])
    )

    const asUtc = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second)
    )

    return asUtc - date.getTime()
}

export function zonedDateTimeToUtc({
    date,
    time,
    timeZone,
}) {
    const [
        year,
        month,
        day,
    ] = date.split('-').map(Number)

    const [
        hour,
        minute,
        second = 0,
    ] = time.split(':').map(Number)

    const utcGuess = new Date(
        Date.UTC(
            year,
            month - 1,
            day,
            hour,
            minute,
            second
        )
    )

    const firstOffset =
        getTimeZoneOffsetMilliseconds(
            utcGuess,
            timeZone
        )

    let result = new Date(
        utcGuess.getTime() - firstOffset
    )

    const secondOffset =
        getTimeZoneOffsetMilliseconds(
            result,
            timeZone
        )

    if (secondOffset !== firstOffset) {
        result = new Date(
            utcGuess.getTime() -
            secondOffset
        )
    }

    return result
}