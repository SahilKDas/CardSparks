import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ErrorBanner, Spinner } from '../components/Feedback'
import { Icon } from '../components/Icons'
import { useApp } from '../context/useApp'

export default function QualityCheck() {
  const { deckId } = useParams()
  const { decks, loading, checkCardQuality, updateCard } = useApp()
  const deck = useMemo(() => decks.find((item) => String(item.id) === String(deckId)), [decks, deckId])
  const [issues, setIssues] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [applying, setApplying] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!deck) return
    let cancelled = false
    setStatus('loading')
    setError('')
    checkCardQuality(deck.id, deck.cards.slice(0, 100).map((card) => String(card.id)))
      .then((result) => { if (!cancelled) { setIssues(result); setStatus('ready') } })
      .catch((requestError) => { if (!cancelled) { setError(requestError.message); setStatus('error') } })
    return () => { cancelled = true }
  }, [deck?.id, attempt])

  async function accept(issue) {
    const card = deck.cards.find((item) => String(item.id) === issue.cardId)
    if (!card) return
    setApplying(issue.cardId)
    setError('')
    try {
      await updateCard(card.id, { ...card, front: issue.suggestedFront || card.front, back: issue.suggestedBack || card.back })
      setIssues((current) => current.filter((item) => item.cardId !== issue.cardId))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setApplying('')
    }
  }

  if (loading) return <div className="page"><Spinner label="Checking card quality" /></div>
  if (!deck) return <div className="page not-found"><h1>Deck not found</h1><Link className="button button-primary" to="/decks">Back to decks</Link></div>
  if (status === 'loading') return <div className="page"><Spinner label="Checking card quality" /></div>
  if (status === 'error') return <div className="page"><ErrorBanner message={error} onRetry={() => setAttempt((value) => value + 1)} /></div>

  return <div className="page quality-page"><div className="page-breadcrumb"><Link to={`/decks/${deck.id}`}><Icon name="arrowLeft" size={16} /> {deck.title}</Link></div><header className="page-head"><div><span className="eyebrow"><Icon name="sparkles" size={14} /> AI card-quality checker</span><h1>Make every card earn its place.</h1><p>Review vague prompts, overloaded answers, duplicates, and cloze problems. Suggestions are never applied automatically.</p></div><button className="button button-secondary" type="button" onClick={() => setAttempt((value) => value + 1)}><Icon name="refresh" size={15} /> Check again</button></header>{error && <ErrorBanner message={error} onDismiss={() => setError('')} />}{issues.length ? <div className="quality-list">{issues.map((issue) => { const card = deck.cards.find((item) => String(item.id) === issue.cardId); return <article key={issue.cardId}><div className="quality-original"><span>Current card</span><h2>{card?.front}</h2><p>{card?.back}</p></div><ul>{issue.issues.map((message) => <li key={message}>{message}</li>)}</ul><div className="quality-suggestion"><span>Suggested rewrite</span><strong>{issue.suggestedFront}</strong><p>{issue.suggestedBack}</p></div><button className="button button-primary" type="button" disabled={applying === issue.cardId} onClick={() => accept(issue)}>{applying === issue.cardId ? 'Applying…' : 'Accept this rewrite'}</button></article> })}</div> : <div className="inline-empty"><span><Icon name="check" size={26} /></span><div><h3>No quality issues found</h3><p>Your prompts are focused and your answers are concise.</p></div></div>}</div>
}
