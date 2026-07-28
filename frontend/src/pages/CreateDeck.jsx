import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CardEditor, { blankCard } from '../components/CardEditor'
import { ErrorBanner } from '../components/Feedback'
import { Icon } from '../components/Icons'
import { useApp } from '../context/AppContext'

const colorOptions = ['coral', 'violet', 'blue', 'green', 'yellow']

export default function CreateDeck() {
  const { createDeck, generateCards } = useApp()
  const navigate = useNavigate()
  const [mode, setMode] = useState('ai')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [topic, setTopic] = useState('')
  const [numCards, setNumCards] = useState(8)
  const [cards, setCards] = useState([])
  const [color, setColor] = useState('coral')
  const [emoji, setEmoji] = useState('✨')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState('')

  const completeCards = useMemo(() => cards.filter((card) => card.front.trim() && card.back.trim()), [cards])

  function switchMode(nextMode) {
    setMode(nextMode)
    setLocalError('')
    if (nextMode === 'manual' && cards.length === 0) setCards([blankCard(), blankCard()])
  }

  async function handleGenerate() {
    if (!topic.trim()) {
      setLocalError('Give CardSparks a topic or study prompt first.')
      return
    }
    setGenerating(true)
    setLocalError('')
    try {
      const generated = await generateCards(topic.trim(), numCards)
      if (!generated.length) throw new Error('The generator returned no cards. Try a more specific topic.')
      setCards(generated)
      if (!title) setTitle(topic.trim())
      if (!description) setDescription(`A focused review of ${topic.trim()}, generated with CardSparks AI.`)
    } catch (error) {
      setLocalError(error.message)
    } finally {
      setGenerating(false)
    }
  }

  function updateCard(index, card) {
    setCards((current) => current.map((item, itemIndex) => itemIndex === index ? card : item))
  }

  function deleteCard(index) {
    setCards((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  async function handleSave() {
    if (!title.trim()) {
      setLocalError('Add a name for your deck.')
      return
    }
    if (!completeCards.length) {
      setLocalError('Add at least one card with both a front and back.')
      return
    }
    setSaving(true)
    setLocalError('')
    try {
      const deck = await createDeck({ title: title.trim(), description: description.trim(), emoji, color, cards: completeCards })
      navigate(`/decks/${deck.id}`)
    } catch (error) {
      setLocalError(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page create-page">
      <div className="page-breadcrumb"><Link to="/decks"><Icon name="arrowLeft" size={16} /> My decks</Link></div>
      <header className="create-header">
        <span className="eyebrow"><Icon name="sparkles" size={14} /> Make something memorable</span>
        <h1>Create a new deck</h1>
        <p>Bring your own cards, or turn a topic into a study-ready first draft.</p>
      </header>

      <div className="mode-switch" role="tablist" aria-label="Creation method">
        <button className={mode === 'ai' ? 'active' : ''} type="button" onClick={() => switchMode('ai')} role="tab" aria-selected={mode === 'ai'}><span><Icon name="wand" /></span><div><strong>Generate with AI</strong><small>From a topic or prompt</small></div>{mode === 'ai' && <Icon name="check" size={17} />}</button>
        <button className={mode === 'manual' ? 'active' : ''} type="button" onClick={() => switchMode('manual')} role="tab" aria-selected={mode === 'manual'}><span><Icon name="manual" /></span><div><strong>Build it myself</strong><small>Add your own cards</small></div>{mode === 'manual' && <Icon name="check" size={17} />}</button>
      </div>

      <ErrorBanner message={localError} onDismiss={() => setLocalError('')} />

      {mode === 'ai' && cards.length === 0 ? (
        <section className="creation-panel ai-generator-panel">
          <div className="panel-heading"><span className="big-panel-icon"><Icon name="wand" size={25} /></span><div><h2>What do you want to learn?</h2><p>Be specific for sharper, more useful cards.</p></div></div>
          <label className="field-label">Topic or prompt<textarea value={topic} onChange={(event) => setTopic(event.target.value)} placeholder={'Try “Photosynthesis for AP Biology” or “Spanish past-tense verbs with examples”'} rows="4" /></label>
          <div className="generator-row">
            <label className="field-label compact">Number of cards<select value={numCards} onChange={(event) => setNumCards(Number(event.target.value))}><option value="5">5 cards</option><option value="8">8 cards</option><option value="10">10 cards</option><option value="15">15 cards</option><option value="20">20 cards</option></select></label>
            <button className="button button-primary generate-button" type="button" onClick={handleGenerate} disabled={generating}>{generating ? <><span className="button-spinner" /> Creating your cards…</> : <><Icon name="sparkles" size={18} /> Generate cards</>}</button>
          </div>
          <div className="prompt-suggestions"><span>Need a spark?</span>{['The water cycle', 'JavaScript closures', 'Italian travel phrases'].map((item) => <button key={item} type="button" onClick={() => setTopic(item)}>{item}</button>)}</div>
        </section>
      ) : (
        <div className="deck-builder">
          <section className="creation-panel deck-details-panel">
            <div className="panel-heading compact-heading"><div><h2>Deck details</h2><p>Give this collection a clear identity.</p></div></div>
            <div className="deck-details-grid">
              <label className="emoji-picker">Cover<input value={emoji} onChange={(event) => setEmoji(event.target.value.slice(0, 2))} maxLength="2" aria-label="Deck emoji" /></label>
              <label className="field-label">Deck name<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Cell Biology Essentials" /></label>
              <label className="field-label wide">Description <span>Optional</span><input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What will this deck help you remember?" /></label>
              <div className="field-label color-field">Accent color<div className="color-options">{colorOptions.map((option) => <button key={option} type="button" className={`${option} ${color === option ? 'selected' : ''}`} onClick={() => setColor(option)} aria-label={`Use ${option} accent`}><Icon name="check" size={13} /></button>)}</div></div>
            </div>
          </section>

          <section className="cards-builder-section">
            <div className="builder-heading"><div><h2>{mode === 'ai' ? 'Review your cards' : 'Add your cards'}</h2><p>{mode === 'ai' ? 'AI made the first draft. You have the final word.' : 'Keep each card focused on one idea.'}</p></div><span>{completeCards.length} ready</span></div>
            <div className="card-editor-list">
              {cards.map((card, index) => <CardEditor key={card.id} card={card} index={index} onChange={(next) => updateCard(index, next)} onDelete={() => deleteCard(index)} />)}
            </div>
            <button className="add-card-button" type="button" onClick={() => setCards((current) => [...current, blankCard()])}><Icon name="plus" size={18} /> Add another card</button>
            {mode === 'ai' && <button className="text-button regenerate-link" type="button" onClick={() => { setCards([]); setTitle(''); }}><Icon name="refresh" size={15} /> Start over with a different prompt</button>}
          </section>

          <div className="builder-footer"><Link className="button button-ghost" to="/decks">Cancel</Link><button className="button button-primary" type="button" disabled={saving} onClick={handleSave}>{saving ? <><span className="button-spinner" /> Saving…</> : <><Icon name="save" size={17} /> Save deck</>}</button></div>
        </div>
      )}
    </div>
  )
}

