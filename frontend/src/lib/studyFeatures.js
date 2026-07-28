export const MIN_NOTES_LENGTH = 100
export const MAX_NOTES_LENGTH = 20000

function truncate(value, limit) {
  const characters = Array.from(String(value || '').trim())
  return characters.length <= limit ? characters.join('') : `${characters.slice(0, limit - 1).join('').trimEnd()}…`
}

export function validateStudyNotes(source) {
  const notes = String(source || '').trim()
  if (notes.length < MIN_NOTES_LENGTH) {
    return `Paste at least ${MIN_NOTES_LENGTH} characters so CardSparks has enough context.`
  }
  if (notes.length > MAX_NOTES_LENGTH) {
    return `Keep your notes under ${MAX_NOTES_LENGTH.toLocaleString()} characters.`
  }
  return ''
}

export function deriveNotesTitle(source) {
  const firstLine = String(source || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:#{1,6}|[-*•])\s*/, '').trim())
    .find(Boolean)

  return truncate(firstLine || 'Study notes', 60)
}

function noteFacts(source) {
  const lines = String(source).split(/\r?\n+/).map((line) => line.trim()).filter(Boolean)
  const firstLooksLikeHeading = lines.length > 1 && lines[0].length <= 80 && !/[.:!?–—]/.test(lines[0])

  return (firstLooksLikeHeading ? lines.slice(1) : lines)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 18)
}

function cardFromFact(fact, repeated) {
  const definition = fact.match(/^([^:–—]{2,80})\s*(?::|–|—)\s*(.{8,})$/)
  if (definition) {
    return {
      front: `What is ${truncate(definition[1], 80)}?`,
      back: truncate(definition[2], 300),
    }
  }

  const words = fact.replace(/[.!?]+$/, '').split(/\s+/)
  const subjectLength = /^(?:the|a|an)$/i.test(words[0]) ? Math.min(3, words.length) : 1
  const subject = truncate(words.slice(0, subjectLength).join(' '), 80)
  return {
    front: repeated ? `Can you explain the key idea about ${subject}?` : `What do the notes say about ${subject}?`,
    back: truncate(fact, 300),
  }
}

export function buildMockCardsFromNotes(source, requestedCount = 8) {
  const error = validateStudyNotes(source)
  if (error) throw new RangeError(error)

  const count = Math.max(1, Math.min(Number(requestedCount) || 8, 20))
  const facts = noteFacts(source)
  const usableFacts = facts.length ? facts : [String(source).trim()]

  return Array.from({ length: count }, (_, index) =>
    cardFromFact(usableFacts[index % usableFacts.length], index >= usableFacts.length))
}

export function buildMockStudyFeedback(results, cards = []) {
  const safeResults = Array.isArray(results) ? results : []
  if (!safeResults.length) return 'Complete a review session to unlock coaching for your next study round.'

  const cardMap = new Map((Array.isArray(cards) ? cards : []).map((card) => [String(card.id), card]))
  const missed = safeResults.filter((result) => Number(result.grade) < 3)
  const passed = safeResults.length - missed.length

  if (!missed.length) {
    return truncate(`Strong session—you recalled all ${passed} ${passed === 1 ? 'card' : 'cards'}. Let the schedule space them out, then return when they are due.`, 300)
  }

  const weakTopics = missed
    .map((result) => cardMap.get(String(result.cardId))?.front)
    .filter(Boolean)
    .slice(0, 2)
    .map((front) => `“${truncate(front, 48)}”`)

  const focus = weakTopics.length ? ` Focus next on ${weakTopics.join(' and ')}.` : ' Focus next on the cards you missed.'
  return truncate(`You recalled ${passed} of ${safeResults.length} cards on the first pass.${focus} Explain each answer aloud before the next review.`, 300)
}
