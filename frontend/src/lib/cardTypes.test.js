import test from 'node:test'
import assert from 'node:assert/strict'
import { clozeAnswer, clozePrompt, studyFaces, validateCardDraft } from './cardTypes.js'

test('cloze helpers hide and reveal only double-braced text', () => {
  assert.equal(clozePrompt('ATP is made by {{mitochondria}}.'), 'ATP is made by […].')
  assert.equal(clozeAnswer('ATP is made by {{mitochondria}}.'), 'ATP is made by mitochondria.')
})

test('card type validation rejects incomplete specialized cards', () => {
  assert.match(validateCardDraft({ cardType: 'multiple_choice', front: 'Q', back: 'A', choices: ['Only'], correctIndex: 0 }), /2 to 6/)
  assert.match(validateCardDraft({ cardType: 'multiple_choice', front: 'Q', back: 'A', choices: ['Valid', ' '], correctIndex: 0 }), /needs text/)
  assert.match(validateCardDraft({ cardType: 'cloze', front: 'No blank', back: 'A' }), /double braces/)
  assert.match(validateCardDraft({ cardType: 'image', front: 'Q', back: 'A', imageUrl: 'javascript:bad' }), /valid http/)
})

test('reversible cards swap their study faces', () => {
  assert.deepEqual(studyFaces({ cardType: 'reversible', front: 'hola', back: 'hello' }), {
    front: 'hello', back: 'hola', frontLabel: 'Reverse prompt', backLabel: 'Original front',
  })
})

test('cloze study faces retain the author explanation', () => {
  assert.deepEqual(studyFaces({ cardType: 'cloze', front: 'ATP comes from {{mitochondria}}.', back: 'The cell powerhouse.' }), {
    front: 'ATP comes from […].',
    back: 'ATP comes from mitochondria. — The cell powerhouse.',
    frontLabel: 'Fill the blank',
    backLabel: 'Completed statement',
  })
})
