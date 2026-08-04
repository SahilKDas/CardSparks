import test from 'node:test'
import assert from 'node:assert/strict'
import { backupPayload, deckCsv, deckMarkdown, deckPdf, parseTransfer } from './transfer.js'

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

test('Markdown export includes every card and specialized metadata', () => {
  const markdown = deckMarkdown({ title: 'Biology #1', description: 'Exam *review*', cards: [
    { front: 'Cell membrane?', back: 'Selective permeability', cardType: 'basic' },
    { front: 'Choose one', back: 'ATP', cardType: 'multiple_choice', choices: ['DNA', 'ATP'], correctIndex: 1 },
  ] }, new Date('2026-08-03T12:00:00.000Z'))
  assert.match(markdown, /^# Biology \\#1/m)
  assert.match(markdown, /## 1\. Cell membrane\?/)
  assert.match(markdown, /ATP \(correct\)/)
})

test('PDF export produces paginated PDF bytes with escaped card text', () => {
  const cards = Array.from({ length: 18 }, (_, index) => ({ front: `Question (${index + 1})?`, back: 'A detailed answer with \\ slash.', cardType: 'basic' }))
  const bytes = deckPdf({ title: 'Large deck', cards }, new Date('2026-08-03T12:00:00.000Z'))
  const text = new TextDecoder('latin1').decode(bytes)
  assert.match(text, /^%PDF-1\.4/)
  assert.match(text, /\/Type \/Catalog/)
  assert.ok((text.match(/\/Type \/Page\b/g) || []).length > 1)
  assert.ok(text.includes('Question \\(1\\)?'))
  assert.match(text, /startxref\n\d+\n%%EOF/)
})
