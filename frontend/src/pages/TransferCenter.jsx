import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorBanner } from '../components/Feedback'
import { Icon } from '../components/Icons'
import { useApp } from '../context/useApp'
import { backupPayload, deckCsv, exportFilename, parseTransfer } from '../lib/transfer'

function download(contents, filename, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = filename; anchor.click()
  URL.revokeObjectURL(url)
}

export default function TransferCenter() {
  const { decks, createDeck } = useApp()
  const [deckId, setDeckId] = useState(decks[0]?.id || '')
  const [preview, setPreview] = useState(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const selectedDeck = decks.find((deck) => String(deck.id) === String(deckId))

  async function readFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(''); setPreview(null); setFileName(file.name)
    try { if (file.size > 10 * 1024 * 1024) throw new Error('Choose an import file smaller than 10 MB.'); setPreview(parseTransfer(await file.text(), file.name, decks)) } catch (parseError) { setError(parseError.message) }
    event.target.value = ''
  }

  async function importPreview() {
    setImporting(true); setError('')
    try {
      for (const deck of preview.decks) {
        const cards = deck.cards.filter((card) => !card.duplicate && !card.errors.length)
        if (!cards.length) continue
        await createDeck({ title: deck.title || 'Imported deck', description: deck.description || '', folder: deck.folder || '', tags: deck.tags || [], emoji: deck.emoji || '📥', color: deck.color || 'blue', cards })
      }
      setPreview(null); setFileName('')
    } catch (requestError) { setError(requestError.message) } finally { setImporting(false) }
  }

  return <div className="page transfer-page"><header className="page-head"><div><span className="eyebrow"><Icon name="save" size={14} /> Transfer center</span><h1>Your cards should never be trapped.</h1><p>Export portable deck files or validate an import before anything is saved.</p></div><Link className="button button-secondary" to="/decks">Back to decks</Link></header>{error && <ErrorBanner message={error} onDismiss={() => setError('')} />}<div className="transfer-grid"><section className="transfer-panel"><span className="transfer-icon"><Icon name="arrowRight" size={22} /></span><h2>Export</h2><p>JSON backups preserve CardSparks metadata. CSV works in spreadsheets, and tab-separated text imports into Anki.</p><label className="field-label">Deck<select value={deckId} onChange={(event) => setDeckId(event.target.value)}>{decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.title}</option>)}</select></label><div className="transfer-actions"><button className="button button-secondary" type="button" disabled={!selectedDeck} onClick={() => download(deckCsv(selectedDeck), exportFilename(selectedDeck, 'csv'), 'text/csv')}>Export CSV</button><button className="button button-secondary" type="button" disabled={!selectedDeck} onClick={() => download(deckCsv(selectedDeck, '\t'), exportFilename(selectedDeck, 'anki'), 'text/tab-separated-values')}>Export for Anki</button><button className="button button-primary" type="button" disabled={!decks.length} onClick={() => download(backupPayload(decks), 'cardsparks-backup.json', 'application/json')}>Back up all decks</button></div></section><section className="transfer-panel"><span className="transfer-icon"><Icon name="plus" size={22} /></span><h2>Import preview</h2><p>Choose a CardSparks JSON backup, CSV, or Anki-compatible TSV file. Duplicate and invalid rows are skipped.</p><label className="notes-file-drop"><input type="file" accept=".json,.csv,.tsv,text/csv,text/tab-separated-values,application/json" onChange={readFile} /><span><strong>Choose an import file</strong><small>Nothing saves until you approve the preview</small></span></label>{fileName && <p className="file-import-status"><Icon name="check" size={14} /> {fileName}</p>}</section></div>{preview && <section className="import-preview"><div className="stat-section-head"><div><h2>Import preview</h2><span>{preview.validCards} ready · {preview.duplicates} duplicates · {preview.errors.length} invalid</span></div><button className="button button-primary" type="button" disabled={!preview.validCards || importing} onClick={importPreview}>{importing ? 'Importing…' : `Import ${preview.validCards} cards`}</button></div>{preview.errors.length > 0 && <ul className="import-errors">{preview.errors.slice(0, 20).map((message) => <li key={message}>{message}</li>)}</ul>}<div className="import-decks">{preview.decks.map((deck, index) => <article key={`${deck.title}-${index}`}><h3>{deck.title}</h3><span>{deck.cards.filter((card) => !card.duplicate && !card.errors.length).length} ready</span><div>{deck.cards.slice(0, 8).map((card, cardIndex) => <p key={cardIndex} className={card.duplicate || card.errors.length ? 'is-skipped' : ''}><strong>{card.front || 'Missing front'}</strong><span>{card.duplicate ? 'Duplicate' : card.errors.join(', ') || 'Ready'}</span></p>)}</div></article>)}</div></section>}</div>
}
