import test from 'node:test'
import assert from 'node:assert/strict'
import { deckMatches, parseTags } from './organize.js'

test('tags are trimmed, deduplicated case-insensitively, and bounded', () => {
  assert.deepEqual(parseTags(' Biology, exam, biology, , chapter 1 '), ['Biology', 'exam', 'chapter 1'])
  assert.equal(parseTags(Array.from({ length: 12 }, (_, index) => `tag${index}`).join(',')).length, 10)
})

test('deck search includes metadata and card content while respecting folders', () => {
  const deck = {
    title: 'Biology',
    description: 'Cells',
    folder: 'Semester 1',
    tags: ['midterm'],
    cards: [{ front: 'Mitochondria', back: 'Produces ATP' }],
  }
  assert.equal(deckMatches(deck, 'midterm'), true)
  assert.equal(deckMatches(deck, 'ATP'), true)
  assert.equal(deckMatches(deck, 'biology', 'Semester 2'), false)
})
