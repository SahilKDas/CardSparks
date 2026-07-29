import { CARD_TYPES } from '../lib/cardTypes'
import { Icon } from './Icons'

export function blankCard() {
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    front: '',
    back: '',
    mastery: 0,
    cardType: 'basic',
    choices: ['', ''],
    correctIndex: 0,
    imageUrl: '',
  }
}

export default function CardEditor({ card, index, onChange, onDelete, autoFocus = false, showDelete = true }) {
  const type = card.cardType || 'basic'
  const choices = card.choices?.length ? card.choices : ['', '']

  function changeType(cardType) {
    // Reset mutually exclusive fields when switching type so stale choice or
    // image data cannot accidentally be submitted with the new representation.
    onChange({ ...card, cardType, choices: cardType === 'multiple_choice' ? choices : [], correctIndex: cardType === 'multiple_choice' ? (card.correctIndex ?? 0) : null, imageUrl: cardType === 'image' ? card.imageUrl || '' : '' })
  }

  function updateChoice(choiceIndex, value) {
    onChange({ ...card, choices: choices.map((choice, indexValue) => indexValue === choiceIndex ? value : choice) })
  }

  function removeChoice(choiceIndex) {
    const next = choices.filter((_, indexValue) => indexValue !== choiceIndex)
    const correctIndex = card.correctIndex === choiceIndex ? 0 : Math.max(0, (card.correctIndex || 0) - (card.correctIndex > choiceIndex ? 1 : 0))
    onChange({ ...card, choices: next, correctIndex })
  }

  return (
    <div className="card-editor">
      <div className="card-editor-number">{String(index + 1).padStart(2, '0')}</div>
      <label className="card-editor-type"><span>Card type</span><select value={type} onChange={(event) => changeType(event.target.value)}>{CARD_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label className="card-editor-front"><span>{type === 'cloze' ? 'Statement with {{hidden text}}' : 'Front'}</span><textarea value={card.front} onChange={(event) => onChange({ ...card, front: event.target.value })} placeholder={type === 'cloze' ? 'ATP is produced by {{mitochondria}}.' : 'Ask a clear, focused question…'} rows="3" autoFocus={autoFocus} /></label>
      <span className="card-divider" />
      <label className="card-editor-back"><span>{type === 'cloze' ? 'Extra explanation' : 'Back'}</span><textarea value={card.back} onChange={(event) => onChange({ ...card, back: event.target.value })} placeholder="Add the answer or explanation…" rows="3" /></label>
      {showDelete && <button className="editor-delete" type="button" onClick={onDelete} aria-label={`Delete card ${index + 1}`}><Icon name="trash" size={17} /></button>}

      {type === 'image' && <label className="card-editor-extra"><span>Image URL</span><input type="url" value={card.imageUrl || ''} onChange={(event) => onChange({ ...card, imageUrl: event.target.value })} placeholder="https://example.com/diagram.png" /></label>}
      {type === 'multiple_choice' && <fieldset className="choice-editor"><legend>Answer choices</legend>{choices.map((choice, choiceIndex) => <div key={choiceIndex}><input type="radio" name={`correct-${card.id}`} checked={(card.correctIndex ?? 0) === choiceIndex} onChange={() => onChange({ ...card, correctIndex: choiceIndex })} aria-label={`Mark choice ${choiceIndex + 1} correct`} /><input value={choice} onChange={(event) => updateChoice(choiceIndex, event.target.value)} placeholder={`Choice ${choiceIndex + 1}`} />{choices.length > 2 && <button type="button" onClick={() => removeChoice(choiceIndex)} aria-label={`Remove choice ${choiceIndex + 1}`}><Icon name="x" size={14} /></button>}</div>)}{choices.length < 6 && <button className="text-button" type="button" onClick={() => onChange({ ...card, choices: [...choices, ''] })}><Icon name="plus" size={14} /> Add choice</button>}</fieldset>}
      {type === 'reversible' && <p className="card-type-help">This card studies the back as the prompt and the front as the answer.</p>}
    </div>
  )
}
