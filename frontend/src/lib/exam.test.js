import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeMisconception, buildExamQuestions, scoreExam } from './exam.js'

test('exam conversion is deterministic and creates one correct option', () => {
  const deck = { id: 'd1', cards: [
    { id: '1', front: 'A?', back: 'Alpha', cardType: 'basic' },
    { id: '2', front: 'B?', back: 'Beta', cardType: 'basic' },
    { id: '3', front: 'C?', back: 'Gamma', cardType: 'basic' },
  ] }
  const first = buildExamQuestions(deck, 3, 'fixed')
  const second = buildExamQuestions(deck, 3, 'fixed')
  assert.deepEqual(first, second)
  assert.ok(first.every((question) => question.options.filter((option) => option.correct).length === 1))
})

test('exam scores selected answers without changing questions', () => {
  const questions = [{ cardId: '1', prompt: 'A?', options: [{ text: 'A', correct: true }, { text: 'B', correct: false }] }]
  assert.equal(scoreExam(questions, [0])[0].correct, true)
  assert.equal(scoreExam(questions, [1])[0].correct, false)
})

test('misconception analysis distinguishes overlap and creates a follow-up card', () => {
  const diagnosis = analyzeMisconception({
    prompt: 'Where is ATP generated?',
    selected: 1,
    correctIndex: 0,
    correct: false,
    options: [
      { text: 'Inside the mitochondria during cellular respiration', correct: true },
      { text: 'Inside the nucleus during cellular division', correct: false },
    ],
  })
  assert.equal(diagnosis.title, 'Boundary confusion')
  assert.match(diagnosis.correction, /mitochondria/)
  assert.match(diagnosis.followUpCard.front, /distinguish/i)
  assert.equal(diagnosis.followUpCard.cardType, 'basic')
})

test('misconception analysis handles unanswered questions and ignores correct ones', () => {
  const unanswered = analyzeMisconception({
    prompt: 'What is osmosis?', selected: null, correctIndex: 0, correct: false,
    options: [{ text: 'Movement of water across a membrane', correct: true }],
  })
  assert.equal(unanswered.title, 'Recall gap')
  assert.equal(analyzeMisconception({ correct: true }), null)
})
