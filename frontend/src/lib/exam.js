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

const COMMON_WORDS = new Set(['about', 'after', 'also', 'answer', 'because', 'before', 'being', 'from', 'into', 'other', 'that', 'their', 'there', 'these', 'this', 'through', 'what', 'when', 'where', 'which', 'with'])

function conceptWords(value) {
  return String(value || '').toLowerCase().match(/[a-z0-9]+/g)?.filter((word) => word.length > 2 && !COMMON_WORDS.has(word)) || []
}

function shorten(value, limit) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length <= limit ? text : `${text.slice(0, Math.max(1, limit - 1)).trimEnd()}…`
}

/**
 * Produce a deterministic first-pass diagnosis while the optional AI summary
 * loads independently. The wording is deliberately tentative: an incorrect
 * multiple-choice answer can suggest a misconception, but cannot prove one.
 */
export function analyzeMisconception(result) {
  if (!result || result.correct) return null
  const correctAnswer = result.options?.[result.correctIndex]?.text || 'the correct answer'
  const selectedAnswer = Number.isInteger(result.selected) ? result.options?.[result.selected]?.text : ''
  const correctWords = new Set(conceptWords(correctAnswer))
  const overlap = conceptWords(selectedAnswer).filter((word) => correctWords.has(word))
  let title = 'Recall gap'
  let explanation = `This concept was left unanswered. Reconnect the prompt with “${shorten(correctAnswer, 140)}.”`

  if (selectedAnswer) {
    title = overlap.length ? 'Boundary confusion' : 'Concept association'
    explanation = overlap.length
      ? `The two answers share language around ${overlap.slice(0, 3).join(', ')}, so their boundaries may be blending together.`
      : `You may be associating this prompt with “${shorten(selectedAnswer, 110)}” instead of the target concept.`
  }

  const prompt = shorten(result.prompt, 180)
  const correction = `For “${prompt}”, anchor your recall to “${shorten(correctAnswer, 180)}.”`
  const followUpFront = selectedAnswer
    ? shorten(`How can you distinguish “${selectedAnswer}” from the correct answer to “${prompt}”?`, 300)
    : shorten(`What is the best answer to “${prompt}”?`, 300)
  const followUpBack = selectedAnswer
    ? shorten(`The correct answer is “${correctAnswer}”. “${selectedAnswer}” is a distractor in this context.`, 600)
    : shorten(correctAnswer, 600)

  return {
    title,
    explanation,
    correction,
    followUpCard: {
      front: followUpFront,
      back: followUpBack,
      mastery: 0,
      cardType: 'basic',
      choices: [],
      correctIndex: null,
      imageUrl: '',
    },
  }
}
