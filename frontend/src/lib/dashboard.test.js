import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTodaySummary } from './dashboard.js'

test('today summary separates new cards from reviews and chooses the largest queue', () => {
  const now = Date.parse('2026-07-29T12:00:00Z')
  const decks = [
    {
      id: 'small',
      title: 'Small deck',
      cards: [{ repetitions: 2, dueAt: '2026-07-29T10:00:00Z', lastReviewedAt: '2026-07-20T10:00:00Z' }],
    },
    {
      id: 'large',
      title: 'Large deck',
      cards: [
        { repetitions: 0, dueAt: null },
        { repetitions: 1, dueAt: '2026-07-28T10:00:00Z', lastReviewedAt: '2026-07-20T10:00:00Z' },
        { repetitions: 2, dueAt: '2026-08-01T10:00:00Z' },
      ],
    },
  ]

  const summary = buildTodaySummary(decks, now, 2)

  assert.equal(summary.total, 3)
  assert.equal(summary.newCards, 1)
  assert.equal(summary.reviews, 2)
  assert.equal(summary.estimatedMinutes, 2)
  assert.equal(summary.firstDeckId, 'large')
})

test('today summary returns a safe empty state', () => {
  assert.deepEqual(buildTodaySummary([], Date.now()), {
    total: 0,
    newCards: 0,
    reviews: 0,
    estimatedMinutes: 0,
    firstDeckId: null,
    perDeck: [],
  })
})
