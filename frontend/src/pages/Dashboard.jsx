import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import DeckCard from '../components/DeckCard'
import { EmptyState, ErrorBanner, Spinner } from '../components/Feedback'
import { Icon } from '../components/Icons'
import { useApp } from '../context/useApp'
import { buildTodaySummary } from '../lib/dashboard'
import { deckMatches } from '../lib/organize'
import { getStats } from '../services/stats'

export default function Dashboard() {
  const { decks, loading, error, setError, refreshDecks, user } = useApp()
  const [search, setSearch] = useState('')
  const [folder, setFolder] = useState('all')
  const [streak, setStreak] = useState(null)
  const searchInput = useRef(null)
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  const filteredDecks = useMemo(() => {
    return decks.filter((deck) => deckMatches(deck, search, folder))
  }, [decks, search, folder])
  const folders = useMemo(() => [...new Set(decks.map((deck) => deck.folder).filter(Boolean))].sort(), [decks])
  const totalCards = decks.reduce((sum, deck) => sum + (deck.cards?.length || 0), 0)
  const masteredCards = decks.reduce((sum, deck) => sum + (deck.cards?.filter((card) => (card.mastery || 0) >= 0.8).length || 0), 0)
  const today = useMemo(() => buildTodaySummary(decks), [decks])

  useEffect(() => {
    const focusSearch = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInput.current?.focus()
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  useEffect(() => {
    let cancelled = false

    // Progress is supplemental on this screen. A stats outage should never
    // hide the locally available due queue, so failure leaves the streak as an
    // unobtrusive dash instead of replacing the dashboard with an error state.
    getStats({ days: 30, horizon: 7 })
      .then((payload) => {
        if (!cancelled) setStreak(payload.streak.current)
      })
      .catch(() => {
        if (!cancelled) setStreak(null)
      })

    return () => { cancelled = true }
  }, [])

  return (
    <div className="page dashboard-page">
      <section className="dashboard-hero">
        <div>
          <span className="eyebrow"><Icon name="sparkles" size={14} /> Your learning space</span>
          <h1>Good to see you, <em>{user?.name?.split(' ')[0] || 'learner'}.</em></h1>
          <p>What are we getting curious about today?</p>
        </div>
        <Link className="button button-primary hero-create" to="/decks/new"><Icon name="plus" size={18} /> Create a deck</Link>
      </section>

      <section className="today-panel" aria-labelledby="today-heading">
        <div className="today-copy">
          <span className="eyebrow"><Icon name="clock" size={14} /> Daily plan</span>
          <h2 id="today-heading">Today&apos;s study session</h2>
          <p>{today.total ? `${today.total} cards are ready across ${today.perDeck.length} ${today.perDeck.length === 1 ? 'deck' : 'decks'}.` : 'You are caught up. New cards will appear here when they are ready.'}</p>
          <div className="today-metrics" aria-label="Today's study totals">
            <span><strong>{today.reviews}</strong> reviews</span>
            <span><strong>{today.newCards}</strong> new cards</span>
            <span><strong>{streak ?? '—'}</strong> day streak</span>
            <span><strong>{today.estimatedMinutes}</strong> estimated min</span>
          </div>
        </div>
        <div className="today-action">
          {today.firstDeckId ? (
            <Link className="button button-primary" to={`/decks/${today.firstDeckId}/study`}><Icon name="play" size={17} /> Start today&apos;s session</Link>
          ) : (
            <span className="today-complete"><Icon name="check" size={18} /> All caught up</span>
          )}
          {today.perDeck[0] && <small>Starting with {today.perDeck[0].title} · {today.perDeck[0].total} cards</small>}
        </div>
      </section>

      <section className="quick-stats" aria-label="Study overview">
        <div><span className="stat-icon coral"><Icon name="cards" /></span><p><strong>{decks.length}</strong><span>Active decks</span></p></div>
        <div><span className="stat-icon violet"><Icon name="sparkles" /></span><p><strong>{totalCards}</strong><span>Cards to explore</span></p></div>
        <div><span className="stat-icon green"><Icon name="trophy" /></span><p><strong>{masteredCards}</strong><span>Cards mastered</span></p></div>
      </section>

      <ErrorBanner message={error} onRetry={refreshDecks} onDismiss={() => setError('')} />

      <section className="deck-section">
        <div className="section-heading">
          <div><h2>Your decks</h2><span>{decks.length} total</span></div>
          <label className="search-field"><Icon name="search" size={18} /><input ref={searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search decks, tags, or cards" aria-label="Search decks, tags, or cards" /><span className="shortcut">{isMac ? '⌘ K' : 'Ctrl K'}</span></label>
        </div>
        {folders.length > 0 && <div className="folder-filters" aria-label="Filter decks by folder"><button type="button" className={folder === 'all' ? 'active' : ''} onClick={() => setFolder('all')}>All folders</button>{folders.map((item) => <button key={item} type="button" className={folder === item ? 'active' : ''} onClick={() => setFolder(item)}>{item}</button>)}</div>}

        {loading ? <Spinner /> : filteredDecks.length ? (
          <div className="deck-grid">
            {filteredDecks.map((deck) => <DeckCard key={deck.id} deck={deck} />)}
            {!search && (
              <Link to="/decks/new" className="new-deck-card">
                <span><Icon name="plus" size={22} /></span>
                <strong>Create another deck</strong>
                <p>Start from scratch or let AI spark the first draft.</p>
              </Link>
            )}
          </div>
        ) : (
          <EmptyState
            title={search || folder !== 'all' ? 'No decks match those filters' : 'Your first spark starts here'}
            message={search || folder !== 'all' ? 'Try another search or show every folder.' : 'Create a deck manually or turn any topic into cards with AI.'}
            action={search || folder !== 'all' ? <button className="button button-secondary" type="button" onClick={() => { setSearch(''); setFolder('all') }}>Clear filters</button> : <Link className="button button-primary" to="/decks/new"><Icon name="plus" size={17} /> Create your first deck</Link>}
          />
        )}
      </section>
    </div>
  )
}

