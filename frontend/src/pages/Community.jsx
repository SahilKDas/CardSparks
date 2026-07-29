import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorBanner, Spinner } from '../components/Feedback'
import { Icon } from '../components/Icons'
import { useApp } from '../context/useApp'

export default function Community() {
  const { listCommunityDecks } = useApp()
  const [decks, setDecks] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    listCommunityDecks()
      .then((payload) => {
        if (!cancelled) {
          setDecks(payload)
          setStatus('ready')
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError.message)
          setStatus('error')
        }
      })
    return () => { cancelled = true }
  }, [attempt, listCommunityDecks])

  if (status === 'loading') return <div className="page"><Spinner label="Opening the community library" /></div>

  return (
    <div className="page community-page">
      <header className="page-head"><span className="eyebrow"><Icon name="sparkles" size={14} /> Shared by learners</span><h1>Community library</h1><p>Preview public decks and make an independent copy for your own study schedule.</p></header>
      {status === 'error' && <ErrorBanner message={error} onRetry={() => setAttempt((value) => value + 1)} />}
      <div className="community-grid">
        {decks.map((deck) => (
          <article key={deck.shareToken} className={`community-card accent-${deck.color || 'coral'}`}>
            <span className="deck-emoji">{deck.emoji || '✨'}</span>
            <div><small>Shared by {deck.author || 'a learner'}</small><h2>{deck.title}</h2><p>{deck.description || 'A community study deck.'}</p></div>
            <div className="deck-labels">{deck.tags?.slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}</div>
            <span className="community-count"><Icon name="cards" size={14} /> {deck.cards.length} cards</span>
            <Link className="button button-secondary" to={`/shared/${deck.shareToken}`}>Preview deck <Icon name="arrowRight" size={15} /></Link>
          </article>
        ))}
      </div>
      {!decks.length && status === 'ready' && <p className="inline-empty">No public decks have been shared yet.</p>}
    </div>
  )
}
