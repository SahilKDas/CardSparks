import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ErrorBanner, Spinner } from '../components/Feedback'
import { Icon } from '../components/Icons'
import StudyResultCard from '../components/StudyResultCard'
import { useApp } from '../context/useApp'
import { analyzeMisconception, buildExamQuestions, scoreExam } from '../lib/exam'

export default function Exam() {
  const { deckId } = useParams()
  const { decks, loading, recordStudy, addCard, getStudyFeedback } = useApp()
  const deck = useMemo(() => decks.find((item) => String(item.id) === String(deckId)), [decks, deckId])
  const [phase, setPhase] = useState('setup')
  const [minutes, setMinutes] = useState(10)
  const [count, setCount] = useState(10)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState([])
  const [index, setIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [applyStatus, setApplyStatus] = useState('idle')
  const [coachStatus, setCoachStatus] = useState('idle')
  const [coachFeedback, setCoachFeedback] = useState('')
  const [suggestionStates, setSuggestionStates] = useState({})
  const [error, setError] = useState('')
  const deadline = useRef(null)
  const results = useMemo(() => scoreExam(questions, answers), [questions, answers])
  const questionCount = deck ? Math.min(count, deck.cards.length) : count

  function finish() {
    setPhase('results')
    deadline.current = null
  }

  useEffect(() => {
    if (phase !== 'active') return undefined
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (!remaining) finish()
    }, 250)
    return () => window.clearInterval(timer)
  }, [phase])

  function start() {
    const nextQuestions = buildExamQuestions(deck, questionCount, Date.now())
    setQuestions(nextQuestions)
    setAnswers(Array(nextQuestions.length).fill(null))
    setIndex(0)
    setSecondsLeft(minutes * 60)
    setApplyStatus('idle')
    setCoachStatus('idle')
    setCoachFeedback('')
    setSuggestionStates({})
    setError('')
    deadline.current = Date.now() + minutes * 60 * 1000
    setPhase('active')
  }

  function choose(optionIndex) {
    setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? optionIndex : answer))
  }

  async function applySchedule() {
    setApplyStatus('saving')
    setError('')
    try {
      await recordStudy(deck.id, results.map((result) => ({ cardId: result.cardId, grade: result.correct ? 4 : 1 })))
      setApplyStatus('saved')
    } catch (requestError) {
      setError(requestError.message)
      setApplyStatus('error')
    }
  }

  async function askCoach() {
    setCoachStatus('loading')
    setCoachFeedback('')
    try {
      const feedback = await getStudyFeedback(deck.id, results.map((result) => ({ cardId: result.cardId, grade: result.correct ? 4 : 1 })))
      setCoachFeedback(feedback)
      setCoachStatus('ready')
    } catch (requestError) {
      setCoachFeedback(requestError.message)
      setCoachStatus('error')
    }
  }

  async function addFollowUp(result) {
    const diagnosis = analyzeMisconception(result)
    if (!diagnosis) return
    setSuggestionStates((current) => ({ ...current, [result.cardId]: 'saving' }))
    try {
      await addCard(deck.id, diagnosis.followUpCard)
      setSuggestionStates((current) => ({ ...current, [result.cardId]: 'saved' }))
    } catch {
      setSuggestionStates((current) => ({ ...current, [result.cardId]: 'error' }))
    }
  }

  if (loading) return <div className="page"><Spinner label="Preparing test mode" /></div>
  if (!deck) return <div className="page not-found"><h1>Deck not found</h1><Link className="button button-primary" to="/decks">Back to decks</Link></div>
  if (deck.cards.length < 2) return <div className="page not-found"><h1>Add another card first</h1><p>Practice tests need at least two distinct answers.</p><Link className="button button-primary" to={`/decks/${deck.id}`}>Back to deck</Link></div>

  if (phase === 'setup') return <div className="page exam-page"><header className="page-head"><div><span className="eyebrow">Practice test</span><h1>{deck.title}</h1><p>Questions are shuffled and converted to multiple choice. Results stay separate from spaced repetition unless you apply them afterward.</p></div></header><section className="exam-setup"><Icon name="clock" size={28} /><div className="exam-settings"><label className="field-label">Questions<select value={questionCount} onChange={(event) => setCount(Number(event.target.value))}>{[5, 10, 20, deck.cards.length].filter((value, position, all) => value <= deck.cards.length && all.indexOf(value) === position).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="field-label">Time limit<select value={minutes} onChange={(event) => setMinutes(Number(event.target.value))}><option value="5">5 minutes</option><option value="10">10 minutes</option><option value="20">20 minutes</option><option value="30">30 minutes</option></select></label></div><button className="button button-primary" type="button" onClick={start}><Icon name="play" size={17} /> Start test</button></section></div>

  if (phase === 'results') {
    const correct = results.filter((result) => result.correct).length
    const missed = results.length - correct
    return <div className="page exam-page"><header className="page-head"><div><span className="eyebrow">Test complete</span><h1>{correct}/{results.length} correct</h1><p>{Math.round((correct / results.length) * 100)}% · Review every answer below before deciding whether to update your study schedule.</p></div></header>{error && <ErrorBanner message={error} />}<div className="exam-result-actions"><button className="button button-secondary" type="button" disabled={applyStatus === 'saving' || applyStatus === 'saved'} onClick={applySchedule}>{applyStatus === 'saved' ? 'Schedule updated' : applyStatus === 'saving' ? 'Updating…' : 'Apply results to schedule'}</button><button className="button button-primary" type="button" onClick={() => setPhase('setup')}>Take another test</button></div><StudyResultCard correct={correct} total={results.length} label="Practice test" /><section className="misconception-summary"><span className="misconception-icon"><Icon name="wand" size={24} /></span><div><span className="eyebrow">Misconception Detective</span><h2>{missed ? `${missed} ${missed === 1 ? 'concept needs' : 'concepts need'} another look.` : 'No misconceptions detected.'}</h2><p>{missed ? 'CardSparks compares each distractor with the target concept. The optional AI summary is separate from scoring and never changes your schedule.' : 'You answered every question correctly. Ask the coach for reinforcement or move on.'}</p>{coachStatus === 'ready' && <blockquote>{coachFeedback}</blockquote>}{coachStatus === 'error' && <p className="field-error">{coachFeedback}</p>}</div><button className="button button-secondary" type="button" disabled={coachStatus === 'loading'} onClick={askCoach}>{coachStatus === 'loading' ? 'Analyzing…' : coachStatus === 'ready' ? 'Refresh AI summary' : 'Ask AI coach'}</button></section><div className="exam-review">{results.map((result) => { const diagnosis = analyzeMisconception(result); const suggestionState = suggestionStates[result.cardId]; const suggestionLocked = ['saving', 'saved', 'error'].includes(suggestionState); return <article key={result.cardId} className={result.correct ? 'is-correct' : 'is-incorrect'}><span>{result.correct ? 'Correct' : result.selected === null ? 'Unanswered' : 'Review'}</span><h2>{result.prompt}</h2><p>Your answer: <strong>{result.selected === null ? 'No answer' : result.options[result.selected]?.text}</strong></p>{!result.correct && <p>Correct answer: <strong>{result.options[result.correctIndex]?.text}</strong></p>}{diagnosis && <div className="misconception-detail"><span>{diagnosis.title}</span><p>{diagnosis.explanation}</p><strong>{diagnosis.correction}</strong><button className="text-button" type="button" disabled={suggestionLocked} onClick={() => addFollowUp(result)}><Icon name={suggestionState === 'saved' ? 'check' : 'plus'} size={14} /> {suggestionState === 'saved' ? 'Follow-up added' : suggestionState === 'saving' ? 'Adding…' : suggestionState === 'error' ? 'Could not confirm — check your deck' : 'Add suggested follow-up card'}</button></div>}</article> })}</div></div>
  }

  const question = questions[index]
  const chosen = answers[index]
  return <div className="page exam-page"><header className="exam-top"><Link to={`/decks/${deck.id}`}><Icon name="x" size={18} /> Exit test</Link><strong>Question {index + 1} of {questions.length}</strong><span>{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</span></header><div className="study-progress"><span style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div><section className="exam-question"><span className="eyebrow">Choose the best answer</span><h1>{question.prompt}</h1><div className="exam-options">{question.options.map((option, optionIndex) => <button key={`${optionIndex}-${option.text}`} className={chosen === optionIndex ? 'selected' : ''} type="button" onClick={() => choose(optionIndex)}><span>{String.fromCharCode(65 + optionIndex)}</span>{option.text}</button>)}</div><div className="exam-navigation"><button className="button button-secondary" type="button" disabled={!index} onClick={() => setIndex((value) => value - 1)}>Previous</button>{index + 1 === questions.length ? <button className="button button-primary" type="button" onClick={finish}>Finish test</button> : <button className="button button-primary" type="button" onClick={() => setIndex((value) => value + 1)}>Next</button>}</div></section></div>
}
