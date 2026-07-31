function clampInteger(value, minimum, maximum) {
  return Math.max(minimum, Math.min(Math.round(Number(value) || 0), maximum))
}

function safeLabel(value) {
  return String(value || 'Study session').replace(/\s+/g, ' ').trim().slice(0, 32) || 'Study session'
}

export function buildStudyResult({ correct, total, label = 'Study session' }) {
  const safeTotal = Math.max(0, Math.round(Number(total) || 0))
  const safeCorrect = clampInteger(correct, 0, safeTotal)
  const score = safeTotal ? Math.round((safeCorrect / safeTotal) * 100) : 0
  const missed = safeTotal - safeCorrect
  const headline = score >= 90 ? 'Ready to shine' : score >= 70 ? 'Momentum building' : 'Growth in progress'
  const nextGoal = missed
    ? `Review ${missed} missed ${missed === 1 ? 'card' : 'cards'}, then try again.`
    : 'Let spacing do its work, then return when cards are due.'

  // This object intentionally accepts no learner identity, deck title, prompt,
  // or answer content. Everything rendered or shared is aggregate-only.
  return { label: safeLabel(label), correct: safeCorrect, total: safeTotal, missed, score, headline, nextGoal }
}

function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, (character) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
  })[character])
}

export function createStudyResultSvg(summary) {
  const label = escapeXml(String(summary.label).toUpperCase())
  const headline = escapeXml(summary.headline)
  const nextGoal = escapeXml(summary.nextGoal)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="CardSparks study result">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff9f4"/><stop offset="1" stop-color="#f5f1ff"/></linearGradient></defs>
  <rect width="1200" height="630" rx="42" fill="url(#bg)"/>
  <circle cx="1080" cy="90" r="190" fill="#f26b4d" opacity=".08"/>
  <circle cx="80" cy="610" r="170" fill="#7767d8" opacity=".08"/>
  <text x="72" y="92" fill="#f26b4d" font-family="Arial, sans-serif" font-size="30" font-weight="700">✦ CardSparks</text>
  <text x="72" y="160" fill="#77736c" font-family="Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="3">${label}</text>
  <text x="72" y="315" fill="#252320" font-family="Arial, sans-serif" font-size="150" font-weight="800">${summary.score}%</text>
  <text x="530" y="255" fill="#252320" font-family="Arial, sans-serif" font-size="48" font-weight="700">${headline}</text>
  <text x="530" y="315" fill="#77736c" font-family="Arial, sans-serif" font-size="30">${summary.correct} of ${summary.total} recalled</text>
  <rect x="72" y="408" width="1056" height="2" fill="#ded8cc"/>
  <text x="72" y="478" fill="#77736c" font-family="Arial, sans-serif" font-size="24">NEXT GOAL</text>
  <text x="72" y="530" fill="#252320" font-family="Arial, sans-serif" font-size="30" font-weight="600">${nextGoal}</text>
  <text x="1000" y="585" fill="#a19d95" font-family="Arial, sans-serif" font-size="18">cardsparks.app</text>
</svg>`
}

export function studyResultShareText(summary) {
  return `I scored ${summary.score}% (${summary.correct}/${summary.total}) in a ${summary.label.toLowerCase()} with CardSparks. ${summary.headline}!`
}
