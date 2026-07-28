import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorBanner, Spinner } from '../components/Feedback'
import { Icon } from '../components/Icons'
import { useApp } from '../context/useApp'
import {
  GRADES,
  PASS_THRESHOLD,
  describeDueDate,
  formatInterval,
  nextDueDate,
  previewFor,
  sm2,
  scheduleOf,
} from '../lib/sm2'

const SESSION_LIMIT = 100

export default function Study() {
  const { deckId } = useParams()
  const navigate = useNavigate()
  const { decks, loading, getStudyQueue, recordStudy, getStudyFeedback } = useApp()

  const deck = useMemo(
    () => decks.find((item) => String(item.id) === String(deckId)),
    [decks, deckId],
  )

  const [queue, setQueue] = useState([])
  const [queueStatus, setQueueStatus] = useState('loading')
  const [queueError, setQueueError] = useState('')
  const [session, setSession] = useState(0)

  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState([])
  const [complete, setComplete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [coachStatus, setCoachStatus] = useState('idle')
  const [coachFeedback, setCoachFeedback] = useState('')
  const [coachError, setCoachError] = useState('')
  const submitStarted = useRef(false)
  const coachRequestGeneration = useRef(0)

  const card = queue[index]

  useEffect(() => {
    let cancelled = false
    coachRequestGeneration.current += 1
    setQueueStatus('loading')
    setQueueError('')

    getStudyQueue(deckId, SESSION_LIMIT)
      .then((cards) => {
        if (cancelled) return
        setQueue(cards)
        setIndex(0)
        setFlipped(false)
        setResults([])
        setComplete(false)
        setSaveError('')
        setCoachStatus('idle')
        setCoachFeedback('')
        setCoachError('')
        submitStarted.current = false
        setQueueStatus('ready')
      })
      .catch((error) => {
        if (cancelled) return
        setQueueError(error.message)
        setQueueStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [deckId, session, getStudyQueue])

  const requestCoach = useCallback(async (feedbackResults) => {
    const requestGeneration = coachRequestGeneration.current + 1
    coachRequestGeneration.current = requestGeneration
    setCoachStatus('loading')
    setCoachFeedback('')
    setCoachError('')
    try {
      const feedback = await getStudyFeedback(deckId, feedbackResults)
      if (requestGeneration !== coachRequestGeneration.current) return
      setCoachFeedback(feedback)
      setCoachStatus('ready')
    } catch (error) {
      if (requestGeneration !== coachRequestGeneration.current) return
      setCoachError(error.message)
      setCoachStatus('error')
    }
  }, [deckId, getStudyFeedback])

  const submit = useCallback(async (finalResults) => {
    if (submitStarted.current) return
    submitStarted.current = true
    setSaving(true)
    setComplete(true)
    setSaveError('')
    setCoachStatus('idle')
    const feedbackResults = finalResults.map(({ cardId, worstGrade }) => ({ cardId, grade: worstGrade }))
    try {
      // The server schedules from the worst grade the card received this session.
      await recordStudy(deckId, feedbackResults)
      void requestCoach(feedbackResults)
    } catch (error) {
      setSaveError(error.message)
      submitStarted.current = false
    } finally {
      setSaving(false)
    }
  }, [deckId, recordStudy, requestCoach])

  const rate = useCallback((grade) => {
    if (!card || submitStarted.current) return

    const previous = results.find((item) => item.cardId === card.id)
    const worstGrade = previous ? Math.min(previous.worstGrade, grade) : grade

    const next = [
      ...results.filter((item) => item.cardId !== card.id),
      {
        cardId: card.id,
        worstGrade,
        lastGrade: grade,
        intervalDays: sm2(scheduleOf(card), worstGrade).intervalDays,
      },
    ]
    setResults(next)
    setFlipped(false)

    const answered = new Set(
      next.filter((item) => item.lastGrade >= PASS_THRESHOLD).map((item) => item.cardId),
    )

    // Missed it: send this card to the back of the session and keep going.
    if (grade < PASS_THRESHOLD) {
      const reordered = [
        ...queue.slice(0, index),
        ...queue.slice(index + 1),
        queue[index],
      ]
      const nextIndex = reordered.findIndex((item) => !answered.has(item.id))
      setQueue(reordered)
      setIndex(Math.max(0, nextIndex))
      return
    }

    // Session flow depends on the latest answer, not the worst one.
    if (queue.every((item) => answered.has(item.id))) {
      submit(next)
    } else {
      setIndex((current) => (current + 1) % queue.length)
    }
  }, [card, index, queue, results, submit])

  useEffect(() => {
    if (complete || queueStatus !== 'ready' || !card) return undefined

    const handleKey = (event) => {
      const target = event.target
      if (event.repeat || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target instanceof HTMLButtonElement || target?.isContentEditable) return
      if (event.code === 'Space') {
        event.preventDefault()
        setFlipped((value) => !value)
        return
      }
      if (!flipped) return
      const match = GRADES.find((grade) => grade.shortcut === event.key)
      if (match) {
        event.preventDefault()
        rate(match.value)
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [complete, queueStatus, card, flipped, rate])

  if (loading || queueStatus === 'loading') {
    return <div className="page"><Spinner label="Building your review queue" /></div>
  }

  if (!deck) {
    return (
      <div className="page not-found">
        <span>🗂️</span>
        <h1>That deck is gone</h1>
        <p>It may have been deleted from another tab.</p>
        <Link className="button button-primary" to="/decks">Back to decks</Link>
      </div>
    )
  }

  if (queueStatus === 'error') {
    return (
      <div className="page">
        <ErrorBanner message={queueError} onRetry={() => setSession((value) => value + 1)} />
      </div>
    )
  }

  if (!deck.cards.length) {
    return (
      <div className="page not-found">
        <span>🗂️</span>
        <h1>No cards to study yet</h1>
        <p>Add a few cards and come back when you’re ready.</p>
        <Link className="button button-primary" to={`/decks/${deck.id}`}>Go to deck</Link>
      </div>
    )
  }

  if (!queue.length && !complete) {
    const upcoming = nextDueDate(deck.cards)
    return (
      <div className="study-page study-complete-page">
        <div className="study-complete-card">
          <span className="celebration-icon"><Icon name="check" size={34} /></span>
          <span className="eyebrow">Nothing due</span>
          <h1>You’re caught up.</h1>
          <p>Every card in <strong>{deck.title}</strong> is scheduled for later. Reviewing early won’t help it stick.</p>
          <p className="next-due">{describeDueDate(upcoming)}</p>
          <div className="complete-actions">
            <button className="button button-secondary" type="button" onClick={() => setSession((value) => value + 1)}>
              <Icon name="refresh" size={16} /> Check again
            </button>
            <button className="button button-primary" type="button" onClick={() => navigate(`/decks/${deck.id}`)}>
              Back to deck <Icon name="arrowRight" size={16} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (complete) {
    const total = results.length
    const missed = results.filter((result) => result.worstGrade < PASS_THRESHOLD).length
    const firstTry = total - missed
    const score = total ? Math.round((firstTry / total) * 100) : 0
    const longest = results.reduce((max, result) => Math.max(max, result.intervalDays || 0), 0)
    const feedbackResults = results.map(({ cardId, worstGrade }) => ({ cardId, grade: worstGrade }))

    return (
      <div className="study-page study-complete-page">
        <div className="study-complete-card">
          <span className="celebration-icon"><Icon name="trophy" size={36} /></span>
          <span className="eyebrow">Session complete</span>
          <h1>{saving ? 'Saving your schedule…' : saveError ? 'Session finished.' : 'Scheduled and saved.'}</h1>
          <p>You worked through {total} {total === 1 ? 'card' : 'cards'} from <strong>{deck.title}</strong>.</p>
          <div className="score-ring" style={{ '--score': `${score * 3.6}deg` }}>
            <div><strong>{score}%</strong><span>first try</span></div>
          </div>
          <div className="result-stats">
            <div><strong>{firstTry}</strong><span>First try</span></div>
            <div><strong>{missed}</strong><span>Missed</span></div>
            <div><strong>{formatInterval(longest)}</strong><span>Longest gap</span></div>
          </div>
          {saving && <p className="saving-note">Saving your progress…</p>}
          {saveError && <p className="save-error">Your ratings didn’t save: {saveError}</p>}
          {!saving && !saveError && (
            <section className={`coach-panel coach-${coachStatus}`} aria-labelledby="coach-heading">
              <span className="coach-icon"><Icon name="sparkles" size={20} /></span>
              <div>
                <span className="eyebrow">AI study coach</span>
                <h2 id="coach-heading">Your next best move</h2>
                {coachStatus === 'loading' && <p role="status" aria-live="polite">Reading your results and finding the most useful next step…</p>}
                {coachStatus === 'ready' && <p>{coachFeedback}</p>}
                {coachStatus === 'error' && <><p>Your progress is safely saved, but coaching is unavailable: {coachError}</p><button className="text-button coach-retry" type="button" onClick={() => requestCoach(feedbackResults)}><Icon name="refresh" size={14} /> Retry coaching</button></>}
              </div>
            </section>
          )}
          <div className="complete-actions">
            {saveError ? <button className="button button-secondary" type="button" onClick={() => submit(results)}><Icon name="refresh" size={16} /> Retry saving</button> : <button className="button button-secondary" type="button" disabled={saving} onClick={() => setSession((value) => value + 1)}><Icon name="refresh" size={16} /> Study what’s left</button>}
            <button className="button button-primary" type="button" disabled={saving} onClick={() => navigate(`/decks/${deck.id}`)}>
              Back to deck <Icon name="arrowRight" size={16} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  const cleared = results.filter((result) => result.lastGrade >= PASS_THRESHOLD).length
  const remaining = Math.max(0, queue.length - cleared)
  const progress = queue.length ? (cleared / queue.length) * 100 : 0

  const priorWorst = results.find((result) => result.cardId === card.id)?.worstGrade ?? 5
  const isRepeat = priorWorst < PASS_THRESHOLD

  return (
    <div className="study-page">
      <header className="study-topbar">
        <Link to={`/decks/${deck.id}`} className="study-close"><Icon name="x" size={20} /> <span>Exit</span></Link>
        <div className="study-title">
          <strong>{deck.title}</strong>
          <span>{remaining} {remaining === 1 ? 'card' : 'cards'} left</span>
        </div>
        <div className="study-count">{Math.round(progress)}%</div>
      </header>
      <div className="study-progress"><span style={{ width: `${progress}%` }} /></div>

      <main className="study-stage">
        <p className="flip-hint">
          <Icon name="rotate" size={15} />
          {flipped
            ? ' How well did you recall it?'
            : isRepeat
              ? ' You missed this one — it will repeat until you recall it'
              : ' Tap the card to reveal the answer'}
        </p>

        <button
          className={`flashcard ${flipped ? 'is-flipped' : ''}`}
          type="button"
          onClick={() => setFlipped((value) => !value)}
          aria-label={flipped ? 'Show question' : 'Show answer'}
        >
          <div className="flashcard-inner">
            <section className="flashcard-face flashcard-front">
              <span>Question</span>
              <p>{card.front}</p>
              <small>Click to flip <Icon name="rotate" size={14} /></small>
            </section>
            <section className="flashcard-face flashcard-back">
              <span>Answer</span>
              <p>{card.back}</p>
              <small>Click to see the question <Icon name="rotate" size={14} /></small>
            </section>
          </div>
        </button>

        {flipped ? (
          <div className="rating-actions grades">
            {GRADES.map((grade) => (
              <button
                key={grade.value}
                className={`rating-button ${grade.tone}`}
                type="button"
                onClick={() => rate(grade.value)}
              >
                <strong>{grade.label}</strong>
                <span className="grade-interval">
                  {previewFor(card, Math.min(grade.value, priorWorst))}
                </span>
                <small>{grade.hint}</small>
              </button>
            ))}
          </div>
        ) : (
          <p className="reveal-nudge">Answer honestly — the schedule is only as good as your rating.</p>
        )}
      </main>

      <footer className="study-footer">
        <span><kbd>Space</kbd> Flip card</span>
        {GRADES.map((grade) => (
          <span key={grade.value}><kbd>{grade.shortcut}</kbd> {grade.label}</span>
        ))}
      </footer>
    </div>
  )
}
