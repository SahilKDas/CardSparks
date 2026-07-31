import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRescueQueue, rescueBreakdown, rescueCardLimit } from './rescue.js'

const NOW = Date.parse('2026-07-30T12:00:00.000Z')

test('rescue limits match the selected time budget and stay bounded', () => {
  assert.equal(rescueCardLimit(5), 6)
  assert.equal(rescueCardLimit(10), 13)
  assert.equal(rescueCardLimit(120), 40)
})

test('rescue queue prioritizes missed and overdue cards with visible reasons', () => {
  const decks = [{ id: 'bio', title: 'Biology', emoji: 'B', cards: [
    { id: 'new', mastery: 0, dueAt: null, lastReviewedAt: null },
    { id: 'soon', mastery: 0.9, dueAt: '2026-08-01T12:00:00.000Z', lastReviewedAt: '2026-07-20T12:00:00.000Z' },
    { id: 'overdue', mastery: 0.8, dueAt: '2026-07-25T12:00:00.000Z', lastReviewedAt: '2026-07-20T12:00:00.000Z' },
    { id: 'missed', mastery: 0.25, lapses: 3, easiness: 1.8, dueAt: '2026-08-10T12:00:00.000Z', lastReviewedAt: '2026-07-29T12:00:00.000Z' },
    { id: 'later', mastery: 1, dueAt: '2026-09-01T12:00:00.000Z', lastReviewedAt: '2026-07-20T12:00:00.000Z' },
  ] }]

  const queue = buildRescueQueue(decks, 5, NOW)
  assert.deepEqual(queue.map((card) => card.id), ['missed', 'overdue', 'new', 'soon'])
  assert.deepEqual(rescueBreakdown(queue), { 'Weak spot': 1, Overdue: 1, 'New card': 1, 'Due soon': 1 })
  assert.equal(queue.some((card) => card.id === 'later'), false)
})

test('rescue selection is deterministic and does not mutate source cards', () => {
  const decks = [{ id: 'd1', title: 'Deck', cards: [{ id: 'a', mastery: 0, dueAt: null }] }]
  const snapshot = structuredClone(decks)
  assert.deepEqual(buildRescueQueue(decks, 10, NOW), buildRescueQueue(decks, 10, NOW))
  assert.deepEqual(decks, snapshot)
})
