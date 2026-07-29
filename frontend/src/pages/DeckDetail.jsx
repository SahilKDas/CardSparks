import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorBanner, Spinner } from '../components/Feedback'
import { Icon } from '../components/Icons'
import Modal from '../components/Modal'
import { relativeDate } from '../components/DeckCard'
import { useApp } from '../context/useApp'
import { parseTags } from '../lib/organize'
import { CARD_TYPES, validateCardDraft } from '../lib/cardTypes'
import CardEditor, { blankCard } from '../components/CardEditor'

export default function DeckDetail() {
  const { deckId } = useParams()
  const navigate = useNavigate()
  const { decks, loading, error, setError, updateDeck, deleteDeck, addCard, updateCard, deleteCard, generateIntoDeck, setDeckSharing } = useApp()
  const deck = useMemo(() => decks.find((item) => String(item.id) === String(deckId)), [decks, deckId])
  const [editingCard, setEditingCard] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [editingDetails, setEditingDetails] = useState(false)
  const [sharingOpen, setSharingOpen] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [draft, setDraft] = useState(blankCard)
  const [details, setDetails] = useState({ title: '', description: '', folder: '', tagsText: '', reviewLimit: '', newCardLimit: '', gradingMode: '' })
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiCount, setAiCount] = useState(5)
  const [busy, setBusy] = useState(false)
  const [deletingCardId, setDeletingCardId] = useState(null)
  const [localError, setLocalError] = useState('')

  if (loading) return <div className="page"><Spinner label="Opening your deck" /></div>
  if (!deck) return <div className="page not-found"><span>🤔</span><h1>That deck isn’t here</h1><p>It may have been deleted or the link may be out of date.</p><Link className="button button-primary" to="/decks">Back to my decks</Link></div>

  const mastered = deck.cards.filter((card) => (card.mastery || 0) >= 0.8).length

  async function saveCard() {
    const validationError = validateCardDraft(draft)
    if (validationError) {
      setLocalError(validationError)
      return
    }
    setBusy(true)
    try {
      const cleanedDraft = { ...draft, front: draft.front.trim(), back: draft.back.trim() }
      if (editingCard) await updateCard(editingCard.id, cleanedDraft)
      else await addCard(deck.id, cleanedDraft)
      setEditingCard(null)
      setAddOpen(false)
      setDraft(blankCard())
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
      await updateDeck(deck.id, {
        title: details.title.trim(),
        description: details.description.trim(),
        folder: details.folder.trim(),
        tags: parseTags(details.tagsText),
        review_limit: details.reviewLimit === '' ? null : Number(details.reviewLimit),
        new_card_limit: details.newCardLimit === '' ? null : Number(details.newCardLimit),
        grading_mode: details.gradingMode,
      })
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

  async function handleDeleteCard(cardId) {
    if (!window.confirm('Delete this card?')) return
    setDeletingCardId(cardId)
    setLocalError('')
    try {
      await deleteCard(cardId)
    } catch (requestError) {
      setLocalError(requestError.message)
    } finally {
      setDeletingCardId(null)
    }
  }

  async function toggleSharing() {
    setBusy(true)
    setLocalError('')
    try {
      await setDeckSharing(deck.id, !deck.isPublic)
      setCopiedLink(false)
    } catch (requestError) {
      setLocalError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function copyShareLink() {
    const url = `${window.location.origin}/shared/${deck.shareToken}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedLink(true)
    } catch {
      // Clipboard access can be denied on non-HTTPS development origins. The
      // visible read-only field still lets the learner copy the URL manually.
      setCopiedLink(false)
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
          {(deck.folder || deck.tags?.length > 0) && <div className="detail-labels">{deck.folder && <span className="folder-label">{deck.folder}</span>}{deck.tags?.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
          <div className="detail-meta"><span><Icon name="cards" size={16} /> {deck.cards.length} cards</span><span><Icon name="clock" size={16} /> {relativeDate(deck.lastStudied)}</span><span><Icon name="trophy" size={16} /> {mastered} mastered</span></div>
        </div>
        <div className="detail-actions">
          {deck.cards.length ? <Link className="button button-primary" to={`/decks/${deck.id}/study`}><Icon name="play" size={17} /> Study deck</Link> : <button className="button button-primary" type="button" disabled><Icon name="play" size={17} /> Add cards to study</button>}
          {deck.cards.length > 1 && <Link className="button button-secondary" to={`/decks/${deck.id}/exam`}><Icon name="clock" size={16} /> Take a practice test</Link>}
          {deck.cards.length > 0 && <Link className="button button-secondary" to={`/decks/${deck.id}/quality`}><Icon name="sparkles" size={16} /> Check card quality</Link>}
          <button className="button button-secondary" type="button" onClick={() => { setLocalError(''); setSharingOpen(true) }}><Icon name="sparkles" size={16} /> Share deck</button>
          <button className="button button-secondary" type="button" onClick={() => { setLocalError(''); setDetails({ title: deck.title, description: deck.description || '', folder: deck.folder || '', tagsText: (deck.tags || []).join(', '), reviewLimit: deck.reviewLimit ?? '', newCardLimit: deck.newCardLimit ?? '', gradingMode: deck.gradingMode || '' }); setEditingDetails(true) }}><Icon name="edit" size={16} /> Edit details</button>
          <button className="icon-button destructive-hover" type="button" onClick={handleDeleteDeck} aria-label="Delete deck"><Icon name="trash" size={18} /></button>
        </div>
      </header>

      <section className="cards-list-section">
        <div className="section-heading detail-list-heading">
          <div><h2>Cards</h2><span>{deck.cards.length} in this deck</span></div>
          <div className="list-actions"><button className="button button-secondary" type="button" onClick={() => { setLocalError(''); setAiOpen(true) }}><Icon name="wand" size={16} /> Generate more</button><button className="button button-primary" type="button" onClick={() => { setLocalError(''); setDraft(blankCard()); setAddOpen(true) }}><Icon name="plus" size={17} /> Add card</button></div>
        </div>

        {deck.cards.length ? <div className="detail-card-list">{deck.cards.map((card, index) => (
          <article className="detail-card-row" key={card.id}>
            <span className="row-index">{String(index + 1).padStart(2, '0')}</span>
            <div><small>{CARD_TYPES.find((type) => type.value === card.cardType)?.label || 'Basic'} · Front</small><p>{card.front}</p></div>
            <span className="row-arrow"><Icon name="arrowRight" size={18} /></span>
            <div><small>Back</small><p>{card.back}</p></div>
            <div className="row-mastery" title={`${Math.round((card.mastery || 0) * 100)}% mastery`}><span style={{ '--mastery': `${Math.round((card.mastery || 0) * 100)}%` }} /></div>
            <div className="row-actions"><button type="button" onClick={() => { setLocalError(''); setEditingCard(card); setDraft({ ...card }); }} aria-label={`Edit card ${index + 1}`} disabled={deletingCardId === card.id}><Icon name="edit" size={16} /></button><button type="button" onClick={() => handleDeleteCard(card.id)} aria-label={`Delete card ${index + 1}`} disabled={deletingCardId === card.id}><Icon name="trash" size={16} /></button></div>
          </article>
        ))}</div> : <div className="inline-empty"><span><Icon name="cards" size={28} /></span><div><h3>This deck is waiting for its first card</h3><p>Add one yourself or ask AI to make a starter set.</p></div></div>}
      </section>

      {(addOpen || editingCard) && <Modal title={editingCard ? 'Edit card' : 'Add a new card'} onClose={() => { setAddOpen(false); setEditingCard(null); setLocalError('') }}>
        <div className="modal-body form-stack modal-card-editor"><CardEditor card={draft} index={0} onChange={setDraft} showDelete={false} autoFocus />{localError && <p className="field-error">{localError}</p>}</div>
        <div className="modal-footer"><button className="button button-ghost" type="button" onClick={() => { setAddOpen(false); setEditingCard(null); setLocalError('') }}>Cancel</button><button className="button button-primary" type="button" onClick={saveCard} disabled={busy}>{busy ? 'Saving…' : 'Save card'}</button></div>
      </Modal>}

      {aiOpen && <Modal title="Generate more cards" onClose={() => { setAiOpen(false); setLocalError('') }}>
        <div className="modal-body form-stack"><div className="modal-callout"><Icon name="sparkles" /><p>New AI cards will be added directly to <strong>{deck.title}</strong>.</p></div><label className="field-label">Topic or instructions<textarea rows="4" value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} placeholder="e.g. Focus on key dates and cause-and-effect relationships" autoFocus data-autofocus /></label><label className="field-label compact">Number of cards<select value={aiCount} onChange={(event) => setAiCount(Number(event.target.value))}><option value="3">3 cards</option><option value="5">5 cards</option><option value="8">8 cards</option><option value="10">10 cards</option></select></label>{localError && <p className="field-error">{localError}</p>}</div>
        <div className="modal-footer"><button className="button button-ghost" type="button" onClick={() => { setAiOpen(false); setLocalError('') }}>Cancel</button><button className="button button-primary" type="button" onClick={addWithAi} disabled={busy}>{busy ? <><span className="button-spinner" /> Generating…</> : <><Icon name="sparkles" size={17} /> Generate cards</>}</button></div>
      </Modal>}

      {editingDetails && <Modal title="Edit deck details" onClose={() => { setEditingDetails(false); setLocalError('') }}>
        <div className="modal-body form-stack"><label className="field-label">Deck name<input value={details.title} onChange={(event) => setDetails({ ...details, title: event.target.value })} maxLength="256" autoFocus data-autofocus /></label><label className="field-label">Description<textarea rows="3" value={details.description} onChange={(event) => setDetails({ ...details, description: event.target.value })} /></label><label className="field-label">Folder<input value={details.folder} onChange={(event) => setDetails({ ...details, folder: event.target.value })} maxLength="80" placeholder="e.g. Semester 1" /></label><label className="field-label">Tags<input value={details.tagsText} onChange={(event) => setDetails({ ...details, tagsText: event.target.value })} placeholder="biology, midterm" /></label><div className="deck-setting-grid"><label className="field-label">Daily review limit <span>Blank uses account default</span><input type="number" min="1" max="1000" value={details.reviewLimit} onChange={(event) => setDetails({ ...details, reviewLimit: event.target.value })} /></label><label className="field-label">Daily new-card limit <span>Blank uses account default</span><input type="number" min="0" max="200" value={details.newCardLimit} onChange={(event) => setDetails({ ...details, newCardLimit: event.target.value })} /></label></div><label className="field-label">Grading mode<select value={details.gradingMode} onChange={(event) => setDetails({ ...details, gradingMode: event.target.value })}><option value="">Use account default</option><option value="anki">Four grades</option><option value="simple">Again or Good</option></select></label>{localError && <p className="field-error">{localError}</p>}</div>
        <div className="modal-footer"><button className="button button-ghost" type="button" onClick={() => { setEditingDetails(false); setLocalError('') }}>Cancel</button><button className="button button-primary" type="button" onClick={saveDetails} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
      </Modal>}

      {sharingOpen && <Modal title="Share this deck" onClose={() => { setSharingOpen(false); setCopiedLink(false); setLocalError('') }}>
        <div className="modal-body form-stack">
          <div className="modal-callout"><Icon name="sparkles" /><p>{deck.isPublic ? 'Anyone with the link can preview this deck and make their own copy. Your account details and review history stay private.' : 'Publishing creates a read-only preview. Your account details, progress, and review history are never included.'}</p></div>
          {deck.isPublic && <label className="field-label">Public link<div className="share-link-row"><input value={`${window.location.origin}/shared/${deck.shareToken}`} readOnly /><button className="button button-secondary" type="button" onClick={copyShareLink}>{copiedLink ? 'Copied!' : 'Copy'}</button></div></label>}
          {localError && <p className="field-error">{localError}</p>}
        </div>
        <div className="modal-footer"><button className="button button-ghost" type="button" onClick={() => setSharingOpen(false)}>Close</button><button className={`button ${deck.isPublic ? 'button-secondary' : 'button-primary'}`} type="button" onClick={toggleSharing} disabled={busy}>{busy ? 'Saving…' : deck.isPublic ? 'Make private' : 'Publish deck'}</button></div>
      </Modal>}
    </div>
  )
}

