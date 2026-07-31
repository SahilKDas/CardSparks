import { DAY_MS } from './sm2.js'

const DEFAULT_SECONDS_PER_CARD = 45
const MAX_RESCUE_CARDS = 40

export function rescueCardLimit(minutes, secondsPerCard = DEFAULT_SECONDS_PER_CARD) {
  const safeMinutes = Math.max(1, Math.min(Number(minutes) || 10, 60))
  const safePace = Number.isFinite(secondsPerCard) && secondsPerCard > 0
    ? secondsPerCard
    : DEFAULT_SECONDS_PER_CARD
  return Math.max(1, Math.min(Math.floor((safeMinutes * 60) / safePace), MAX_RESCUE_CARDS))
}

function dueTimestamp(card) {
  if (!card?.dueAt) return null
  const timestamp = new Date(card.dueAt).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

/**
 * Rank cards across every deck by immediate study value. This intentionally
 * stays deterministic and explainable: learners can see whether each card was
 * selected because it is overdue, repeatedly missed, or approaching its due
 * date. The returned copies never mutate deck data or schedules.
 */
export function buildRescueQueue(decks, minutes = 10, now = Date.now()) {
  const upcomingCutoff = now + (3 * DAY_MS)
  const candidates = (Array.isArray(decks) ? decks : []).flatMap((deck) => (
    (deck.cards || []).map((card) => {
      const due = dueTimestamp(card)
      const reviewed = Boolean(card.lastReviewedAt)
      const mastery = Math.max(0, Math.min(Number(card.mastery) || 0, 1))
      const lapses = Math.max(0, Number(card.lapses) || 0)
      const easiness = Number(card.easiness ?? 2.5)
      const overdue = due === null || due <= now
      const dueSoon = due !== null && due > now && due <= upcomingCutoff
      const weak = reviewed && (lapses > 0 || mastery < 0.7 || easiness < 2.3)
      const overdueDays = due === null ? 0 : Math.max(0, (now - due) / DAY_MS)
      const reason = weak ? 'Weak spot' : overdue ? (reviewed ? 'Overdue' : 'New card') : 'Due soon'
      const priority = (lapses * 10)
        + ((1 - mastery) * 6)
        + (Math.min(overdueDays, 14) * 1.5)
        + (weak ? 5 : 0)
        + (overdue ? 3 : 0)
        + (dueSoon ? 1 : 0)

      return {
        ...card,
        deckId: deck.id,
        deckTitle: deck.title,
        deckEmoji: deck.emoji,
        rescueReason: reason,
        rescuePriority: priority,
        eligible: overdue || dueSoon || weak,
      }
    })
  ))

  return candidates
    .filter((card) => card.eligible)
    .sort((left, right) => right.rescuePriority - left.rescuePriority
      || String(left.deckTitle).localeCompare(String(right.deckTitle))
      || String(left.id).localeCompare(String(right.id)))
    .slice(0, rescueCardLimit(minutes))
    .map(({ eligible, ...card }) => card)
}

export function rescueBreakdown(cards) {
  return (Array.isArray(cards) ? cards : []).reduce((totals, card) => {
    const key = card.rescueReason || 'Other'
    totals[key] = (totals[key] || 0) + 1
    return totals
  }, {})
}
