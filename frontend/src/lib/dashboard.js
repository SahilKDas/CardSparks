import { isDue } from './sm2.js'

const DEFAULT_CARDS_PER_MINUTE = 6

/**
 * Build the dashboard's "Today" queue from the same normalized card fields used
 * by the study screen. A card with zero repetitions is considered new; every
 * other due card is a review. Keeping this calculation in one pure function
 * makes the dashboard deterministic and prevents its totals from drifting away
 * from the actual study queue rules.
 */
export function buildTodaySummary(decks, now = Date.now(), cardsPerMinute = DEFAULT_CARDS_PER_MINUTE) {
  const perDeck = (Array.isArray(decks) ? decks : []).map((deck) => {
    const dueCards = (deck.cards || []).filter((card) => isDue(card, now))
    // Failed reviews reset repetitions to zero, so lastReviewedAt is the only
    // reliable way to distinguish an unseen card from a lapsed review.
    const newCards = dueCards.filter((card) => !card.lastReviewedAt).length

    return {
      id: deck.id,
      title: deck.title,
      emoji: deck.emoji,
      color: deck.color,
      total: dueCards.length,
      newCards,
      reviews: dueCards.length - newCards,
    }
  }).filter((deck) => deck.total > 0)

  // Put the largest actionable queue first so the primary CTA always starts
  // the session that clears the most work. The title tie-breaker keeps ordering
  // stable across browsers and API responses.
  perDeck.sort((left, right) => right.total - left.total || left.title.localeCompare(right.title))

  const total = perDeck.reduce((sum, deck) => sum + deck.total, 0)
  const newCards = perDeck.reduce((sum, deck) => sum + deck.newCards, 0)
  const reviews = total - newCards
  const safeRate = Number.isFinite(cardsPerMinute) && cardsPerMinute > 0
    ? cardsPerMinute
    : DEFAULT_CARDS_PER_MINUTE

  return {
    total,
    newCards,
    reviews,
    estimatedMinutes: total ? Math.max(1, Math.ceil(total / safeRate)) : 0,
    firstDeckId: perDeck[0]?.id || null,
    perDeck,
  }
}
