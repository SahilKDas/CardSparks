import { studyFaces } from './cardTypes.js'

function seededNumber(seedText) {
  let value = 2166136261
  for (const character of String(seedText)) value = Math.imul(value ^ character.charCodeAt(0), 16777619)
  return () => ((value = Math.imul(value ^ (value >>> 15), 2246822519)) >>> 0) / 4294967296
}

function shuffle(values, random) {
  const copy = [...values]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
  }
  return copy
}

/** Convert every supported card type into a multiple-choice exam question. */
export function buildExamQuestions(deck, count, seed = Date.now()) {
  const cards = Array.isArray(deck?.cards) ? deck.cards : []
  const random = seededNumber(`${deck?.id}-${seed}`)
  return shuffle(cards, random).slice(0, Math.max(1, Math.min(Number(count) || cards.length, cards.length))).map((card) => {
    const faces = studyFaces(card)
    let sourceChoices = card.cardType === 'multiple_choice'
      ? card.choices.map((text, index) => ({ text, correct: index === card.correctIndex }))
      : [
          { text: faces.back, correct: true },
          ...shuffle(cards.filter((item) => item.id !== card.id).map((item) => studyFaces(item).back), random)
            .filter((text, index, all) => text && text !== faces.back && all.indexOf(text) === index)
            .slice(0, 3)
            .map((text) => ({ text, correct: false })),
        ]
    if (!sourceChoices.some((option) => option.correct) && sourceChoices.length) sourceChoices[0] = { ...sourceChoices[0], correct: true }
    if (sourceChoices.length < 2) sourceChoices.push({ text: 'None of the other answers', correct: false })
    return { cardId: card.id, prompt: faces.front, options: shuffle(sourceChoices, random) }
  })
}

export function scoreExam(questions, answers) {
  return questions.map((question, index) => {
    const selected = answers[index]
    const correctIndex = question.options.findIndex((option) => option.correct)
    return { ...question, selected, correctIndex, correct: selected === correctIndex }
  })
}
