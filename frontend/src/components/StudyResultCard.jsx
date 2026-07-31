import { useMemo, useState } from 'react'
import { Icon } from './Icons'
import { buildStudyResult, createStudyResultSvg, studyResultShareText } from '../lib/studyResult'

export default function StudyResultCard({ correct, total, label = 'Study session' }) {
  const summary = useMemo(() => buildStudyResult({ correct, total, label }), [correct, total, label])
  const [status, setStatus] = useState('')

  function downloadCard() {
    const blob = new Blob([createStudyResultSvg(summary)], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `cardsparks-${summary.score}-percent.svg`
    document.body.appendChild(link)
    link.click()
    link.remove()
    // Firefox may still be reading the object URL when the synthetic click
    // returns, so revoke it after the download has had time to begin.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setStatus('Result card downloaded.')
  }

  async function shareCard() {
    const text = studyResultShareText(summary)
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My CardSparks result', text })
        setStatus('Result shared.')
      } else {
        await navigator.clipboard.writeText(text)
        setStatus('Privacy-safe result copied to your clipboard.')
      }
    } catch (error) {
      if (error?.name !== 'AbortError') setStatus('Sharing was unavailable. Download the result card instead.')
    }
  }

  return <section className="share-result-card" aria-labelledby="share-result-heading"><div className="share-result-preview"><span className="share-result-brand"><Icon name="sparkles" size={15} /> CardSparks</span><small>{summary.label}</small><strong>{summary.score}%</strong><div><b>{summary.headline}</b><span>{summary.correct} of {summary.total} recalled</span></div><p>{summary.nextGoal}</p></div><div className="share-result-copy"><span className="eyebrow">Privacy-safe result</span><h2 id="share-result-heading">Keep the momentum visible.</h2><p>The image includes only aggregate performance—never your name, card contents, or answers.</p><div className="share-result-actions"><button className="button button-secondary" type="button" onClick={downloadCard}><Icon name="save" size={16} /> Download image</button><button className="button button-primary" type="button" onClick={shareCard}><Icon name="arrowRight" size={16} /> Share result</button></div><span className="share-result-status" role="status" aria-live="polite">{status}</span></div></section>
}
