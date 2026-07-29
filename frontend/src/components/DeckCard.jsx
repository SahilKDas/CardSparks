import { Link } from 'react-router-dom'
import { Icon } from './Icons'

export function relativeDate(date) {
  if (!date) return 'Not studied yet'
  const timestamp = new Date(date).getTime()
  if (!Number.isFinite(timestamp)) return 'Study date unavailable'
  const difference = Date.now() - timestamp
  const days = Math.max(0, Math.floor(difference / 86400000))
  if (days === 0) return 'Studied today'
  if (days === 1) return 'Studied yesterday'
  if (days < 7) return `Studied ${days} days ago`
  return `Studied ${new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

export default function DeckCard({ deck }) {
  const total = deck.cards?.length || deck.card_count || 0
  const mastered = deck.cards?.filter((card) => (card.mastery || 0) >= 0.8).length || 0
  const progress = total ? Math.round((mastered / total) * 100) : 0
  const due = typeof deck.dueCount === 'number' ? deck.dueCount : 0

  return (
    <article className={`deck-card accent-${deck.color || 'coral'}`}>
      <Link to={`/decks/${deck.id}`} className="deck-card-main" aria-label={`Open ${deck.title}`}>
        <div className="deck-card-top">
          <span className="deck-emoji">{deck.emoji || '✨'}</span>
          {due > 0 && <span className="due-badge">{due} due</span>}
          <span className="open-arrow"><Icon name="arrowRight" size={19} /></span>
        </div>
        <h3>{deck.title}</h3>
        <p>{deck.description || 'A focused deck, ready when you are.'}</p>
        {(deck.folder || deck.tags?.length > 0) && <div className="deck-labels">{deck.folder && <span className="folder-label">{deck.folder}</span>}{deck.tags?.slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}</div>}
        <div className="deck-meta">
          <span><Icon name="cards" size={15} /> {total} {total === 1 ? 'card' : 'cards'}</span>
          <span><Icon name="clock" size={15} /> {relativeDate(deck.lastStudied)}</span>
        </div>
      </Link>
      <div className="deck-progress">
        <div className="deck-progress-label"><span>Mastery</span><strong>{progress}%</strong></div>
        <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
      </div>
      {total > 0 ? (
        <Link
          to={`/decks/${deck.id}/study`}
          className={`study-link ${due === 0 ? 'is-quiet' : ''}`}
        >
          <Icon name="play" size={15} /> {due > 0 ? `Review ${due} due` : 'Nothing due'}
        </Link>
      ) : (
        <span className="study-link disabled" aria-disabled="true"><Icon name="play" size={15} /> Add cards to study</span>
      )}
    </article>
  )
}
