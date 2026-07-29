import test from 'node:test'
import assert from 'node:assert/strict'
import { convertCardType, tagsAfter } from './bulkCards.js'

test('bulk multiple-choice conversion keeps the answer and adds unique distractors', () => {
  const converted = convertCardType({ id: 1, back: 'A' }, 'multiple_choice', ['B', 'B', 'C'])
  assert.deepEqual(converted.choices, ['A', 'B', 'C'])
  assert.equal(converted.correctIndex, 0)
})

test('bulk tags are case-insensitively added and removed', () => {
  assert.deepEqual(tagsAfter(['Biology'], 'biology', 'add'), ['Biology'])
  assert.deepEqual(tagsAfter(['Biology', 'Exam'], 'BIOLOGY', 'remove'), ['Exam'])
})
