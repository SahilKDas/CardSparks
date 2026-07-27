import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, USE_MOCK_API } from '../services/api'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [theme, setTheme] = useState(() => localStorage.getItem('cardsparks.theme') || 'light')
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('cardsparks.user')
    return saved ? JSON.parse(saved) : { name: 'Guest learner', email: 'guest@cardsparks.local', guest: true }
  })

  const refreshDecks = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setDecks(await api.listDecks())
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshDecks()
  }, [refreshDecks])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('cardsparks.theme', theme)
  }, [theme])

  const runMutation = useCallback(async (operation) => {
    setError('')
    try {
      const result = await operation()
      const latest = await api.listDecks()
      setDecks(latest)
      return result
    } catch (requestError) {
      setError(requestError.message)
      throw requestError
    }
  }, [])

  const value = useMemo(() => ({
    decks,
    loading,
    error,
    setError,
    refreshDecks,
    createDeck: (input) => runMutation(() => api.createDeck(input)),
    updateDeck: (id, updates) => runMutation(() => api.updateDeck(id, updates)),
    deleteDeck: (id) => runMutation(() => api.deleteDeck(id)),
    addCard: (deckId, card) => runMutation(() => api.addCard(deckId, card)),
    updateCard: (cardId, updates) => runMutation(() => api.updateCard(cardId, updates)),
    deleteCard: (cardId) => runMutation(() => api.deleteCard(cardId)),
    generateCards: (topic, number) => api.generateCards(topic, number),
    generateIntoDeck: (deckId, topic, number) => runMutation(() => api.generateIntoDeck(deckId, topic, number)),
    recordStudy: (deckId, results) => runMutation(() => api.recordStudy(deckId, results)),
    theme,
    toggleTheme: () => setTheme((current) => current === 'light' ? 'dark' : 'light'),
    user,
    authenticate: async (mode, credentials) => {
      const payload = await api.authenticate(mode, credentials)
      const nextUser = payload.user || { name: credentials.name || credentials.email.split('@')[0], email: credentials.email }
      setUser(nextUser)
      localStorage.setItem('cardsparks.user', JSON.stringify(nextUser))
      return payload
    },
    continueAsGuest: () => {
      const guest = { name: 'Guest learner', email: 'guest@cardsparks.local', guest: true }
      setUser(guest)
      localStorage.setItem('cardsparks.user', JSON.stringify(guest))
    },
    logout: () => {
      localStorage.removeItem('cardsparks.auth.token')
      localStorage.removeItem('cardsparks.user')
      setUser({ name: 'Guest learner', email: 'guest@cardsparks.local', guest: true })
    },
    isMockMode: USE_MOCK_API,
  }), [decks, loading, error, refreshDecks, runMutation, theme, user])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}

