import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorBanner, Spinner } from '../components/Feedback'
import { Icon } from '../components/Icons'
import { useApp } from '../context/useApp'
import { convertCardType, tagsAfter } from '../lib/bulkCards'

export default function BulkEditor() {
  const { decks, loading, updateCard, bulkDeleteCards, bulkUpdateCards, bulkMoveCards, bulkUpdateDecks } = useApp()
  const rows = useMemo(() => decks.flatMap((deck) => deck.cards.map((card) => ({ ...card, deckId: deck.id, deckTitle: deck.title }))), [decks])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [drafts, setDrafts] = useState({})
  const [targetDeck, setTargetDeck] = useState('')
  const [cardType, setCardType] = useState('basic')
  const [tag, setTag] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const filtered = rows.filter((row) => `${row.front} ${row.back} ${row.deckTitle}`.toLowerCase().includes(query.toLowerCase()))
  const selectedRows = rows.filter((row) => selected.has(String(row.id)))

  function toggle(id) {
    setSelected((current) => { const next = new Set(current); const key = String(id); if (next.has(key)) next.delete(key); else next.add(key); return next })
  }

  async function run(operation) {
    setBusy(true); setError('')
    try { await operation(); setSelected(new Set()) } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }

  async function saveRow(row) {
    const draft = drafts[row.id]
    if (!draft?.front.trim() || !draft?.back.trim()) return setError('Both card sides are required.')
    setBusy(true); setError('')
    try { await updateCard(row.id, { ...row, ...draft }); setDrafts((current) => { const next = { ...current }; delete next[row.id]; return next }) } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }

  function changeTypes() {
    const pool = selectedRows.map((row) => row.back)
    return run(() => bulkUpdateCards(selectedRows.map((row) => ({ cardId: row.id, card: convertCardType(row, cardType, pool) }))))
  }

  function updateTags(mode) {
    const deckIds = [...new Set(selectedRows.map((row) => String(row.deckId)))]
    return run(() => bulkUpdateDecks(deckIds.map((deckId) => { const deck = decks.find((item) => String(item.id) === deckId); return { deckId, changes: { tags: tagsAfter(deck.tags, tag, mode) } } })))
  }

  if (loading) return <div className="page"><Spinner label="Loading bulk editor" /></div>
  return <div className="page bulk-page"><header className="page-head"><div><span className="eyebrow"><Icon name="edit" size={14} /> Bulk deck editor</span><h1>Edit your library at scale.</h1><p>Edit individual rows or select cards for moving, deletion, type conversion, and deck-level tag changes.</p></div><Link className="button button-secondary" to="/decks">Done</Link></header>{error && <ErrorBanner message={error} onDismiss={() => setError('')} />}<section className="bulk-toolbar"><label className="search-field"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search cards or decks" /></label><span>{selected.size} selected</span><button className="text-button" type="button" onClick={() => setSelected(new Set(filtered.map((row) => String(row.id))))}>Select visible</button><button className="text-button" type="button" onClick={() => setSelected(new Set())}>Clear</button></section>{selected.size > 0 && <section className="bulk-actions" aria-label="Bulk actions"><label>Move to<select value={targetDeck} onChange={(event) => setTargetDeck(event.target.value)}><option value="">Choose deck</option>{decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.title}</option>)}</select></label><button type="button" disabled={busy || !targetDeck || selectedRows.some((row) => String(row.deckId) === targetDeck)} onClick={() => run(() => bulkMoveCards(selectedRows, targetDeck))}>Move</button><label>Card type<select value={cardType} onChange={(event) => setCardType(event.target.value)}><option value="basic">Basic</option><option value="reversible">Reversible</option><option value="multiple_choice">Multiple choice</option></select></label><button type="button" disabled={busy} onClick={changeTypes}>Change type</button><label>Deck tag<input value={tag} onChange={(event) => setTag(event.target.value)} placeholder="exam" maxLength="30" /></label><button type="button" disabled={busy || !tag.trim()} onClick={() => updateTags('add')}>Add tag</button><button type="button" disabled={busy || !tag.trim()} onClick={() => updateTags('remove')}>Remove tag</button><button className="is-destructive" type="button" disabled={busy} onClick={() => window.confirm(`Delete ${selected.size} selected cards?`) && run(() => bulkDeleteCards([...selected]))}>Delete</button></section>}<div className="bulk-table-wrap"><table className="bulk-table"><thead><tr><th aria-label="Select" /><th>Deck</th><th>Front</th><th>Back</th><th>Type</th><th>Action</th></tr></thead><tbody>{filtered.map((row) => { const draft = drafts[row.id] || { front: row.front, back: row.back }; return <tr key={row.id}><td><input type="checkbox" checked={selected.has(String(row.id))} onChange={() => toggle(row.id)} aria-label={`Select ${row.front}`} /></td><td><Link to={`/decks/${row.deckId}`}>{row.deckTitle}</Link></td><td><textarea value={draft.front} onChange={(event) => setDrafts((current) => ({ ...current, [row.id]: { ...draft, front: event.target.value } }))} /></td><td><textarea value={draft.back} onChange={(event) => setDrafts((current) => ({ ...current, [row.id]: { ...draft, back: event.target.value } }))} /></td><td>{row.cardType.replace('_', ' ')}</td><td><button className="text-button" type="button" disabled={busy || !drafts[row.id]} onClick={() => saveRow(row)}>Save</button></td></tr> })}</tbody></table>{!filtered.length && <p className="bulk-empty">No cards match this search.</p>}</div></div>
}
