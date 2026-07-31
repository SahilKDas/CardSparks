import test from 'node:test'
import assert from 'node:assert/strict'
import { buildStudyResult, createStudyResultSvg, studyResultShareText } from './studyResult.js'

test('study result clamps invalid totals and produces a useful next goal', () => {
  const result = buildStudyResult({ correct: 12, total: 10, label: 'Practice test' })
  assert.equal(result.correct, 10)
  assert.equal(result.score, 100)
  assert.equal(result.missed, 0)
  assert.match(result.nextGoal, /spacing/i)
})

test('share artifacts contain aggregates but never incidental private fields', () => {
  const result = buildStudyResult({
    correct: 7,
    total: 10,
    label: 'Practice test',
    email: 'learner@example.com',
    prompts: ['Private card contents'],
  })
  const artifact = `${createStudyResultSvg(result)} ${studyResultShareText(result)}`
  assert.match(artifact, /70%/)
  assert.doesNotMatch(artifact, /learner@example\.com|Private card contents/)
})

test('SVG generation escapes result labels', () => {
  const svg = createStudyResultSvg(buildStudyResult({ correct: 1, total: 2, label: '<Exam & review>' }))
  assert.match(svg, /&lt;EXAM &amp; REVIEW&gt;/)
  assert.doesNotMatch(svg, /<EXAM/)
})
