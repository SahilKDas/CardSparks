import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, TOKEN_KEY, USE_MOCK_API } from '../services/api'

const AppContext = createContext(null)
const USER_KEY = 'cardsparks.user'

function readStoredUser() {
  const saved = localStorage.getItem(USER_KEY)
  if (!saved) return null
  try {
    return JSON.parse(saved)
  } catch {
    localStorage.removeItem(USER_KEY)
    return null
  }
}

export function AppProvider({ children }) {
  const storedUser = readStoredUser()
  const hasStoredSession = Boolean(localStorage.getItem(TOKEN_KEY) && storedUser && !storedUser.guest)
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(hasStoredSession)
  const [error, setError] = useState('')
  const [theme, setTheme] = useState(() => localStorage.getItem('cardsparks.theme') || 'light')
  const [user, setUser] = useState(storedUser)
  const [isAuthenticated, setIsAuthenticated] = useState(hasStoredSession)

  const refreshDecks = useCallback(async () => {
    if (!isAuthenticated) {
      setDecks([])
      setLoading(false)
      setError('')
      return
    }
    setLoading(true)
    setError('')
    try {
      setDecks(await api.listDecks())
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

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

  const getStudyQueue = useCallback((deckId, limit) => api.getStudyQueue(deckId, limit), [])

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
    getStudyQueue,
    recordStudy: (deckId, results) => runMutation(() => api.recordStudy(deckId, results)),
    theme,
    toggleTheme: () => setTheme((current) => current === 'light' ? 'dark' : 'light'),
    user,
    isAuthenticated,
    authenticate: async (mode, credentials) => {
      const payload = await api.authenticate(mode, credentials)
      const nextUser = payload.user || { name: credentials.name || credentials.email.split('@')[0], email: credentials.email }
      setUser(nextUser)
      setIsAuthenticated(true)
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
      return payload
    },
    logout: () => {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      setDecks([])
      setUser(null)
      setIsAuthenticated(false)
    },
    isMockMode: USE_MOCK_API,
  }), [decks, loading, error, refreshDecks, runMutation, getStudyQueue, theme, user, isAuthenticated])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}
