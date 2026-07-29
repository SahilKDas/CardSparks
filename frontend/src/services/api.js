import { demoDecks } from '../data/demoData'
import {
  DAY_MS,
  DEFAULT_EASINESS,
  PASS_THRESHOLD,
  byDueDate,
  deriveMastery,
  dueCount,
  isDue,
  scheduleOf,
  sm2,
} from '../lib/sm2'
import { buildMockCardsFromNotes, buildMockStudyFeedback } from '../lib/studyFeatures'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')
export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false'

const DECKS_KEY = 'cardsparks.demo.decks'
export const TOKEN_KEY = 'cardsparks.auth.token'
export const AUTH_EXPIRED_EVENT = 'cardsparks:auth-expired'
const wait = (ms = 320) => new Promise((resolve) => setTimeout(resolve, ms))
const uid = (prefix = 'item') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function readDecks() {
  const saved = localStorage.getItem(DECKS_KEY)
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch {
      localStorage.removeItem(DECKS_KEY)
    }
  }
  const initial = structuredClone(demoDecks)
  localStorage.setItem(DECKS_KEY, JSON.stringify(initial))
  return initial
}

function writeDecks(decks) {
  localStorage.setItem(DECKS_KEY, JSON.stringify(decks))
  return decks
}

function firstErrorMessage(value) {
  if (typeof value === 'string' && value.trim()) return value
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = firstErrorMessage(item)
      if (message) return message
    }
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      const message = firstErrorMessage(item)
      if (message) return message
    }
  }
  return ''
}

export class ApiError extends Error {
  constructor(message, status, payload = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function normalizeCard(card) {
  const mastery = finiteNumber(card.mastery, 0)
  return {
    ...card,
    id: String(card.id),
    front: String(card.front || card.question || ''),
    back: String(card.back || card.answer || ''),
    mastery: Math.max(0, Math.min(1, mastery)),
    position: Math.max(0, finiteNumber(card.position, 0)),
    easiness: Math.max(1.3, finiteNumber(card.easiness, DEFAULT_EASINESS)),
    repetitions: Math.max(0, finiteNumber(card.repetitions, 0)),
    intervalDays: Math.max(0, finiteNumber(card.intervalDays ?? card.interval_days, 0)),
    lapses: Math.max(0, finiteNumber(card.lapses, 0)),
    dueAt: card.dueAt || card.due_at || null,
    lastReviewedAt: card.lastReviewedAt || card.last_reviewed_at || null,
  }
}

function normalizeDeck(deck) {
  const rawCards = deck.cards || deck.flashcards || []
  const cards = Array.isArray(rawCards)
    ? rawCards.filter((card) => card && typeof card === 'object').map(normalizeCard)
    : []
  const reportedDue = deck.dueCount ?? deck.due_count
  return {
    ...deck,
    id: String(deck.id),
    title: String(deck.title || deck.name || 'Untitled deck'),
    description: String(deck.description || ''),
    folder: String(deck.folder || ''),
    tags: Array.isArray(deck.tags) ? deck.tags.map(String).filter(Boolean).slice(0, 10) : [],
    isPublic: Boolean(deck.isPublic ?? deck.is_public),
    shareToken: String(deck.shareToken || deck.share_token || ''),
    author: String(deck.author || ''),
    lastStudied: deck.lastStudied || deck.last_studied || null,
    createdAt: deck.createdAt || deck.created_at,
    updatedAt: deck.updatedAt || deck.updated_at,
    cards,
    dueCount: Number.isFinite(Number(reportedDue)) ? Math.max(0, Number(reportedDue)) : dueCount(cards),
  }
}

export async function request(path, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8500)
  const token = localStorage.getItem(TOKEN_KEY)
  const { skipAuth = false, ...fetchOptions } = options

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(!skipAuth && token ? { Authorization: `Token ${token}` } : {}),
        ...fetchOptions.headers,
      },
    })

    const payload = response.status === 204 ? null : await response.json().catch(() => null)
    if (!response.ok) {
      if (response.status === 401 && !skipAuth) window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
      const message = firstErrorMessage(payload) || `Request failed (${response.status})`
      throw new ApiError(message, response.status, payload)
    }
    return payload
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The server took too long to respond. Please try again.')
    if (error instanceof TypeError) throw new Error(`Could not reach the CardSparks API at ${API_BASE_URL}.`)
    throw error
  } finally {
    clearTimeout(timer)
  }
}

const promptTemplates = [
  (topic) => [`What is the central idea behind ${topic}?`, `${topic} is best understood by identifying its core purpose, main components, and how those components relate.`],
  (topic) => [`Why is ${topic} important?`, `It provides a useful framework for explaining related concepts and applying them to real situations.`],
  (topic) => [`Name a key principle of ${topic}.`, `Break the topic into smaller ideas, connect cause and effect, and test understanding with examples.`],
  (topic) => [`What is a common misconception about ${topic}?`, `A common mistake is memorizing isolated facts without understanding the relationships between them.`],
  (topic) => [`Give a practical example involving ${topic}.`, `Choose a familiar scenario, identify the relevant rule or concept, then work through the result step by step.`],
  (topic) => [`How can you check your understanding of ${topic}?`, `Explain it in your own words, apply it to a new example, and identify any step you cannot yet justify.`],
  (topic) => [`What should you learn first about ${topic}?`, `Start with essential vocabulary and the broad mental model before adding exceptions or advanced details.`],
  (topic) => [`How does ${topic} connect to prior knowledge?`, `Connect new terms to familiar concepts, then compare what is similar, different, and causally related.`],
  (topic) => [`What is one useful way to organize ${topic}?`, `Group the material into definitions, mechanisms, examples, and exceptions so each idea has a clear role.`],
  (topic) => [`What question should you ask when studying ${topic}?`, `Ask what changes, what stays constant, and what evidence would distinguish one explanation from another.`],
  (topic) => [`Summarize ${topic} in one sentence.`, `${topic} is a connected set of ideas that becomes easier to recall when organized around meaning and application.`],
  (topic) => [`What is the best next step after reviewing ${topic}?`, `Attempt retrieval without notes, rate the result honestly, and revisit only the parts you missed.`],
]

async function mockGenerate(topic, number) {
  await wait(700)
  const count = Math.max(1, Math.min(Number(number) || 8, 20))
  return Array.from({ length: count }, (_, index) => {
    const [front, back] = promptTemplates[index % promptTemplates.length](topic)
    return normalizeCard({ id: uid('generated'), front, back, mastery: 0 })
  })
}

const mockApi = {
  async listDecks() {
    await wait()
    return readDecks().map(normalizeDeck)
  },
  async getDeck(id) {
    await wait(180)
    const deck = readDecks().find((item) => String(item.id) === String(id))
    if (!deck) throw new Error('We could not find that deck.')
    return normalizeDeck(deck)
  },
  async createDeck(input) {
    await wait(420)
    const now = new Date().toISOString()
    const deck = normalizeDeck({
      ...input,
      id: uid('deck'),
      createdAt: now,
      updatedAt: now,
      lastStudied: null,
      cards: (input.cards || []).map((card, index) => normalizeCard({ ...card, id: uid('card'), position: index })),
    })
    writeDecks([deck, ...readDecks()])
    return deck
  },
  async updateDeck(id, updates) {
    await wait(260)
    let updated
    const decks = readDecks().map((deck) => {
      if (String(deck.id) !== String(id)) return deck
      updated = normalizeDeck({ ...deck, ...updates, updatedAt: new Date().toISOString() })
      return updated
    })
    if (!updated) throw new Error('We could not find that deck.')
    writeDecks(decks)
    return updated
  },
  async deleteDeck(id) {
    await wait(260)
    writeDecks(readDecks().filter((deck) => String(deck.id) !== String(id)))
  },
  async addCard(deckId, card) {
    const deck = await this.getDeck(deckId)
    const position = deck.cards.reduce((max, item) => Math.max(max, item.position ?? 0), -1) + 1
    const nextCard = normalizeCard({ ...card, id: uid('card'), position })
    const updated = await this.updateDeck(deckId, { cards: [...deck.cards, nextCard] })
    return { deck: updated, card: nextCard }
  },
  async updateCard(cardId, updates) {
    await wait(220)
    let changedDeck
    let changedCard
    const decks = readDecks().map((deck) => {
      if (!deck.cards?.some((card) => String(card.id) === String(cardId))) return deck
      const cards = deck.cards.map((card) => {
        if (String(card.id) !== String(cardId)) return card
        changedCard = { ...card, ...updates }
        return changedCard
      })
      changedDeck = normalizeDeck({ ...deck, cards, updatedAt: new Date().toISOString() })
      return changedDeck
    })
    if (!changedDeck) throw new Error('We could not find that card.')
    writeDecks(decks)
    return { deck: changedDeck, card: changedCard }
  },
  async deleteCard(cardId) {
    await wait(220)
    let changedDeck
    const decks = readDecks().map((deck) => {
      if (!deck.cards?.some((card) => String(card.id) === String(cardId))) return deck
      changedDeck = normalizeDeck({
        ...deck,
        cards: deck.cards.filter((card) => String(card.id) !== String(cardId)),
        updatedAt: new Date().toISOString(),
      })
      return changedDeck
    })
    if (!changedDeck) throw new Error('We could not find that card.')
    writeDecks(decks)
    return changedDeck
  },
  generateCards: mockGenerate,
  async generateCardsFromNotes(sourceText, number) {
    await wait(700)
    return buildMockCardsFromNotes(sourceText, number).map((card) =>
      normalizeCard({ ...card, id: uid('generated'), mastery: 0 }))
  },
  async generateIntoDeck(deckId, topic, number) {
    const cards = await mockGenerate(topic, number)
    const deck = await this.getDeck(deckId)
    const start = deck.cards.reduce((max, item) => Math.max(max, item.position ?? 0), -1) + 1
    return this.updateDeck(deckId, {
      cards: [
        ...deck.cards,
        ...cards.map((card, index) => normalizeCard({ ...card, id: uid('card'), position: start + index })),
      ],
    })
  },
  async getStudyQueue(deckId, limit = 100) {
    await wait(200)
    const deck = await this.getDeck(deckId)
    const now = Date.now()
    return deck.cards.filter((card) => isDue(card, now)).sort(byDueDate).slice(0, limit)
  },
  async recordStudy(deckId, results) {
    const deck = await this.getDeck(deckId)
    const grades = new Map(results.map((result) => [String(result.cardId), result.grade]))
    const now = new Date()

    const cards = deck.cards.map((card) => {
      if (!grades.has(String(card.id))) return card
      const grade = grades.get(String(card.id))
      const next = sm2(scheduleOf(card), grade)
      const lapsed = grade < PASS_THRESHOLD && card.repetitions > 0
      return {
        ...card,
        easiness: next.easiness,
        repetitions: next.repetitions,
        intervalDays: next.intervalDays,
        lapses: card.lapses + (lapsed ? 1 : 0),
        dueAt: new Date(now.getTime() + next.intervalDays * DAY_MS).toISOString(),
        lastReviewedAt: now.toISOString(),
        mastery: deriveMastery(next),
      }
    })

    return this.updateDeck(deckId, { cards, lastStudied: now.toISOString() })
  },
  async getStudyFeedback(deckId, results) {
    await wait(520)
    const deck = await this.getDeck(deckId)
    return buildMockStudyFeedback(results, deck.cards)
  },
  async setDeckSharing(deckId, isPublic) {
    const deck = await this.getDeck(deckId)
    return this.updateDeck(deckId, {
      isPublic,
      shareToken: deck.shareToken || uid('shared'),
    })
  },
  async listCommunityDecks() {
    await wait(220)
    const learnerDecks = readDecks().filter((deck) => deck.isPublic).map(normalizeDeck)
    const curated = demoDecks.map((deck) => normalizeDeck({
      ...deck,
      shareToken: `community-${deck.id}`,
      isPublic: true,
      author: 'CardSparks',
    }))
    return [...learnerDecks, ...curated]
  },
  async getSharedDeck(token) {
    const decks = await this.listCommunityDecks()
    const deck = decks.find((item) => item.shareToken === String(token))
    if (!deck) throw new Error('That shared deck is private or no longer available.')
    return deck
  },
  async duplicateSharedDeck(token) {
    const source = await this.getSharedDeck(token)
    return this.createDeck({
      ...source,
      id: undefined,
      title: `${source.title} (Copy)`,
      isPublic: false,
      shareToken: '',
      cards: source.cards.map(({ front, back }) => ({ front, back })),
    })
  },
  async authenticate(mode, credentials) {
    await wait(500)
    if (!credentials.email || !credentials.password) throw new Error('Email and password are required.')
    const user = { name: credentials.name || credentials.email.split('@')[0], email: credentials.email }
    localStorage.setItem(TOKEN_KEY, 'demo-token')
    return { token: 'demo-token', user, mode }
  },
}

const realApi = {
  async listDecks() {
    const data = await request('/api/decks/')
    const decks = Array.isArray(data) ? data : data?.results
    if (!Array.isArray(decks)) throw new Error('The server returned an invalid deck list.')
    return decks.map(normalizeDeck)
  },
  async getDeck(id) {
    return normalizeDeck(await request(`/api/decks/${id}/`))
  },
  async createDeck(input) {
    const payload = await request('/api/decks/', { method: 'POST', body: JSON.stringify(input) })
    return normalizeDeck(payload)
  },
  async updateDeck(id, updates) {
    return normalizeDeck(await request(`/api/decks/${id}/`, { method: 'PATCH', body: JSON.stringify(updates) }))
  },
  async deleteDeck(id) {
    return request(`/api/decks/${id}/`, { method: 'DELETE' })
  },
  async addCard(deckId, card) {
    const addedCard = await request(`/api/decks/${deckId}/cards/`, { method: 'POST', body: JSON.stringify(card) })
    return { deck: await this.getDeck(deckId), card: normalizeCard(addedCard) }
  },
  async updateCard(cardId, updates) {
    const card = await request(`/api/cards/${cardId}/`, { method: 'PATCH', body: JSON.stringify(updates) })
    return { card: normalizeCard(card) }
  },
  async deleteCard(cardId) {
    return request(`/api/cards/${cardId}/`, { method: 'DELETE' })
  },
  async generateCards(topic, number) {
    const payload = await request('/api/decks/generate/', {
      method: 'POST',
      body: JSON.stringify({ topic, num_cards: number, preview: true }),
    })
    return (payload.cards || payload.flashcards || []).map((card) =>
      normalizeCard({ ...card, id: card.id || uid('preview') }))
  },
  async generateCardsFromNotes(sourceText, number) {
    const payload = await request('/api/decks/generate/', {
      method: 'POST',
      body: JSON.stringify({ source_text: sourceText, num_cards: number }),
    })
    return (payload.cards || payload.flashcards || []).map((card) =>
      normalizeCard({ ...card, id: card.id || uid('preview') }))
  },
  async generateIntoDeck(deckId, topic, number) {
    const payload = await request(`/api/decks/${deckId}/generate/`, {
      method: 'POST',
      body: JSON.stringify({ topic, num_cards: number }),
    })
    return normalizeDeck(payload.deck || payload)
  },
  async getStudyQueue(deckId, limit = 20) {
    const payload = await request(`/api/decks/${deckId}/study-queue/?limit=${limit}`)
    const cards = payload.cards || payload.flashcards || (Array.isArray(payload) ? payload : [])
    return cards.map(normalizeCard)
  },
  async recordStudy(deckId, results) {
    const payload = await request(`/api/decks/${deckId}/study-sessions/`, {
      method: 'POST',
      body: JSON.stringify({ results }),
    })
    return normalizeDeck(payload.deck || payload)
  },
  async getStudyFeedback(deckId, results) {
    const payload = await request(`/api/decks/${deckId}/study-feedback/`, {
      method: 'POST',
      body: JSON.stringify({ results }),
    })
    const feedback = String(payload?.feedback || '').trim()
    if (!feedback) throw new Error('The study coach returned no feedback. Please try again.')
    return feedback.slice(0, 300)
  },
  async setDeckSharing(deckId, isPublic) {
    return normalizeDeck(await request(`/api/decks/${deckId}/sharing/`, {
      method: 'POST',
      body: JSON.stringify({ is_public: isPublic }),
    }))
  },
  async listCommunityDecks() {
    const payload = await request('/api/community/', { skipAuth: true })
    return (Array.isArray(payload) ? payload : []).map(normalizeDeck)
  },
  async getSharedDeck(token) {
    return normalizeDeck(await request(`/api/shared-decks/${token}/`, { skipAuth: true }))
  },
  async duplicateSharedDeck(token) {
    return normalizeDeck(await request(`/api/shared-decks/${token}/duplicate/`, {
      method: 'POST',
      body: JSON.stringify({}),
    }))
  },
  async authenticate(mode, credentials) {
    localStorage.removeItem(TOKEN_KEY)
    const payload = await request(`/api/auth/${mode === 'signup' ? 'signup' : 'login'}/`, {
      method: 'POST',
      body: JSON.stringify(credentials),
      skipAuth: true,
    })
    const token = payload.token || payload.key || payload.access
    if (token) localStorage.setItem(TOKEN_KEY, token)
    return payload
  },
}

export const api = USE_MOCK_API ? mockApi : realApi
