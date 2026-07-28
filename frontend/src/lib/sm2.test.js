import assert from 'node:assert/strict'
import test from 'node:test'

import {
  deriveMastery,
  formatInterval,
  isDue,
  sm2,
} from './sm2.js'


test('SM-2 schedules first successful reviews consistently', () => {
  const fresh = { easiness: 2.5, repetitions: 0, intervalDays: 0 }

  assert.equal(sm2(fresh, 3).intervalDays, 1)
  assert.equal(sm2(fresh, 4).intervalDays, 2)
  assert.equal(sm2(fresh, 5).intervalDays, 4)
})

test('a failed review resets repetitions and remains due', () => {
  const failed = sm2({ easiness: 2.5, repetitions: 4, intervalDays: 30 }, 1)

  assert.equal(failed.repetitions, 0)
  assert.equal(failed.intervalDays, 0)
})

test('invalid grades fail closed instead of corrupting a schedule', () => {
  assert.throws(() => sm2({ easiness: 2.5, repetitions: 0, intervalDays: 0 }, 6), RangeError)
  assert.throws(() => sm2({ easiness: 2.5, repetitions: 0, intervalDays: 0 }, 3.5), RangeError)
})

test('mastery reaches 100 percent at the configured horizon', () => {
  assert.equal(deriveMastery({ intervalDays: 60 }), 1)
  assert.ok(deriveMastery({ intervalDays: 4 }) > 0)
  assert.ok(deriveMastery({ intervalDays: 4 }) < 1)
})

test('invalid due dates are reviewed instead of disappearing forever', () => {
  assert.equal(isDue({ dueAt: 'not-a-date' }), true)
})

test('invalid intervals render a safe label', () => {
  assert.equal(formatInterval(Number.NaN), 'Not scheduled')
})
