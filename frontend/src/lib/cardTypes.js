export const CARD_TYPES = [
  { value: 'basic', label: 'Basic' },
  { value: 'reversible', label: 'Reversible' },
  { value: 'multiple_choice', label: 'Multiple choice' },
  { value: 'cloze', label: 'Cloze deletion' },
  { value: 'image', label: 'Image' },
]

export function clozePrompt(value) {
  return String(value || '').replace(/\{\{([^{}]+)}}/g, '[…]')
}

export function clozeAnswer(value) {
  return String(value || '').replace(/\{\{([^{}]+)}}/g, '$1')
}

/** Validate authoring rules before a request reaches the backend. */
export function validateCardDraft(card) {
  if (!String(card.front || '').trim() || !String(card.back || '').trim()) return 'Every card needs both a front and back.'
  if (!CARD_TYPES.some((type) => type.value === (card.cardType || 'basic'))) return 'Choose a supported card type.'
  if (card.cardType === 'cloze' && !/\{\{[^{}]+}}/.test(card.front)) return 'Cloze cards need hidden text wrapped in {{double braces}}.'
  if (card.cardType === 'multiple_choice') {
    const choices = card.choices || []
    if (choices.length < 2 || choices.length > 6) return 'Multiple-choice cards need 2 to 6 answers.'
    if (choices.some((choice) => !String(choice).trim())) return 'Every multiple-choice answer needs text.'
    if (!Number.isInteger(card.correctIndex) || card.correctIndex < 0 || card.correctIndex >= choices.length) return 'Choose the correct multiple-choice answer.'
  }
  if (card.cardType === 'image') {
    try {
      const url = new URL(card.imageUrl)
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
    } catch {
      return 'Image cards need a valid http or https image URL.'
    }
  }
  return ''
}

export function studyFaces(card) {
  // Study consumes one consistent pair of faces. Authoring details are reduced
  // here instead of spread across render branches, so keyboard flipping and
  // SM-2 grading behave identically for every card type.
  if (card.cardType === 'reversible') return { front: card.back, back: card.front, frontLabel: 'Reverse prompt', backLabel: 'Original front' }
  if (card.cardType === 'cloze') {
    const completed = clozeAnswer(card.front)
    return { front: clozePrompt(card.front), back: card.back ? `${completed} — ${card.back}` : completed, frontLabel: 'Fill the blank', backLabel: 'Completed statement' }
  }
  return { front: card.front, back: card.back, frontLabel: 'Question', backLabel: 'Answer' }
}
