/** Convert a comma-separated editor value into the backend's bounded tag list. */
export function parseTags(value, limit = 10) {
  const seen = new Set()
  const tags = []
  String(value || '').split(',').forEach((part) => {
    const tag = part.trim().slice(0, 30)
    const key = tag.toLocaleLowerCase()
    if (tag && !seen.has(key) && tags.length < limit) {
      seen.add(key)
      tags.push(tag)
    }
  })
  return tags
}

/**
 * Search every learner-visible part of a deck, including card content. Card
 * text is useful when a learner remembers a concept but not its deck name.
 */
export function deckMatches(deck, query, folder = 'all') {
  if (folder !== 'all' && (deck.folder || '') !== folder) return false
  const needle = String(query || '').trim().toLocaleLowerCase()
  if (!needle) return true

  const searchable = [
    deck.title,
    deck.description,
    deck.folder,
    ...(deck.tags || []),
    ...(deck.cards || []).flatMap((card) => [card.front, card.back]),
  ]
  return searchable.some((value) => String(value || '').toLocaleLowerCase().includes(needle))
}
