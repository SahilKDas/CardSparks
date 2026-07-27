import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DeckCard from '../components/DeckCard'
import { EmptyState, ErrorBanner, Spinner } from '../components/Feedback'
import { Icon } from '../components/Icons'
import { useApp } from '../context/AppContext'

export default function Dashboard() {
  const { decks, loading, error, setError, refreshDecks, user } = useApp()
  const [search, setSearch] = useState('')
  const filteredDecks = useMemo(() => decks.filter((deck) => deck.title.toLowerCase().includes(search.toLowerCase())), [decks, search])
  const totalCards = decks.reduce((sum, deck) => sum + (deck.cards?.length || 0), 0)
  const masteredCards = decks.reduce((sum, deck) => sum + (deck.cards?.filter((card) => (card.mastery || 0) >= 0.8).length || 0), 0)

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

      <section className="quick-stats" aria-label="Study overview">
        <div><span className="stat-icon coral"><Icon name="cards" /></span><p><strong>{decks.length}</strong><span>Active decks</span></p></div>
        <div><span className="stat-icon violet"><Icon name="sparkles" /></span><p><strong>{totalCards}</strong><span>Cards to explore</span></p></div>
        <div><span className="stat-icon green"><Icon name="trophy" /></span><p><strong>{masteredCards}</strong><span>Cards mastered</span></p></div>
      </section>

      <ErrorBanner message={error} onRetry={refreshDecks} onDismiss={() => setError('')} />

      <section className="deck-section">
        <div className="section-heading">
          <div><h2>Your decks</h2><span>{decks.length} total</span></div>
          <label className="search-field"><Icon name="search" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search decks" /><span className="shortcut">⌘ K</span></label>
        </div>

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
            title={search ? 'No decks match that search' : 'Your first spark starts here'}
            message={search ? 'Try a different title or clear the search.' : 'Create a deck manually or turn any topic into cards with AI.'}
            action={search ? <button className="button button-secondary" type="button" onClick={() => setSearch('')}>Clear search</button> : <Link className="button button-primary" to="/decks/new"><Icon name="plus" size={17} /> Create your first deck</Link>}
          />
        )}
      </section>
    </div>
  )
}

