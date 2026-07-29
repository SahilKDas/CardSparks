export function convertCardType(card, cardType, answerPool = []) {
  if (cardType === 'multiple_choice') {
    const distractors = answerPool.filter((answer, index, all) => answer && answer !== card.back && all.indexOf(answer) === index).slice(0, 3)
    if (!distractors.length) throw new Error('Select cards with at least two different answers before converting to multiple choice.')
    return { ...card, cardType, choices: [card.back, ...distractors], correctIndex: 0, imageUrl: '' }
  }
  return { ...card, cardType, choices: [], correctIndex: null, imageUrl: '' }
}

export function tagsAfter(tags, value, mode) {
  const clean = String(value || '').trim()
  const current = Array.isArray(tags) ? tags : []
  if (!clean) return current
  if (mode === 'remove') return current.filter((tag) => tag.toLowerCase() !== clean.toLowerCase())
  return current.some((tag) => tag.toLowerCase() === clean.toLowerCase()) ? current : [...current, clean].slice(0, 10)
}
