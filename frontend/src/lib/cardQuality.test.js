import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeCardQuality } from './cardQuality.js'

test('quality analysis reports vague, long, duplicate, and weak cloze cards', () => {
  const issues = analyzeCardQuality([
    { id: 1, front: 'Explain?', back: 'A'.repeat(260), cardType: 'basic' },
    { id: 2, front: 'Explain?', back: 'Short', cardType: 'cloze' },
  ])
  assert.equal(issues.length, 2)
  assert.ok(issues[0].issues.some((issue) => issue.includes('vague')))
  assert.ok(issues[0].issues.some((issue) => issue.includes('long')))
  assert.ok(issues[1].issues.some((issue) => issue.includes('cloze')))
  assert.ok(issues.every((issue) => issue.issues.some((message) => message.includes('same'))))
})
