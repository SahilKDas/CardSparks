import { Icon } from './Icons'

export function blankCard() {
  return { id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, front: '', back: '', mastery: 0 }
}

export default function CardEditor({ card, index, onChange, onDelete, autoFocus = false }) {
  return (
    <div className="card-editor">
      <div className="card-editor-number">{String(index + 1).padStart(2, '0')}</div>
      <label>
        <span>Front</span>
        <textarea
          value={card.front}
          onChange={(event) => onChange({ ...card, front: event.target.value })}
          placeholder="Ask a clear, focused question…"
          rows="3"
          autoFocus={autoFocus}
        />
      </label>
      <span className="card-divider" />
      <label>
        <span>Back</span>
        <textarea
          value={card.back}
          onChange={(event) => onChange({ ...card, back: event.target.value })}
          placeholder="Add the answer or explanation…"
          rows="3"
        />
      </label>
      <button className="editor-delete" type="button" onClick={onDelete} aria-label={`Delete card ${index + 1}`}><Icon name="trash" size={17} /></button>
    </div>
  )
}

