import test from 'node:test'
import assert from 'node:assert/strict'
import { backupPayload, deckCsv, parseTransfer } from './transfer.js'

test('CSV export and import preserve quoted card text', () => {
  const deck = { title: 'Test', cards: [{ front: 'Why, exactly?', back: 'Because "quotes" matter', cardType: 'basic', choices: [] }] }
  const parsed = parseTransfer(deckCsv(deck), 'test.csv')
  assert.equal(parsed.decks[0].cards[0].front, deck.cards[0].front)
  assert.equal(parsed.decks[0].cards[0].back, deck.cards[0].back)
})

test('backup import reports duplicates without deleting preview rows', () => {
  const deck = { title: 'Test', cards: [{ front: 'Q', back: 'A' }] }
  const parsed = parseTransfer(backupPayload([deck]), 'backup.json', [deck])
  assert.equal(parsed.duplicates, 1)
  assert.equal(parsed.decks[0].cards[0].duplicate, true)
})

test('Anki TSV export omits the spreadsheet header row', () => {
  const text = deckCsv({ cards: [{ front: 'Question', back: 'Answer', cardType: 'basic', choices: [] }] }, '\t')
  assert.match(text, /^Question\tAnswer/)
  assert.doesNotMatch(text, /^front\tback/)
})
