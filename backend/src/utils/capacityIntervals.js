// Half-open UTC intervals [start, end). Inputs and outputs are epoch milliseconds.
// These helpers never mutate their arguments and never round durations.
function validate(intervals) {
  if (!Array.isArray(intervals) || intervals.length > 25000) throw new TypeError('Invalid capacity interval list.')
  for (const row of intervals) {
    if (!Array.isArray(row) || row.length !== 2 ||
        !row.every(n => Number.isSafeInteger(n) && Math.abs(n) <= 8640000000000000) || row[0] >= row[1]) {
      throw new TypeError('Invalid capacity interval.')
    }
  }
}

export function unionIntervals(intervals) {
  validate(intervals)
  const sorted = intervals.map(row => [...row]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const result = []
  for (const row of sorted) {
    const last = result.at(-1)
    if (last && row[0] <= last[1]) last[1] = Math.max(last[1], row[1])
    else result.push(row)
  }
  return result
}

export function intersectIntervals(left, right) {
  const a = unionIntervals(left), b = unionIntervals(right), result = []
  let i = 0, j = 0
  while (i < a.length && j < b.length) {
    const start = Math.max(a[i][0], b[j][0]), end = Math.min(a[i][1], b[j][1])
    if (start < end) result.push([start, end])
    if (a[i][1] < b[j][1]) i++
    else j++
  }
  return result
}

export function subtractIntervals(left, right) {
  const a = unionIntervals(left), b = unionIntervals(right), result = []
  let j = 0
  for (const [start, end] of a) {
    let cursor = start
    while (j < b.length && b[j][1] <= cursor) j++
    let k = j
    while (k < b.length && b[k][0] < end) {
      if (b[k][0] > cursor) result.push([cursor, Math.min(end, b[k][0])])
      cursor = Math.max(cursor, b[k][1])
      if (cursor >= end) break
      k++
    }
    if (cursor < end) result.push([cursor, end])
  }
  return result
}

export function intervalMilliseconds(intervals) {
  let result = 0
  for (const [start, end] of unionIntervals(intervals)) {
    result += end - start
    if (!Number.isSafeInteger(result)) throw new RangeError('Capacity duration overflow.')
  }
  return result
}
