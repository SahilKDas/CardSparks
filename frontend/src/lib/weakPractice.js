/** Build a stable cross-deck queue from cards that have actual study history. */
export function buildWeakQueue(decks, limit = 25) {
  return (Array.isArray(decks) ? decks : [])
    .flatMap((deck) => (deck.cards || []).map((card) => ({
      ...card,
      deckId: deck.id,
      deckTitle: deck.title,
      deckEmoji: deck.emoji,
      weaknessScore: (card.lapses || 0) * 8
        + Math.max(0, 1 - (card.mastery || 0)) * 5
        + Math.max(0, 2.5 - (card.easiness || 2.5)) * 2,
    })))
    // Unseen cards are new material, not weak material. Requiring history also
    // avoids filling this focused mode with an entire newly imported deck.
    .filter((card) => card.lastReviewedAt && (card.lapses > 0 || card.mastery < 0.7 || card.easiness < 2.3))
    .sort((left, right) => right.weaknessScore - left.weaknessScore || String(left.id).localeCompare(String(right.id)))
    .slice(0, Math.max(1, Math.min(Number(limit) || 25, 100)))
}
