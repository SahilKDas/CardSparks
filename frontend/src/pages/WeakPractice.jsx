import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorBanner, Spinner } from '../components/Feedback'
import { Icon } from '../components/Icons'
import { useApp } from '../context/useApp'
import { studyFaces } from '../lib/cardTypes'
import { GRADES } from '../lib/sm2'
import { buildWeakQueue } from '../lib/weakPractice'

export default function WeakPractice() {
  const { decks, loading, recordCrossDeckStudy } = useApp()
  const cards = useMemo(() => buildWeakQueue(decks), [decks])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('active')
  const [error, setError] = useState('')
  const [savedDeckIds, setSavedDeckIds] = useState([])
  const card = cards[index]

  async function finish(nextResults) {
    setStatus('saving')
    setError('')
    try {
      const unsaved = nextResults.filter((result) => !savedDeckIds.includes(String(result.deckId)))
      const completed = await recordCrossDeckStudy(unsaved)
      setSavedDeckIds((current) => [...new Set([...current, ...completed])])
      setStatus('complete')
    } catch (requestError) {
      setSavedDeckIds((current) => [...new Set([...current, ...(requestError.completedDeckIds || [])])])
      setError(requestError.message)
      setStatus('error')
    }
  }

  function rate(grade) {
    const next = [...results, { deckId: card.deckId, cardId: card.id, grade }]
    setResults(next)
    setFlipped(false)
    if (index + 1 >= cards.length) void finish(next)
    else setIndex((value) => value + 1)
  }

  if (loading) return <div className="page"><Spinner label="Finding weak cards" /></div>
  if (!cards.length) return <div className="page not-found"><span>🎯</span><h1>No weak cards yet</h1><p>Complete a few normal study sessions first. Cards you miss will appear here automatically.</p><Link className="button button-primary" to="/decks">Study a deck</Link></div>

  if (status !== 'active') {
    const passed = results.filter((result) => result.grade >= 3).length
    return <div className="study-page study-complete-page"><div className="study-complete-card"><span className="celebration-icon"><Icon name={status === 'complete' ? 'trophy' : 'clock'} size={34} /></span><span className="eyebrow">Weak-spots practice</span><h1>{status === 'saving' ? 'Saving your practice…' : status === 'complete' ? 'Weak spots reviewed.' : 'Practice finished.'}</h1><p>You recalled {passed} of {results.length} difficult cards.</p>{error && <ErrorBanner message={error} onRetry={() => finish(results)} />}<div className="complete-actions"><Link className="button button-secondary" to="/stats">Back to progress</Link><Link className="button button-primary" to="/decks">My decks</Link></div></div></div>
  }

  const faces = studyFaces(card)
  return <div className="study-page"><header className="study-topbar"><Link className="study-close" to="/stats"><Icon name="x" size={20} /> <span>Exit</span></Link><div className="study-title"><strong>Weak-spots practice</strong><span>{card.deckEmoji || '📚'} {card.deckTitle}</span></div><div className="study-count">{index + 1}/{cards.length}</div></header><div className="study-progress"><span style={{ width: `${((index + 1) / cards.length) * 100}%` }} /></div><main className="study-stage"><p className="flip-hint"><Icon name="rotate" size={15} /> {flipped ? 'Rate your recall honestly' : 'Cards are ranked by misses, ease, and mastery'}</p><button className={`flashcard ${flipped ? 'is-flipped' : ''}`} type="button" onClick={() => setFlipped((value) => !value)} aria-label={flipped ? 'Show prompt' : 'Show answer'}><div className="flashcard-inner"><section className="flashcard-face flashcard-front"><span>{faces.frontLabel}</span>{card.cardType === 'image' && <img className="study-card-image" src={card.imageUrl} alt="Study card reference" />}<p>{faces.front}</p><small>Click to flip <Icon name="rotate" size={14} /></small></section><section className="flashcard-face flashcard-back"><span>{faces.backLabel}</span><p>{faces.back}</p><small>Choose a rating below</small></section></div></button>{flipped ? <div className="rating-actions grades">{GRADES.map((grade) => <button key={grade.value} className={`rating-button ${grade.tone}`} type="button" onClick={() => rate(grade.value)}><strong>{grade.label}</strong><small>{grade.hint}</small></button>)}</div> : <p className="reveal-nudge">This temporary queue pulls difficult cards from every deck.</p>}</main></div>
}
