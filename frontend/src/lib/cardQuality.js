function normalizedPrompt(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ')
}

/** Deterministic mock analysis mirrors the categories requested from the AI. */
export function analyzeCardQuality(cards) {
  const promptCounts = new Map()
  cards.forEach((card) => {
    const key = normalizedPrompt(card.front)
    promptCounts.set(key, (promptCounts.get(key) || 0) + 1)
  })

  return cards.flatMap((card) => {
    const issues = []
    const front = String(card.front || '').trim()
    const back = String(card.back || '').trim()
    let suggestedFront = front
    let suggestedBack = back
    if (front.length < 12 || /^(what is this|explain|define|why)\??$/i.test(front)) {
      issues.push('The prompt is vague; add the exact concept or context being tested.')
      suggestedFront = front ? `${front.replace(/\?$/, '')} in this deck’s context?` : 'What specific concept should you recall?'
    }
    if (back.length > 240) {
      issues.push('The answer is long enough to hide multiple recall targets.')
      suggestedBack = back.slice(0, 237).replace(/\s+\S*$/, '') + '…'
    }
    if ((back.match(/[;:]/g) || []).length >= 2 || (back.match(/\band\b/gi) || []).length >= 3) issues.push('The answer may contain several facts; consider splitting this card.')
    if (card.cardType === 'cloze' && !/^.*\{\{[^{}]{1,80}}}.*$/.test(front)) issues.push('The cloze deletion is missing, empty, nested, or too broad.')
    if ((promptCounts.get(normalizedPrompt(front)) || 0) > 1) issues.push('Another card uses the same or nearly identical prompt.')
    return issues.length ? [{ cardId: String(card.id), issues, suggestedFront, suggestedBack }] : []
  })
}
