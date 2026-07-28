import { roundHalfEven } from './utils.js'
export const DEFAULT_EASINESS = 2.5
export const MIN_EASINESS = 1.3
export const PASS_THRESHOLD = 3
export const MASTERY_HORIZON_DAYS = 60
export const DAY_MS = 86400000

export const GRADES = [
  { value: 1, label: 'Again', hint: 'I forgot it', tone: 'again', shortcut: '1' },
  { value: 3, label: 'Hard', hint: 'Slow to recall', tone: 'hard', shortcut: '2' },
  { value: 4, label: 'Good', hint: 'Recalled it', tone: 'good', shortcut: '3' },
  { value: 5, label: 'Easy', hint: 'Knew it instantly', tone: 'easy', shortcut: '4' },
]

export const EASY_INTERVAL = 4
export const GOOD_INTERVAL = 2;
export const HARD_FACTOR = 1.2
export const MAX_INTERVAL_DAYS = 36500

export function sm2(schedule, grade) {
  if (!Number.isInteger(grade) || grade < 0 || grade > 5) throw new RangeError('Grade must be an integer between 0 and 5.')
  const gap = 5 - grade
  const easiness = Math.max(MIN_EASINESS, schedule.easiness + (0.1 - gap * (0.08 + gap * 0.02)))

  if (grade < PASS_THRESHOLD) {
    return { easiness, repetitions: 0, intervalDays: 0 }
  }

  const repetitions = schedule.repetitions + 1
  let intervalDays

  if (repetitions === 1) {
    intervalDays = grade === 5 ? EASY_INTERVAL : (grade === 4 ? GOOD_INTERVAL : 1)
  } else if (repetitions === 2) {
    intervalDays = { 3: 3, 4: 6, 5: 9 }[grade] ?? 6
  } else {
    const base = schedule.intervalDays * easiness
    intervalDays = roundHalfEven(grade === 3 ? base * (HARD_FACTOR / easiness) : base)
  }

  return { easiness, repetitions, intervalDays: Math.min(intervalDays, MAX_INTERVAL_DAYS) }
}

export function deriveMastery({ intervalDays }) {
  if (!intervalDays || intervalDays <= 0) return 0
  return Math.min(1, Math.log1p(intervalDays) / Math.log1p(MASTERY_HORIZON_DAYS))
}

export function scheduleOf(card) {
  return {
    easiness: Number(card?.easiness ?? DEFAULT_EASINESS),
    repetitions: Number(card?.repetitions ?? 0),
    intervalDays: Number(card?.intervalDays ?? 0),
  }
}

export function formatInterval(days) {
  if (!Number.isFinite(days)) return 'Not scheduled'
  if (!days || days < 1) return '<1d'
  if (days < 30) return `${Math.round(days)}d`
  if (days < 365) return `${Math.round(days / 30)}mo`
  const years = days / 365
  return `${years < 10 ? years.toFixed(1) : Math.round(years)}y`
}

export function previewFor(card, grade) {
  return formatInterval(sm2(scheduleOf(card), grade).intervalDays)
}

export function isDue(card, now = Date.now()) {
  if (!card?.dueAt) return true
  const due = new Date(card.dueAt).getTime()
  return !Number.isFinite(due) || due <= now
}

export function byDueDate(a, b) {
  if (!a.dueAt && !b.dueAt) return (a.position ?? 0) - (b.position ?? 0)
  if (!a.dueAt) return -1
  if (!b.dueAt) return 1
  const aTime = new Date(a.dueAt).getTime()
  const bTime = new Date(b.dueAt).getTime()
  if (!Number.isFinite(aTime)) return -1
  if (!Number.isFinite(bTime)) return 1
  return aTime - bTime
}

export function dueCount(cards = [], now = Date.now()) {
  return cards.filter((card) => isDue(card, now)).length
}

export function nextDueDate(cards = []) {
  const now = Date.now()
  const upcoming = cards
    .map((card) => (card.dueAt ? new Date(card.dueAt).getTime() : null))
    .filter((time) => time !== null && time > now)
    .sort((a, b) => a - b)
  return upcoming.length ? new Date(upcoming[0]) : null
}

export function describeDueDate(date) {
  if (!date) return 'No reviews scheduled'
  const days = Math.ceil((date.getTime() - Date.now()) / DAY_MS)
  if (days <= 1) return 'Next review tomorrow'
  if (days < 30) return `Next review in ${days} days`
  return `Next review ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}
