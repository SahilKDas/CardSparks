import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, AUTH_EXPIRED_EVENT, TOKEN_KEY, USE_MOCK_API } from '../services/api'
import { AppContext } from './useApp'

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

function readStoredSession() {
  const user = readStoredUser()
  const token = localStorage.getItem(TOKEN_KEY)

  if (token && user && !user.guest) return { user, isAuthenticated: true }

  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  return { user: null, isAuthenticated: false }
}

export function AppProvider({ children }) {
  const [session, setSession] = useState(readStoredSession)
  const { user, isAuthenticated } = session
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(isAuthenticated)
  const [error, setError] = useState('')
  const [theme, setTheme] = useState(() => localStorage.getItem('cardsparks.theme') === 'dark' ? 'dark' : 'light')
  const refreshGeneration = useRef(0)

  const clearSession = useCallback(() => {
    refreshGeneration.current += 1
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setDecks([])
    setError('')
    setLoading(false)
    setSession({ user: null, isAuthenticated: false })
  }, [])

  const refreshDecks = useCallback(async () => {
    const generation = refreshGeneration.current + 1
    refreshGeneration.current = generation
    if (!isAuthenticated) {
      setDecks([])
      setLoading(false)
      setError('')
      return
    }
    setLoading(true)
    setError('')
    try {
      const latest = await api.listDecks()
      if (generation === refreshGeneration.current) setDecks(latest)
    } catch (requestError) {
      if (generation !== refreshGeneration.current) return
      if (requestError.status === 401) {
        clearSession()
        return
      }
      setError(requestError.message)
    } finally {
      if (generation === refreshGeneration.current) setLoading(false)
    }
  }, [clearSession, isAuthenticated])

  useEffect(() => {
    refreshDecks()
  }, [refreshDecks])

  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, clearSession)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, clearSession)
  }, [clearSession])

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
      if (requestError.status === 401) {
        clearSession()
        throw requestError
      }
      setError(requestError.message)
      throw requestError
    }
  }, [clearSession])

  const getStudyQueue = useCallback((deckId, limit) => api.getStudyQueue(deckId, limit), [])
  const getStudySettings = useCallback(() => api.getStudySettings(), [])
  const updateStudySettings = useCallback((updates) => api.updateStudySettings(updates), [])
  const listCommunityDecks = useCallback(() => api.listCommunityDecks(), [])
  const getSharedDeck = useCallback((token) => api.getSharedDeck(token), [])

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
    generateCardsFromNotes: (sourceText, number) => api.generateCardsFromNotes(sourceText, number),
    generateIntoDeck: (deckId, topic, number) => runMutation(() => api.generateIntoDeck(deckId, topic, number)),
    getStudyQueue,
    recordStudy: (deckId, results) => runMutation(() => api.recordStudy(deckId, results)),
    getStudyFeedback: (deckId, results) => api.getStudyFeedback(deckId, results),
    getStudySettings,
    updateStudySettings,
    setDeckSharing: (deckId, isPublic) => runMutation(() => api.setDeckSharing(deckId, isPublic)),
    listCommunityDecks,
    getSharedDeck,
    duplicateSharedDeck: (token) => runMutation(() => api.duplicateSharedDeck(token)),
    theme,
    toggleTheme: () => setTheme((current) => current === 'light' ? 'dark' : 'light'),
    user,
    isAuthenticated,
    authenticate: async (mode, credentials) => {
      const payload = await api.authenticate(mode, credentials)
      if (!localStorage.getItem(TOKEN_KEY)) throw new Error('The server did not return an authentication token.')
      const nextUser = payload.user || { name: credentials.name || credentials.email.split('@')[0], email: credentials.email }
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
      setLoading(true)
      setSession({ user: nextUser, isAuthenticated: true })
      return payload
    },
    logout: () => {
      clearSession()
    },
    isMockMode: USE_MOCK_API,
  }), [decks, loading, error, refreshDecks, runMutation, getStudyQueue, getStudySettings, updateStudySettings, listCommunityDecks, getSharedDeck, theme, user, isAuthenticated, clearSession])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
