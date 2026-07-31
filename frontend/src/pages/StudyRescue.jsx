import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorBanner, Spinner } from '../components/Feedback'
import { Icon } from '../components/Icons'
import StudyResultCard from '../components/StudyResultCard'
import { useApp } from '../context/useApp'
import { studyFaces } from '../lib/cardTypes'
import { buildRescueQueue, rescueBreakdown } from '../lib/rescue'
import { GRADES } from '../lib/sm2'

const BUDGETS = [5, 10, 15, 20]

export default function StudyRescue() {
  const { decks, loading, recordCrossDeckStudy } = useApp()
  const [minutes, setMinutes] = useState(10)
  const [sessionCards, setSessionCards] = useState([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('setup')
  const [error, setError] = useState('')
  const [savedDeckIds, setSavedDeckIds] = useState([])
  const preview = useMemo(() => buildRescueQueue(decks, minutes), [decks, minutes])
  const breakdown = useMemo(() => rescueBreakdown(preview), [preview])
  const card = sessionCards[index]

  function start() {
    setSessionCards(preview)
    setIndex(0)
    setFlipped(false)
    setResults([])
    setSavedDeckIds([])
    setError('')
    setStatus('active')
  }

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
    if (index + 1 >= sessionCards.length) void finish(next)
    else setIndex((value) => value + 1)
  }

  if (loading) return <div className="page"><Spinner label="Building your rescue session" /></div>

  if (status === 'setup') {
    const deckCount = new Set(preview.map((item) => String(item.deckId))).size
    return <div className="page rescue-page"><header className="page-head"><span className="eyebrow"><Icon name="clock" size={15} /> Focused practice</span><h1>How much time do you have?</h1><p>CardSparks will spend it on the most valuable overdue, missed, and soon-due cards across your decks.</p></header><section className="rescue-setup"><div className="rescue-budget" role="group" aria-label="Study time budget">{BUDGETS.map((budget) => <button key={budget} className={minutes === budget ? 'selected' : ''} type="button" aria-pressed={minutes === budget} onClick={() => setMinutes(budget)}><strong>{budget}</strong><span>minutes</span></button>)}</div><div className="rescue-preview" aria-live="polite"><span className="rescue-preview-icon"><Icon name="sparkles" size={25} /></span><div><span className="eyebrow">Your highest-value mix</span><h2>{preview.length} cards from {deckCount} {deckCount === 1 ? 'deck' : 'decks'}</h2><div className="rescue-reasons">{Object.entries(breakdown).map(([reason, total]) => <span key={reason}>{total} {reason.toLowerCase()}</span>)}</div></div><button className="button button-primary" type="button" disabled={!preview.length} onClick={start}><Icon name="play" size={17} /> Start rescue</button></div>{!preview.length && <div className="empty-state"><h2>Nothing urgent right now</h2><p>Add cards or complete a normal study session so CardSparks can prioritize your next rescue.</p><Link className="button button-secondary" to="/decks">Back to decks</Link></div>}</section></div>
  }

  if (status !== 'active') {
    const passed = results.filter((result) => result.grade >= 3).length
    return <div className="study-page study-complete-page"><div className="study-complete-card rescue-complete"><span className="celebration-icon"><Icon name={status === 'complete' ? 'trophy' : 'clock'} size={34} /></span><span className="eyebrow">{minutes}-minute rescue</span><h1>{status === 'saving' ? 'Saving your rescue…' : status === 'complete' ? 'Time well spent.' : 'Rescue finished.'}</h1><p>You recalled {passed} of {results.length} high-value cards.</p>{error && <ErrorBanner message={error} onRetry={() => finish(results)} />}{status === 'complete' && <StudyResultCard correct={passed} total={results.length} label="Study rescue" />}<div className="complete-actions"><Link className="button button-secondary" to="/stats">See progress</Link><button className="button button-primary" type="button" onClick={() => setStatus('setup')}>Build another rescue</button></div></div></div>
  }

  const faces = studyFaces(card)
  return <div className="study-page"><header className="study-topbar"><Link className="study-close" to="/decks"><Icon name="x" size={20} /> <span>Exit</span></Link><div className="study-title"><strong>{minutes}-minute rescue</strong><span>{card.deckEmoji || '📚'} {card.deckTitle}</span></div><div className="study-count">{index + 1}/{sessionCards.length}</div></header><div className="study-progress"><span style={{ width: `${((index + 1) / sessionCards.length) * 100}%` }} /></div><main className="study-stage"><p className="flip-hint"><Icon name="sparkles" size={15} /> Selected as: {card.rescueReason}</p><button className={`flashcard ${flipped ? 'is-flipped' : ''}`} type="button" onClick={() => setFlipped((value) => !value)} aria-label={flipped ? 'Show prompt' : 'Show answer'}><div className="flashcard-inner"><section className="flashcard-face flashcard-front"><span>{faces.frontLabel}</span>{card.cardType === 'image' && <img className="study-card-image" src={card.imageUrl} alt="Study card reference" />}<p>{faces.front}</p><small>Click to flip <Icon name="rotate" size={14} /></small></section><section className="flashcard-face flashcard-back"><span>{faces.backLabel}</span><p>{faces.back}</p><small>Choose a rating below</small></section></div></button>{flipped ? <div className="rating-actions grades">{GRADES.map((grade) => <button key={grade.value} className={`rating-button ${grade.tone}`} type="button" onClick={() => rate(grade.value)}><strong>{grade.label}</strong><small>{grade.hint}</small></button>)}</div> : <p className="reveal-nudge">This temporary queue changes with your available time.</p>}</main></div>
}
