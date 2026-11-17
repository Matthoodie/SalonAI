import test from 'node:test'
import assert from 'node:assert/strict'
import { unionIntervals as union, intersectIntervals as intersection, subtractIntervals as subtract,
  intervalMilliseconds as duration } from '../src/utils/capacityIntervals.js'

test('capacity intervals: union normalizes unsorted nested duplicate and touching windows', () => {
  assert.deepEqual(union([[8, 10], [0, 5], [2, 3], [5, 8], [0, 5], [12, 15]]), [[0, 10], [12, 15]])
})
test('capacity intervals: intersection clips both sides and treats touching edges as empty', () => {
  assert.deepEqual(intersection([[0, 10], [20, 30]], [[5, 25]]), [[5, 10], [20, 25]])
  assert.deepEqual(intersection([[0, 10]], [[10, 20]]), [])
})
test('capacity intervals: subtraction splits windows without counting overlapping blocks twice', () => {
  assert.deepEqual(subtract([[0, 20]], [[2, 6], [4, 9], [12, 15]]), [[0, 2], [9, 12], [15, 20]])
})
test('capacity intervals: one block can cover several disjoint working windows', () => {
  assert.deepEqual(subtract([[0, 10], [20, 30], [40, 50]], [[5, 45]]), [[0, 5], [45, 50]])
})
test('capacity intervals: empty lists are valid and duration is union duration', () => {
  assert.deepEqual(union([]), [])
  assert.deepEqual(subtract([[0, 1]], []), [[0, 1]])
  assert.deepEqual(intersection([], [[0, 1]]), [])
  assert.equal(duration([[0, 10], [5, 15]]), 15)
})
test('capacity intervals: malformed or unbounded lists fail rather than becoming zero', () => {
  for (const rows of [null, {}, [[0, 0]], [[2, 1]], [[0, Infinity]], [[0, 1.5]], [['0', 1]], [[0, 1, 2]], Array(25001).fill([0, 1])]) {
    assert.throws(() => union(rows))
    assert.throws(() => subtract([], rows))
    assert.throws(() => intersection(rows, []))
  }
})
test('capacity intervals: overflowing total duration is rejected', () => {
  assert.throws(() => duration([[-8640000000000000, 8640000000000000]]), /overflow/)
})
test('capacity intervals: inputs stay unchanged and returned arrays are independent', () => {
  const source = Object.freeze([Object.freeze([5, 10]), Object.freeze([0, 5])])
  const result = union(source); result[0][0] = 100
  assert.deepEqual(source, [[5, 10], [0, 5]])
  assert.deepEqual(subtract(source, [[2, 3]]), [[0, 2], [3, 10]])
})
test('capacity intervals: seeded grid oracle checks union intersection and subtraction', () => {
  let seed = 7351
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed }
  const make = () => Array.from({ length: random() % 9 }, () => { const a = random() % 50; return [a, a + 1 + random() % 10] })
  const cells = rows => Array.from({ length: 60 }, (_, i) => rows.some(([a, b]) => a <= i && i < b))
  for (let attempt = 0; attempt < 200; attempt++) {
    const a = make(), b = make(), ac = cells(a), bc = cells(b)
    assert.deepEqual(cells(union(a)), ac)
    assert.deepEqual(cells(intersection(a, b)), ac.map((x, i) => x && bc[i]))
    assert.deepEqual(cells(subtract(a, b)), ac.map((x, i) => x && !bc[i]))
    assert.equal(duration(intersection(a, b)) + duration(subtract(a, b)), duration(a))
  }
})
