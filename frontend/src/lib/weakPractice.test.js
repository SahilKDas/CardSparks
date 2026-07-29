import test from 'node:test'
import assert from 'node:assert/strict'
import { buildWeakQueue } from './weakPractice.js'

test('weak practice excludes unseen cards and ranks lapses first', () => {
  const decks = [{ id: 'd1', title: 'Biology', cards: [
    { id: 'new', mastery: 0, lapses: 0, easiness: 2.5, lastReviewedAt: null },
    { id: 'low', mastery: 0.3, lapses: 0, easiness: 2.4, lastReviewedAt: '2026-01-01' },
    { id: 'lapse', mastery: 0.7, lapses: 2, easiness: 2.1, lastReviewedAt: '2026-01-01' },
  ] }]
  assert.deepEqual(buildWeakQueue(decks).map((card) => card.id), ['lapse', 'low'])
})
