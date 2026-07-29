import test from 'node:test'
import assert from 'node:assert/strict'
import { extractNotesFile, normalizeExtractedText } from './fileNotes.js'

test('file text normalization preserves paragraphs while cleaning parser whitespace', () => {
  assert.equal(
    normalizeExtractedText('  First\t idea \r\n\r\n\r\n Second idea  '),
    'First idea\n\nSecond idea',
  )
})

test('plain-text import is bounded and reports truncation', async () => {
  const file = new File(['Heading\n' + 'x'.repeat(30)], 'notes.txt', { type: 'text/plain' })
  const result = await extractNotesFile(file, 20)

  assert.equal(result.text.length, 20)
  assert.equal(result.truncated, true)
  assert.equal(result.originalLength, 38)
})

test('unsupported files fail with an actionable message', async () => {
  const file = new File(['content'], 'notes.pages')
  await assert.rejects(() => extractNotesFile(file), /supports PDF, DOCX, TXT, and Markdown/)
})
