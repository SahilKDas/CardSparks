import { api, USE_MOCK_API, request } from './api'
import { isDue } from '../lib/sm2'

const MATURE_INTERVAL_DAYS = 21

function isoDay(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function denseDays(start, count, counts) {
  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(start)
    date.setDate(date.getDate() + offset)
    const key = isoDay(date)
    return { date: key, count: counts[key] || 0 }
  })
}

// Demo mode has no server-side review log. Totals, backlog and forecast are
// computed from real local data; the heatmap is synthetic so the page has
// something to show.
async function mockStats({ days = 365, horizon = 30 } = {}) {
  const decks = await api.listDecks()
  const cards = decks.flatMap((deck) => deck.cards)
  const now = Date.now()

  const history = {}
  let seed = 7
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date()
    date.setDate(date.getDate() - offset)
    seed = (seed * 1103515245 + 12345) % 2147483648
    const roll = seed % 100
    if (roll > 38) history[isoDay(date)] = 3 + (seed % 22)
  }

  const start = new Date()
  start.setDate(start.getDate() - (days - 1))
  const heatmap = denseDays(start, days, history)

  const upcoming = {}
  cards.forEach((card) => {
    if (!card.dueAt) return
    const due = new Date(card.dueAt)
    if (due.getTime() <= now) return
    const key = isoDay(due)
    upcoming[key] = (upcoming[key] || 0) + 1
  })

  const reviews = heatmap.reduce((sum, day) => sum + day.count, 0)
  const recentWeeks = Array.from({ length: 8 }, (_, week) => {
    const slice = heatmap.slice(-(8 - week) * 7, -(7 - week) * 7 || undefined)
    const weeklyReviews = slice.reduce((sum, day) => sum + day.count, 0)
    return {
      date: slice[0]?.date || isoDay(new Date()),
      reviews: weeklyReviews,
      retention: weeklyReviews ? 0.82 + (week % 4) * 0.03 : null,
      active_days: slice.filter((day) => day.count > 0).length,
    }
  })
  const weakestDecks = decks.map((deck) => ({
    id: deck.id,
    title: deck.title,
    emoji: deck.emoji,
    reviews: deck.cards.reduce((sum, card) => sum + Math.max(1, card.repetitions || 0), 0),
    retention: deck.cards.length
      ? deck.cards.reduce((sum, card) => sum + card.mastery, 0) / deck.cards.length
      : null,
  })).filter((deck) => deck.retention !== null).sort((left, right) => left.retention - right.retention).slice(0, 5)
  const difficultCards = cards.map((card) => ({
    id: card.id,
    deck_id: decks.find((deck) => deck.cards.some((item) => item.id === card.id))?.id,
    deck__title: decks.find((deck) => deck.cards.some((item) => item.id === card.id))?.title,
    front: card.front,
    lapses: card.lapses || 0,
    failed_reviews: card.lapses || 0,
    review_count: card.repetitions || 0,
    mastery: card.mastery,
  })).sort((left, right) => right.lapses - left.lapses || left.mastery - right.mastery).slice(0, 8)

  return {
    totals: {
      reviews,
      cards: cards.length,
      mature_cards: cards.filter((card) => card.intervalDays >= MATURE_INTERVAL_DAYS).length,
      lapses: cards.reduce((sum, card) => sum + (card.lapses || 0), 0),
      decks: decks.length,
    },
    retention: {
      all_time: 0.87,
      recent: 0.91,
      recent_reviews: heatmap.slice(-30).reduce((sum, day) => sum + day.count, 0),
      window_days: 30,
    },
    streak: streaksFrom(heatmap),
    backlog: cards.filter((card) => isDue(card, now)).length,
    heatmap,
    forecast: denseDays(new Date(), horizon, upcoming),
    retention_trend: recentWeeks.map(({ date, reviews: count, retention }) => ({ date, reviews: count, retention })),
    streak_history: recentWeeks.map(({ date, reviews: count, active_days }) => ({ date, reviews: count, active_days })),
    weakest_decks: weakestDecks,
    difficult_cards: difficultCards,
  }
}

function streaksFrom(series) {
  const active = new Set(series.filter((day) => day.count > 0).map((day) => day.date))
  const cursor = new Date()
  if (!active.has(isoDay(cursor))) cursor.setDate(cursor.getDate() - 1)

  let current = 0
  while (active.has(isoDay(cursor))) {
    current += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  let longest = 0
  let run = 0
  series.forEach((day) => {
    run = day.count > 0 ? run + 1 : 0
    longest = Math.max(longest, run)
  })

  return { current, longest }
}

function validateStats(payload) {
  const valid = payload
    && payload.totals
    && payload.retention
    && payload.streak
    && Array.isArray(payload.heatmap)
    && Array.isArray(payload.forecast)
    && Array.isArray(payload.retention_trend)
    && Array.isArray(payload.streak_history)
    && Array.isArray(payload.weakest_decks)
    && Array.isArray(payload.difficult_cards)
    && typeof payload.backlog === 'number'
  if (!valid) throw new Error('The server returned invalid progress data.')
  return payload
}

export async function getStats({ days = 365, horizon = 30 } = {}) {
  const payload = USE_MOCK_API
    ? await mockStats({ days, horizon })
    : await request(`/api/stats/?days=${days}&horizon=${horizon}`)
  return validateStats(payload)
}
