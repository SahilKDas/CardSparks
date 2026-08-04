import { validateCardDraft } from './cardTypes.js'

const safeName = (value) => String(value || 'deck').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'deck'
const quoteCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

const CARD_TYPE_LABELS = {
  basic: 'Basic',
  reversible: 'Reversible',
  multiple_choice: 'Multiple choice',
  cloze: 'Cloze deletion',
  image: 'Image',
}

export function backupPayload(decks) {
  return JSON.stringify({ format: 'cardsparks-backup', version: 1, exportedAt: new Date().toISOString(), decks }, null, 2)
}

export function deckCsv(deck, delimiter = ',', includeHeader = true) {
  const rows = [['front', 'back', 'card_type', 'choices', 'correct_index', 'image_url']]
  deck.cards.forEach((card) => rows.push([card.front, card.back, card.cardType, JSON.stringify(card.choices || []), card.correctIndex ?? '', card.imageUrl || '']))
  // Anki treats every TSV line as a note, so its export intentionally omits
  // the CSV-style header. Spreadsheet CSV keeps the descriptive header.
  return rows.slice(includeHeader && delimiter === ',' ? 0 : 1).map((row) => row.map((value) => delimiter === ',' ? quoteCsv(value) : String(value).replace(/[\t\r\n]+/g, ' ')).join(delimiter)).join('\n')
}

function markdownText(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/([*_#>|])/g, '\\$1').trim()
}

export function deckMarkdown(deck, exportedAt = new Date()) {
  const cards = Array.isArray(deck?.cards) ? deck.cards : []
  const lines = [
    `# ${markdownText(deck?.title || 'Untitled deck')}`,
    '',
    markdownText(deck?.description || 'Exported from CardSparks.'),
    '',
    `- Cards: ${cards.length}`,
    `- Exported: ${exportedAt.toISOString()}`,
    '',
    '---',
  ]

  cards.forEach((card, index) => {
    const type = CARD_TYPE_LABELS[card.cardType || card.card_type || 'basic'] || 'Basic'
    lines.push('', `## ${index + 1}. ${markdownText(card.front)}`, '', `**Answer:** ${markdownText(card.back)}`, '', `*Type: ${type}*`)
    if (card.cardType === 'multiple_choice' && card.choices?.length) {
      lines.push('', '**Choices:**')
      card.choices.forEach((choice, choiceIndex) => {
        const correct = choiceIndex === card.correctIndex ? ' (correct)' : ''
        lines.push(`- ${markdownText(choice)}${correct}`)
      })
    }
    if (card.cardType === 'image' && card.imageUrl) lines.push('', `**Reference image:** ${markdownText(card.imageUrl)}`)
    lines.push('', '---')
  })
  return `${lines.join('\n')}\n`
}

const WIN_ANSI_REPLACEMENTS = new Map([
  ['’', "'"], ['‘', "'"], ['“', '"'], ['”', '"'], ['–', '-'], ['—', '-'], ['…', '...'], ['•', '-'],
])

function pdfSafeText(value) {
  return [...String(value ?? '')].map((character) => {
    if (WIN_ANSI_REPLACEMENTS.has(character)) return WIN_ANSI_REPLACEMENTS.get(character)
    const code = character.charCodeAt(0)
    return code >= 32 && code <= 255 ? character : '?'
  }).join('').replace(/[\\()]/g, '\\$&').replace(/[\r\n\t]+/g, ' ')
}

function wrapPdfText(value, maxCharacters) {
  const words = pdfSafeText(value).split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  words.forEach((word) => {
    const parts = word.length > maxCharacters
      ? word.match(new RegExp(`.{1,${maxCharacters}}`, 'g'))
      : [word]
    parts.forEach((part) => {
      const candidate = line ? `${line} ${part}` : part
      if (candidate.length > maxCharacters && line) {
        lines.push(line)
        line = part
      } else line = candidate
    })
  })
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function pdfTextCommands(lines, x, y, fontSize, lineHeight, font = 'F1') {
  return lines.map((line, index) => `BT /${font} ${fontSize} Tf 0.16 0.15 0.14 rg 1 0 0 1 ${x} ${y - (index * lineHeight)} Tm (${line}) Tj ET`).join('\n')
}

function buildPdfPages(deck, exportedAt) {
  const cards = Array.isArray(deck?.cards) ? deck.cards : []
  const pages = []
  let commands = []
  let y = 776

  function beginPage() {
    commands = []
    y = 776
    commands.push('0.95 0.42 0.30 rg 48 786 22 22 re f')
    commands.push(pdfTextCommands(['CardSparks'], 80, 791, 15, 17))
    const titleLines = wrapPdfText(deck?.title || 'Untitled deck', 55).slice(0, 2)
    commands.push(pdfTextCommands(titleLines, 48, 754, 22, 26))
    y = 754 - (titleLines.length * 26) - 10
    commands.push(pdfTextCommands([`${cards.length} cards - Exported ${exportedAt.toISOString().slice(0, 10)}`], 48, y, 9, 11))
    y -= 28
  }

  function finishPage() {
    commands.push(pdfTextCommands([`Page ${pages.length + 1}`], 500, 28, 8, 10))
    pages.push(commands.join('\n'))
  }

  beginPage()
  cards.forEach((card, index) => {
    const frontLines = wrapPdfText(card.front, 72)
    const backLines = wrapPdfText(card.back, 78)
    // Include the label rows, divider, and a full baseline below the final
    // answer line. Without this padding, multi-line answers can visually fall
    // outside their card even though the PDF itself remains valid.
    const cardHeight = 80 + (frontLines.length * 15) + (backLines.length * 13)
    if (y - cardHeight < 58) {
      finishPage()
      beginPage()
    }
    const bottom = y - cardHeight
    commands.push(`0.98 0.97 0.95 rg 42 ${bottom} 511 ${cardHeight} re f`)
    commands.push(`0.90 0.88 0.84 RG 42 ${bottom} 511 ${cardHeight} re S`)
    commands.push(pdfTextCommands([`CARD ${index + 1}`], 58, y - 19, 8, 10))
    commands.push(pdfTextCommands(frontLines, 58, y - 39, 12, 15))
    const answerY = y - 39 - (frontLines.length * 15) - 8
    commands.push(`0.95 0.42 0.30 RG 58 ${answerY + 4} m 537 ${answerY + 4} l S`)
    commands.push(pdfTextCommands(['ANSWER'], 58, answerY - 11, 8, 10))
    commands.push(pdfTextCommands(backLines, 58, answerY - 29, 10, 13))
    y = bottom - 12
  })
  finishPage()
  return pages
}

function latin1Bytes(value) {
  const bytes = new Uint8Array(value.length)
  for (let index = 0; index < value.length; index += 1) bytes[index] = value.charCodeAt(index) & 0xff
  return bytes
}

function concatBytes(chunks) {
  const size = chunks.reduce((total, chunk) => total + chunk.length, 0)
  const output = new Uint8Array(size)
  let offset = 0
  chunks.forEach((chunk) => { output.set(chunk, offset); offset += chunk.length })
  return output
}

/** Build a self-contained, standards-compliant PDF using built-in Helvetica. */
export function deckPdf(deck, exportedAt = new Date()) {
  const pageStreams = buildPdfPages(deck, exportedAt)
  const objectCount = 3 + (pageStreams.length * 2)
  const objects = Array(objectCount + 1)
  const pageIds = pageStreams.map((_, index) => 4 + (index * 2))
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[2] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  pageStreams.forEach((stream, index) => {
    const pageId = pageIds[index]
    const contentId = pageId + 1
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`
    objects[contentId] = `<< /Length ${latin1Bytes(stream).length} >>\nstream\n${stream}\nendstream`
  })

  const chunks = [latin1Bytes('%PDF-1.4\n')]
  const offsets = Array(objectCount + 1).fill(0)
  let byteOffset = chunks[0].length
  for (let id = 1; id <= objectCount; id += 1) {
    offsets[id] = byteOffset
    const chunk = latin1Bytes(`${id} 0 obj\n${objects[id]}\nendobj\n`)
    chunks.push(chunk)
    byteOffset += chunk.length
  }
  const xrefOffset = byteOffset
  const xref = [`xref\n0 ${objectCount + 1}\n`, '0000000000 65535 f \n']
  for (let id = 1; id <= objectCount; id += 1) xref.push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`)
  xref.push(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`)
  chunks.push(latin1Bytes(xref.join('')))
  return concatBytes(chunks)
}

export function exportFilename(deck, kind) {
  return `${safeName(deck?.title || 'cardsparks-backup')}.${kind === 'anki' ? 'tsv' : kind}`
}

function parseDelimited(text, delimiter) {
  const rows = []
  let row = [], value = '', quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted && character === '"' && text[index + 1] === '"') { value += '"'; index += 1 }
    else if (character === '"') quoted = !quoted
    else if (!quoted && character === delimiter) { row.push(value); value = '' }
    else if (!quoted && (character === '\n' || character === '\r')) {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      row.push(value); if (row.some((cell) => cell.trim())) rows.push(row); row = []; value = ''
    } else value += character
  }
  row.push(value); if (row.some((cell) => cell.trim())) rows.push(row)
  return rows
}

function normalizedKey(front, back) {
  return `${String(front).trim().toLowerCase()}\u0000${String(back).trim().toLowerCase()}`
}

function validateDecks(decks, existingDecks) {
  const existing = new Set(existingDecks.flatMap((deck) => deck.cards.map((card) => normalizedKey(card.front, card.back))))
  const seen = new Set()
  let validCards = 0, duplicates = 0
  const errors = []
  const preview = decks.map((deck, deckIndex) => ({ ...deck, cards: (deck.cards || []).map((card, cardIndex) => {
    const front = String(card.front || '').trim(), back = String(card.back || '').trim()
    const rowErrors = []
    if (!front) rowErrors.push('Missing front')
    if (!back) rowErrors.push('Missing back')
    if (front && back) {
      const validation = validateCardDraft({ ...card, front, back, cardType: card.cardType || card.card_type || 'basic' })
      if (validation) rowErrors.push(validation)
    }
    const key = normalizedKey(front, back)
    const duplicate = front && back && (existing.has(key) || seen.has(key))
    if (duplicate) duplicates += 1
    else if (!rowErrors.length) { validCards += 1; seen.add(key) }
    if (rowErrors.length) errors.push(`Deck ${deckIndex + 1}, card ${cardIndex + 1}: ${rowErrors.join(', ')}`)
    return { ...card, front, back, duplicate, errors: rowErrors }
  }) }))
  return { decks: preview, validCards, duplicates, errors }
}

export function parseTransfer(text, filename, existingDecks = []) {
  const extension = String(filename).split('.').pop().toLowerCase()
  let decks
  if (extension === 'json') {
    const payload = JSON.parse(text)
    if (payload?.format !== 'cardsparks-backup' || payload.version !== 1 || !Array.isArray(payload.decks)) throw new Error('This is not a supported CardSparks backup.')
    decks = payload.decks
  } else {
    const rows = parseDelimited(text, extension === 'tsv' ? '\t' : ',')
    if (!rows.length) throw new Error('The file contains no rows.')
    const normalizedHeader = rows[0].map((cell) => cell.trim().toLowerCase())
    const hasHeader = normalizedHeader.includes('front') && normalizedHeader.includes('back')
    const header = hasHeader ? normalizedHeader : ['front', 'back']
    const dataRows = hasHeader ? rows.slice(1) : rows
    const valueAt = (row, name) => row[header.indexOf(name)] || ''
    const cards = dataRows.map((row) => {
      let choices = []
      try { choices = JSON.parse(valueAt(row, 'choices') || '[]') } catch { choices = [] }
      return { front: valueAt(row, 'front'), back: valueAt(row, 'back'), cardType: valueAt(row, 'card_type') || 'basic', choices, correctIndex: valueAt(row, 'correct_index') === '' ? null : Number(valueAt(row, 'correct_index')), imageUrl: valueAt(row, 'image_url') }
    })
    decks = [{ title: String(filename).replace(/\.[^.]+$/, '') || 'Imported deck', description: 'Imported with CardSparks Transfer Center.', cards }]
  }
  return validateDecks(decks, existingDecks)
}
