import { validateCardDraft } from './cardTypes.js'

const safeName = (value) => String(value || 'deck').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'deck'
const quoteCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

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
