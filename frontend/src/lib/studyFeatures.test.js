import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MAX_NOTES_LENGTH,
  buildMockCardsFromNotes,
  buildMockStudyFeedback,
  deriveNotesTitle,
  validateStudyNotes,
} from './studyFeatures.js'

const notes = `Cell Biology Review
Mitochondria: Organelles that generate ATP through cellular respiration.
Ribosomes assemble proteins from amino acids using messenger RNA instructions.
The cell membrane controls which substances enter and leave the cell.`

test('study notes enforce useful minimum and maximum lengths', () => {
  assert.match(validateStudyNotes('too short'), /at least 100 characters/)
  assert.match(validateStudyNotes('x'.repeat(MAX_NOTES_LENGTH + 1)), /under 20,000 characters/)
  assert.equal(validateStudyNotes(notes), '')
})

test('note titles use the first meaningful line and stay within 60 characters', () => {
  assert.equal(deriveNotesTitle('\n# Cell Biology Review\nMore notes'), 'Cell Biology Review')
  assert.equal(deriveNotesTitle(''), 'Study notes')
  assert.ok(Array.from(deriveNotesTitle('A'.repeat(100))).length <= 60)
})

test('mock note generation is deterministic, bounded, and source-derived', () => {
  const first = buildMockCardsFromNotes(notes, 8)
  const second = buildMockCardsFromNotes(notes, 8)

  assert.deepEqual(first, second)
  assert.equal(first.length, 8)
  assert.match(first[0].back, /generate ATP/)
  assert.ok(first.some((card) => card.front.includes('Mitochondria')))
  assert.equal(buildMockCardsFromNotes(notes, 100).length, 20)
})

test('mock coaching distinguishes perfect and mixed sessions', () => {
  const cards = [{ id: '1', front: 'What do mitochondria produce?' }, { id: '2', front: 'Where are proteins assembled?' }]
  const perfect = buildMockStudyFeedback([{ cardId: '1', grade: 5 }], cards)
  const mixed = buildMockStudyFeedback([{ cardId: '1', grade: 2 }, { cardId: '2', grade: 4 }], cards)

  assert.match(perfect, /recalled all 1 card/)
  assert.match(mixed, /recalled 1 of 2/)
  assert.match(mixed, /mitochondria/)
  assert.ok(mixed.length <= 300)
})
