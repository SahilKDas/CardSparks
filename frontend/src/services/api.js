import { demoDecks } from '../data/demoData'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')
export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false'

const DECKS_KEY = 'cardsparks.demo.decks'
const TOKEN_KEY = 'cardsparks.auth.token'
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

function normalizeDeck(deck) {
  const cards = deck.cards || deck.flashcards || []
  return {
    ...deck,
    id: String(deck.id),
    title: deck.title || deck.name || 'Untitled deck',
    description: deck.description || '',
    lastStudied: deck.lastStudied || deck.last_studied || null,
    createdAt: deck.createdAt || deck.created_at,
    updatedAt: deck.updatedAt || deck.updated_at,
    cards: cards.map((card) => ({
      ...card,
      id: String(card.id),
      front: card.front || card.question || '',
      back: card.back || card.answer || '',
      mastery: Number(card.mastery ?? 0),
    })),
  }
}

async function request(path, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  const token = localStorage.getItem(TOKEN_KEY)

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Token ${token}` } : {}),
        ...options.headers,
      },
    })

    const payload = response.status === 204 ? null : await response.json().catch(() => null)
    if (!response.ok) {
      const message = payload?.detail || payload?.message || Object.values(payload || {})[0] || `Request failed (${response.status})`
      throw new Error(Array.isArray(message) ? message[0] : message)
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
    return { id: uid('generated'), front, back, mastery: 0 }
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
      cards: (input.cards || []).map((card) => ({ ...card, id: uid('card'), mastery: card.mastery || 0 })),
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
    const nextCard = { ...card, id: uid('card'), mastery: 0 }
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
  async generateIntoDeck(deckId, topic, number) {
    const cards = await mockGenerate(topic, number)
    const deck = await this.getDeck(deckId)
    return this.updateDeck(deckId, { cards: [...deck.cards, ...cards.map((card) => ({ ...card, id: uid('card') }))] })
  },
  async recordStudy(deckId, results) {
    const deck = await this.getDeck(deckId)
    const ratingMap = new Map(results.map((result) => [String(result.cardId), result.correct]))
    const cards = deck.cards.map((card) => {
      if (!ratingMap.has(String(card.id))) return card
      const adjustment = ratingMap.get(String(card.id)) ? 0.2 : -0.12
      return { ...card, mastery: Math.max(0, Math.min(1, (card.mastery || 0) + adjustment)) }
    })
    return this.updateDeck(deckId, { cards, lastStudied: new Date().toISOString() })
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
    return (data.results || data).map(normalizeDeck)
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
    return { deck: await this.getDeck(deckId), card: addedCard }
  },
  async updateCard(cardId, updates) {
    const card = await request(`/api/cards/${cardId}/`, { method: 'PATCH', body: JSON.stringify(updates) })
    return { card }
  },
  async deleteCard(cardId) {
    return request(`/api/cards/${cardId}/`, { method: 'DELETE' })
  },
  async generateCards(topic, number) {
    const payload = await request('/api/decks/generate/', {
      method: 'POST',
      body: JSON.stringify({ topic, num_cards: number, preview: true }),
    })
    return (payload.cards || payload.flashcards || []).map((card) => ({
      ...card,
      id: String(card.id || uid('preview')),
      front: card.front || card.question || '',
      back: card.back || card.answer || '',
      mastery: 0,
    }))
  },
  async generateIntoDeck(deckId, topic, number) {
    const payload = await request(`/api/decks/${deckId}/generate/`, {
      method: 'POST',
      body: JSON.stringify({ topic, num_cards: number }),
    })
    return normalizeDeck(payload.deck || payload)
  },
  async recordStudy(deckId, results) {
    try {
      const payload = await request(`/api/decks/${deckId}/study-sessions/`, {
        method: 'POST',
        body: JSON.stringify({ results }),
      })
      return normalizeDeck(payload.deck || payload)
    } catch (error) {
      if (error.message.includes('404') || error.message.includes('405')) return this.getDeck(deckId)
      throw error
    }
  },
  async authenticate(mode, credentials) {
    const payload = await request(`/api/auth/${mode === 'signup' ? 'signup' : 'login'}/`, {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
    const token = payload.token || payload.key || payload.access
    if (token) localStorage.setItem(TOKEN_KEY, token)
    return payload
  },
}

export const api = USE_MOCK_API ? mockApi : realApi

