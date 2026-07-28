import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorBanner, Spinner } from '../components/Feedback'
import { Icon } from '../components/Icons'
import Modal from '../components/Modal'
import { relativeDate } from '../components/DeckCard'
import { useApp } from '../context/AppContext'

export default function DeckDetail() {
  const { deckId } = useParams()
  const navigate = useNavigate()
  const { decks, loading, error, setError, updateDeck, deleteDeck, addCard, updateCard, deleteCard, generateIntoDeck } = useApp()
  const deck = useMemo(() => decks.find((item) => String(item.id) === String(deckId)), [decks, deckId])
  const [editingCard, setEditingCard] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [editingDetails, setEditingDetails] = useState(false)
  const [draft, setDraft] = useState({ front: '', back: '' })
  const [details, setDetails] = useState({ title: '', description: '' })
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiCount, setAiCount] = useState(5)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')

  if (loading) return <div className="page"><Spinner label="Opening your deck" /></div>
  if (!deck) return <div className="page not-found"><span>🤔</span><h1>That deck isn’t here</h1><p>It may have been deleted or the link may be out of date.</p><Link className="button button-primary" to="/">Back to my decks</Link></div>

  const mastered = deck.cards.filter((card) => (card.mastery || 0) >= 0.8).length

  async function saveCard() {
    if (!draft.front.trim() || !draft.back.trim()) {
      setLocalError('Both sides of the card are required.')
      return
    }
    setBusy(true)
    try {
      if (editingCard) await updateCard(editingCard.id, draft)
      else await addCard(deck.id, draft)
      setEditingCard(null)
      setAddOpen(false)
      setDraft({ front: '', back: '' })
    } catch (requestError) {
      setLocalError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function addWithAi() {
    if (!aiPrompt.trim()) return setLocalError('Add a topic for the new cards.')
    setBusy(true)
    try {
      await generateIntoDeck(deck.id, aiPrompt.trim(), aiCount)
      setAiOpen(false)
      setAiPrompt('')
    } catch (requestError) {
      setLocalError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveDetails() {
    if (!details.title.trim()) return setLocalError('Your deck needs a title.')
    setBusy(true)
    try {
      await updateDeck(deck.id, { title: details.title.trim(), description: details.description.trim() })
      setEditingDetails(false)
    } catch (requestError) {
      setLocalError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteDeck() {
    if (!window.confirm(`Delete “${deck.title}” and all of its cards? This cannot be undone.`)) return
    try {
      await deleteDeck(deck.id)
      navigate('/decks')
    } catch (requestError) {
      setLocalError(requestError.message)
    }
  }

  return (
    <div className="page detail-page">
      <div className="page-breadcrumb"><Link to="/decks"><Icon name="arrowLeft" size={16} /> My decks</Link></div>
      <ErrorBanner message={localError || error} onDismiss={() => { setLocalError(''); setError('') }} />

      <header className={`deck-detail-header accent-${deck.color || 'coral'}`}>
        <div className="detail-emoji">{deck.emoji || '✨'}</div>
        <div className="detail-title">
          <span className="eyebrow">Study deck</span>
          <h1>{deck.title}</h1>
          <p>{deck.description || 'A focused deck, ready when you are.'}</p>
          <div className="detail-meta"><span><Icon name="cards" size={16} /> {deck.cards.length} cards</span><span><Icon name="clock" size={16} /> {relativeDate(deck.lastStudied)}</span><span><Icon name="trophy" size={16} /> {mastered} mastered</span></div>
        </div>
        <div className="detail-actions">
          <Link className={`button button-primary ${!deck.cards.length ? 'disabled' : ''}`} to={deck.cards.length ? `/decks/${deck.id}/study` : '#'}><Icon name="play" size={17} /> Study deck</Link>
          <button className="button button-secondary" type="button" onClick={() => { setDetails({ title: deck.title, description: deck.description || '' }); setEditingDetails(true) }}><Icon name="edit" size={16} /> Edit details</button>
          <button className="icon-button destructive-hover" type="button" onClick={handleDeleteDeck} aria-label="Delete deck"><Icon name="trash" size={18} /></button>
        </div>
      </header>

      <section className="cards-list-section">
        <div className="section-heading detail-list-heading">
          <div><h2>Cards</h2><span>{deck.cards.length} in this deck</span></div>
          <div className="list-actions"><button className="button button-secondary" type="button" onClick={() => setAiOpen(true)}><Icon name="wand" size={16} /> Generate more</button><button className="button button-primary" type="button" onClick={() => { setDraft({ front: '', back: '' }); setAddOpen(true) }}><Icon name="plus" size={17} /> Add card</button></div>
        </div>

        {deck.cards.length ? <div className="detail-card-list">{deck.cards.map((card, index) => (
          <article className="detail-card-row" key={card.id}>
            <span className="row-index">{String(index + 1).padStart(2, '0')}</span>
            <div><small>Front</small><p>{card.front}</p></div>
            <span className="row-arrow"><Icon name="arrowRight" size={18} /></span>
            <div><small>Back</small><p>{card.back}</p></div>
            <div className="row-mastery" title={`${Math.round((card.mastery || 0) * 100)}% mastery`}><span style={{ '--mastery': `${Math.round((card.mastery || 0) * 100)}%` }} /></div>
            <div className="row-actions"><button type="button" onClick={() => { setEditingCard(card); setDraft({ front: card.front, back: card.back }); }} aria-label={`Edit card ${index + 1}`}><Icon name="edit" size={16} /></button><button type="button" onClick={() => window.confirm('Delete this card?') && deleteCard(card.id).catch((requestError) => setLocalError(requestError.message))} aria-label={`Delete card ${index + 1}`}><Icon name="trash" size={16} /></button></div>
          </article>
        ))}</div> : <div className="inline-empty"><span><Icon name="cards" size={28} /></span><div><h3>This deck is waiting for its first card</h3><p>Add one yourself or ask AI to make a starter set.</p></div></div>}
      </section>

      {(addOpen || editingCard) && <Modal title={editingCard ? 'Edit card' : 'Add a new card'} onClose={() => { setAddOpen(false); setEditingCard(null); setLocalError('') }}>
        <div className="modal-body form-stack"><label className="field-label">Front<textarea rows="4" value={draft.front} onChange={(event) => setDraft({ ...draft, front: event.target.value })} placeholder="Question or prompt" autoFocus /></label><label className="field-label">Back<textarea rows="4" value={draft.back} onChange={(event) => setDraft({ ...draft, back: event.target.value })} placeholder="Answer or explanation" /></label>{localError && <p className="field-error">{localError}</p>}</div>
        <div className="modal-footer"><button className="button button-ghost" type="button" onClick={() => { setAddOpen(false); setEditingCard(null) }}>Cancel</button><button className="button button-primary" type="button" onClick={saveCard} disabled={busy}>{busy ? 'Saving…' : 'Save card'}</button></div>
      </Modal>}

      {aiOpen && <Modal title="Generate more cards" onClose={() => { setAiOpen(false); setLocalError('') }}>
        <div className="modal-body form-stack"><div className="modal-callout"><Icon name="sparkles" /><p>New AI cards will be added directly to <strong>{deck.title}</strong>.</p></div><label className="field-label">Topic or instructions<textarea rows="4" value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} placeholder="e.g. Focus on key dates and cause-and-effect relationships" autoFocus /></label><label className="field-label compact">Number of cards<select value={aiCount} onChange={(event) => setAiCount(Number(event.target.value))}><option value="3">3 cards</option><option value="5">5 cards</option><option value="8">8 cards</option><option value="10">10 cards</option></select></label>{localError && <p className="field-error">{localError}</p>}</div>
        <div className="modal-footer"><button className="button button-ghost" type="button" onClick={() => setAiOpen(false)}>Cancel</button><button className="button button-primary" type="button" onClick={addWithAi} disabled={busy}>{busy ? <><span className="button-spinner" /> Generating…</> : <><Icon name="sparkles" size={17} /> Generate cards</>}</button></div>
      </Modal>}

      {editingDetails && <Modal title="Edit deck details" onClose={() => setEditingDetails(false)}>
        <div className="modal-body form-stack"><label className="field-label">Deck name<input value={details.title} onChange={(event) => setDetails({ ...details, title: event.target.value })} autoFocus /></label><label className="field-label">Description<textarea rows="3" value={details.description} onChange={(event) => setDetails({ ...details, description: event.target.value })} /></label>{localError && <p className="field-error">{localError}</p>}</div>
        <div className="modal-footer"><button className="button button-ghost" type="button" onClick={() => setEditingDetails(false)}>Cancel</button><button className="button button-primary" type="button" onClick={saveDetails} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
      </Modal>}
    </div>
  )
}

