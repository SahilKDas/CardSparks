import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CardEditor, { blankCard } from '../components/CardEditor'
import { ErrorBanner } from '../components/Feedback'
import { Icon } from '../components/Icons'
import { useApp } from '../context/useApp'
import {
  MAX_NOTES_LENGTH,
  deriveNotesTitle,
  validateStudyNotes,
} from '../lib/studyFeatures'
import { extractNotesFile, NOTES_FILE_ACCEPT } from '../lib/fileNotes'
import { parseTags } from '../lib/organize'
import { validateCardDraft } from '../lib/cardTypes'

const colorOptions = ['coral', 'violet', 'blue', 'green', 'yellow']

function newDraft(cards = []) {
  return { title: '', description: '', folder: '', tagsText: '', cards, color: 'coral', emoji: '✨' }
}

export default function CreateDeck() {
  const { createDeck, generateCards, generateCardsFromNotes } = useApp()
  const navigate = useNavigate()
  const [mode, setMode] = useState('ai')
  const [drafts, setDrafts] = useState(() => ({
    ai: newDraft(),
    notes: newDraft(),
    manual: newDraft([blankCard(), blankCard()]),
  }))
  const [topic, setTopic] = useState('')
  const [notes, setNotes] = useState('')
  const [generationCounts, setGenerationCounts] = useState({ ai: 8, notes: 8 })
  const [generating, setGenerating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importedFile, setImportedFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState('')

  const draft = drafts[mode]
  const completeCards = useMemo(
    () => draft.cards.filter((card) => card.front.trim() && card.back.trim()),
    [draft.cards],
  )

  function updateDraft(targetMode, update) {
    setDrafts((current) => ({
      ...current,
      [targetMode]: typeof update === 'function' ? update(current[targetMode]) : { ...current[targetMode], ...update },
    }))
  }

  function switchMode(nextMode) {
    setMode(nextMode)
    setLocalError('')
  }

  async function handleGenerate() {
    const generationMode = mode
    const count = generationCounts[generationMode]
    let generated

    if (generationMode === 'ai' && !topic.trim()) {
      setLocalError('Give CardSparks a topic or study prompt first.')
      return
    }
    if (generationMode === 'notes') {
      const notesError = validateStudyNotes(notes)
      if (notesError) {
        setLocalError(notesError)
        return
      }
    }

    setGenerating(true)
    setLocalError('')
    try {
      generated = generationMode === 'notes'
        ? await generateCardsFromNotes(notes.trim(), count)
        : await generateCards(topic.trim(), count)
      if (!generated.length) throw new Error('The generator returned no cards. Try adding more detail.')

      updateDraft(generationMode, (current) => ({
        ...current,
        cards: generated,
        title: current.title || (generationMode === 'notes' ? deriveNotesTitle(notes) : topic.trim()),
        description: current.description || (generationMode === 'notes'
          ? 'An editable review deck generated from pasted study notes.'
          : `A focused review of ${topic.trim()}, generated with CardSparks AI.`),
      }))
    } catch (error) {
      setLocalError(error.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleFileImport(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    setLocalError('')
    try {
      // Parsing stays local. We only place the extracted text into the same
      // editable notes state used by paste mode, preserving one validation and
      // generation path for every supported source format.
      const result = await extractNotesFile(file, MAX_NOTES_LENGTH)
      setNotes(result.text)
      setImportedFile({ name: file.name, truncated: result.truncated })
    } catch (error) {
      setImportedFile(null)
      setLocalError(error.message)
    } finally {
      setImporting(false)
      // Allow selecting the same file again after it has been edited externally.
      event.target.value = ''
    }
  }

  function updateCard(index, card) {
    updateDraft(mode, (current) => ({
      ...current,
      cards: current.cards.map((item, itemIndex) => itemIndex === index ? card : item),
    }))
  }

  function deleteCard(index) {
    updateDraft(mode, (current) => ({
      ...current,
      cards: current.cards.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  function resetGeneratedDraft() {
    updateDraft(mode, (current) => ({ ...current, title: '', description: '', cards: [] }))
    setLocalError('')
  }

  async function handleSave() {
    if (!draft.title.trim()) {
      setLocalError('Add a name for your deck.')
      return
    }
    if (!completeCards.length) {
      setLocalError('Add at least one card with both a front and back.')
      return
    }
    const invalidCardIndex = completeCards.findIndex((card) => validateCardDraft(card))
    if (invalidCardIndex >= 0) {
      setLocalError(`Card ${invalidCardIndex + 1}: ${validateCardDraft(completeCards[invalidCardIndex])}`)
      return
    }
    setSaving(true)
    setLocalError('')
    try {
      const cleanedCards = completeCards.map((card) => ({
        ...card,
        front: card.front.trim(),
        back: card.back.trim(),
      }))
      const deck = await createDeck({
        title: draft.title.trim(),
        description: draft.description.trim(),
        folder: draft.folder.trim(),
        tags: parseTags(draft.tagsText),
        emoji: draft.emoji,
        color: draft.color,
        cards: cleanedCards,
      })
      navigate(`/decks/${deck.id}`)
    } catch (error) {
      setLocalError(error.message)
    } finally {
      setSaving(false)
    }
  }

  const generatedMode = mode === 'ai' || mode === 'notes'
  const showingGenerator = generatedMode && draft.cards.length === 0
  const switchingDisabled = generating || saving || importing

  return (
    <div className="page create-page">
      <div className="page-breadcrumb"><Link to="/decks"><Icon name="arrowLeft" size={16} /> My decks</Link></div>
      <header className="create-header">
        <span className="eyebrow"><Icon name="sparkles" size={14} /> Make something memorable</span>
        <h1>Create a new deck</h1>
        <p>Start with a topic, import your study notes, or build every card yourself.</p>
      </header>

      <div className="mode-switch" role="tablist" aria-label="Creation method">
        <button id="mode-ai" className={mode === 'ai' ? 'active' : ''} type="button" onClick={() => switchMode('ai')} role="tab" aria-selected={mode === 'ai'} aria-controls="creation-content" disabled={switchingDisabled}><span><Icon name="wand" /></span><div><strong>Generate with AI</strong><small>From a topic or prompt</small></div>{mode === 'ai' && <Icon name="check" size={17} />}</button>
        <button id="mode-notes" className={mode === 'notes' ? 'active' : ''} type="button" onClick={() => switchMode('notes')} role="tab" aria-selected={mode === 'notes'} aria-controls="creation-content" disabled={switchingDisabled}><span><Icon name="notes" /></span><div><strong>Import study notes</strong><small>Paste or upload your material</small></div>{mode === 'notes' && <Icon name="check" size={17} />}</button>
        <button id="mode-manual" className={mode === 'manual' ? 'active' : ''} type="button" onClick={() => switchMode('manual')} role="tab" aria-selected={mode === 'manual'} aria-controls="creation-content" disabled={switchingDisabled}><span><Icon name="manual" /></span><div><strong>Build it myself</strong><small>Add your own cards</small></div>{mode === 'manual' && <Icon name="check" size={17} />}</button>
      </div>

      <ErrorBanner message={localError} onDismiss={() => setLocalError('')} />
      <p className="sr-only" role="status" aria-live="polite">{generating ? 'CardSparks is generating your card preview.' : ''}</p>

      <div id="creation-content" role="tabpanel" aria-labelledby={`mode-${mode}`}>
        {showingGenerator && mode === 'ai' && (
          <section className="creation-panel ai-generator-panel">
            <div className="panel-heading"><span className="big-panel-icon"><Icon name="wand" size={25} /></span><div><h2>What do you want to learn?</h2><p>Be specific for sharper, more useful cards.</p></div></div>
            <label className="field-label">Topic or prompt<textarea value={topic} onChange={(event) => setTopic(event.target.value)} placeholder={'Try “Photosynthesis for AP Biology” or “Spanish past-tense verbs with examples”'} rows="4" maxLength="1000" /></label>
            <GenerationControls mode={mode} count={generationCounts[mode]} setCounts={setGenerationCounts} generating={generating} onGenerate={handleGenerate} />
            <div className="prompt-suggestions"><span>Need a spark?</span>{['The water cycle', 'JavaScript closures', 'Italian travel phrases'].map((item) => <button key={item} type="button" onClick={() => setTopic(item)}>{item}</button>)}</div>
          </section>
        )}

        {showingGenerator && mode === 'notes' && (
          <section className="creation-panel ai-generator-panel notes-generator-panel">
            <div className="panel-heading"><span className="big-panel-icon"><Icon name="notes" size={25} /></span><div><h2>Add the material you need to remember</h2><p>Paste notes or extract them from a PDF, DOCX, TXT, or Markdown file.</p></div></div>
            <label className={`notes-file-drop ${importing ? 'is-loading' : ''}`}>
              <input type="file" accept={NOTES_FILE_ACCEPT} onChange={handleFileImport} disabled={importing || generating} />
              <span className="notes-file-icon"><Icon name="notes" size={21} /></span>
              <span><strong>{importing ? 'Reading your fileâ€¦' : 'Upload study notes'}</strong><small>PDF, DOCX, TXT, or Markdown Â· up to 10 MB</small></span>
              <span className="button button-secondary">Choose file</span>
            </label>
            {importedFile && (
              <p className={`file-import-status ${importedFile.truncated ? 'is-warning' : ''}`} role="status">
                <Icon name={importedFile.truncated ? 'clock' : 'check'} size={14} />
                {importedFile.name} imported{importedFile.truncated ? `; only the first ${MAX_NOTES_LENGTH.toLocaleString()} characters were kept.` : '.'}
              </p>
            )}
            <div className="notes-divider"><span>or paste notes</span></div>
            <label className="field-label" htmlFor="study-notes">
              <span className="field-label-row"><strong>Study notes</strong><span className={notes.length > MAX_NOTES_LENGTH ? 'over-limit' : ''}>{notes.length.toLocaleString()} / {MAX_NOTES_LENGTH.toLocaleString()}</span></span>
              <textarea id="study-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Paste lecture notes, a reading summary, or your study guide here…" rows="12" maxLength={MAX_NOTES_LENGTH} aria-describedby="study-notes-help" />
            </label>
            <p id="study-notes-help" className="notes-privacy"><Icon name="check" size={14} /> Files are extracted in your browser. Source text is used for this preview and is not saved with the deck.</p>
            <GenerationControls mode={mode} count={generationCounts[mode]} setCounts={setGenerationCounts} generating={generating} onGenerate={handleGenerate} />
          </section>
        )}

        {!showingGenerator && (
          <div className="deck-builder">
            <section className="creation-panel deck-details-panel">
              <div className="panel-heading compact-heading"><div><h2>Deck details</h2><p>Give this collection a clear identity.</p></div></div>
              <div className="deck-details-grid">
                <label className="emoji-picker">Cover<input value={draft.emoji} onChange={(event) => updateDraft(mode, { emoji: Array.from(event.target.value).slice(0, 4).join('') })} maxLength="8" aria-label="Deck emoji" /></label>
                <label className="field-label">Deck name<input value={draft.title} onChange={(event) => updateDraft(mode, { title: event.target.value })} placeholder="e.g. Cell Biology Essentials" maxLength="256" /></label>
                <label className="field-label wide">Description <span>Optional</span><input value={draft.description} onChange={(event) => updateDraft(mode, { description: event.target.value })} placeholder="What will this deck help you remember?" /></label>
                <label className="field-label">Folder <span>Optional</span><input value={draft.folder} onChange={(event) => updateDraft(mode, { folder: event.target.value })} placeholder="e.g. Semester 1" maxLength="80" /></label>
                <label className="field-label wide">Tags <span>Comma-separated, up to 10</span><input value={draft.tagsText} onChange={(event) => updateDraft(mode, { tagsText: event.target.value })} placeholder="biology, midterm, chapter 4" /></label>
                <div className="field-label color-field">Accent color<div className="color-options">{colorOptions.map((option) => <button key={option} type="button" className={`${option} ${draft.color === option ? 'selected' : ''}`} onClick={() => updateDraft(mode, { color: option })} aria-label={`Use ${option} accent`}><Icon name="check" size={13} /></button>)}</div></div>
              </div>
            </section>

            <section className="cards-builder-section">
              <div className="builder-heading"><div><h2>{generatedMode ? 'Review your cards' : 'Add your cards'}</h2><p>{mode === 'notes' ? 'Built from your notes. Edit anything before saving.' : mode === 'ai' ? 'AI made the first draft. You have the final word.' : 'Keep each card focused on one idea.'}</p></div><span>{completeCards.length} ready</span></div>
              <div className="card-editor-list">
                {draft.cards.map((card, index) => <CardEditor key={card.id} card={card} index={index} onChange={(next) => updateCard(index, next)} onDelete={() => deleteCard(index)} />)}
              </div>
              <button className="add-card-button" type="button" onClick={() => updateDraft(mode, (current) => ({ ...current, cards: [...current.cards, blankCard()] }))}><Icon name="plus" size={18} /> Add another card</button>
              {generatedMode && <button className="text-button regenerate-link" type="button" onClick={resetGeneratedDraft}><Icon name="refresh" size={15} /> {mode === 'notes' ? 'Return to my pasted notes' : 'Start over with a different prompt'}</button>}
            </section>

            <div className="builder-footer"><Link className="button button-ghost" to="/decks">Cancel</Link><button className="button button-primary" type="button" disabled={saving} onClick={handleSave}>{saving ? <><span className="button-spinner" /> Saving…</> : <><Icon name="save" size={17} /> Save deck</>}</button></div>
          </div>
        )}
      </div>
    </div>
  )
}

function GenerationControls({ mode, count, setCounts, generating, onGenerate }) {
  return (
    <div className="generator-row">
      <label className="field-label compact">Number of cards<select value={count} onChange={(event) => setCounts((current) => ({ ...current, [mode]: Number(event.target.value) }))}><option value="5">5 cards</option><option value="8">8 cards</option><option value="10">10 cards</option><option value="15">15 cards</option><option value="20">20 cards</option></select></label>
      <button className="button button-primary generate-button" type="button" onClick={onGenerate} disabled={generating}>{generating ? <><span className="button-spinner" /> Creating your cards…</> : <><Icon name="sparkles" size={18} /> Generate cards</>}</button>
    </div>
  )
}
