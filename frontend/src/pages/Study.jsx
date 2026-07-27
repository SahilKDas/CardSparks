import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Spinner } from '../components/Feedback'
import { Icon } from '../components/Icons'
import { useApp } from '../context/AppContext'

export default function Study() {
  const { deckId } = useParams()
  const navigate = useNavigate()
  const { decks, loading, recordStudy } = useApp()
  const deck = useMemo(() => decks.find((item) => String(item.id) === String(deckId)), [decks, deckId])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState([])
  const [complete, setComplete] = useState(false)
  const [saving, setSaving] = useState(false)
  const card = deck?.cards?.[index]

  function goTo(nextIndex) {
    setIndex(Math.max(0, Math.min(deck.cards.length - 1, nextIndex)))
    setFlipped(false)
  }

  async function rate(correctRating) {
    const nextResults = [...results.filter((item) => item.cardId !== card.id), { cardId: card.id, correct: correctRating }]
    setResults(nextResults)
    if (index < deck.cards.length - 1) {
      goTo(index + 1)
    } else {
      setSaving(true)
      setComplete(true)
      try {
        await recordStudy(deck.id, nextResults)
      } catch {
        // Completion remains available even if the optional study-session endpoint is absent.
      } finally {
        setSaving(false)
      }
    }
  }

  function restart() {
    setIndex(0)
    setFlipped(false)
    setResults([])
    setComplete(false)
  }

  useEffect(() => {
    if (complete || loading || !card) return undefined
    const handleKey = (event) => {
      if (event.code === 'Space') {
        event.preventDefault()
        setFlipped((value) => !value)
      }
      if (flipped && event.key === '1') rate(false)
      if (flipped && event.key === '2') rate(true)
      if (!flipped && event.key === 'ArrowLeft') goTo(index - 1)
      if (!flipped && event.key === 'ArrowRight') goTo(index + 1)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [complete, flipped, index, card?.id, loading])

  if (loading) return <div className="page"><Spinner label="Preparing your study session" /></div>
  if (!deck || !deck.cards.length) return <div className="page not-found"><span>🗂️</span><h1>No cards to study yet</h1><p>Add a few cards and come back when you’re ready.</p><Link className="button button-primary" to={deck ? `/decks/${deck.id}` : '/'}>Go back</Link></div>

  const progress = ((index + (complete ? 1 : 0)) / deck.cards.length) * 100
  const correct = results.filter((result) => result.correct).length

  if (complete) {
    const score = Math.round((correct / deck.cards.length) * 100)
    return (
      <div className="study-page study-complete-page">
        <div className="study-complete-card">
          <span className="celebration-icon"><Icon name="trophy" size={36} /></span>
          <span className="eyebrow">Session complete</span>
          <h1>Nice work — you showed up.</h1>
          <p>You reviewed every card in <strong>{deck.title}</strong>.</p>
          <div className="score-ring" style={{ '--score': `${score * 3.6}deg` }}><div><strong>{score}%</strong><span>recall</span></div></div>
          <div className="result-stats"><div><strong>{correct}</strong><span>Got it</span></div><div><strong>{deck.cards.length - correct}</strong><span>Needs work</span></div><div><strong>{deck.cards.length}</strong><span>Reviewed</span></div></div>
          {saving && <p className="saving-note">Saving your progress…</p>}
          <div className="complete-actions"><button className="button button-secondary" type="button" onClick={restart}><Icon name="refresh" size={16} /> Study again</button><button className="button button-primary" type="button" onClick={() => navigate(`/decks/${deck.id}`)}>Back to deck <Icon name="arrowRight" size={16} /></button></div>
        </div>
      </div>
    )
  }

  return (
    <div className="study-page">
      <header className="study-topbar">
        <Link to={`/decks/${deck.id}`} className="study-close"><Icon name="x" size={20} /> <span>Exit</span></Link>
        <div className="study-title"><strong>{deck.title}</strong><span>Card {index + 1} of {deck.cards.length}</span></div>
        <div className="study-count">{Math.round(progress)}%</div>
      </header>
      <div className="study-progress"><span style={{ width: `${((index) / deck.cards.length) * 100}%` }} /></div>

      <main className="study-stage">
        <p className="flip-hint"><Icon name="rotate" size={15} /> {flipped ? 'How did you do?' : 'Tap the card to reveal the answer'}</p>
        <button className={`flashcard ${flipped ? 'is-flipped' : ''}`} type="button" onClick={() => setFlipped((value) => !value)} aria-label={flipped ? 'Show question' : 'Show answer'}>
          <div className="flashcard-inner">
            <section className="flashcard-face flashcard-front"><span>Question</span><p>{card.front}</p><small>Click to flip <Icon name="rotate" size={14} /></small></section>
            <section className="flashcard-face flashcard-back"><span>Answer</span><p>{card.back}</p><small>Click to see the question <Icon name="rotate" size={14} /></small></section>
          </div>
        </button>

        {flipped ? <div className="rating-actions"><button className="rating-button missed" type="button" onClick={() => rate(false)}><span><Icon name="x" size={20} /></span><div><strong>Study again</strong><small>I missed this one</small></div></button><button className="rating-button got-it" type="button" onClick={() => rate(true)}><span><Icon name="check" size={20} /></span><div><strong>Got it</strong><small>I knew the answer</small></div></button></div> : <div className="study-navigation"><button type="button" onClick={() => goTo(index - 1)} disabled={index === 0}><Icon name="chevronLeft" /> Previous</button><button type="button" onClick={() => goTo(index + 1)} disabled={index === deck.cards.length - 1}>Next <Icon name="chevronRight" /></button></div>}
      </main>
      <footer className="study-footer"><span><kbd>Space</kbd> Flip card</span><span><kbd>1</kbd> Study again</span><span><kbd>2</kbd> Got it</span></footer>
    </div>
  )
}
