import { useEffect, useState } from 'react'
import { ErrorBanner, Spinner } from '../components/Feedback'
import { Icon } from '../components/Icons'
import { useApp } from '../context/useApp'

export default function Settings() {
  const { getStudySettings, updateStudySettings } = useApp()
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    getStudySettings()
      .then((settings) => {
        if (!cancelled) setForm(settings)
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message)
      })
    return () => { cancelled = true }
  }, [getStudySettings])

  async function save(event) {
    event.preventDefault()
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const updated = await updateStudySettings({
        max_reviews: Number(form.max_reviews),
        max_new_cards: Number(form.max_new_cards),
        grading_mode: form.grading_mode,
      })
      setForm(updated)
      setSaved(true)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  if (!form && !error) return <div className="page"><Spinner label="Loading study settings" /></div>

  return (
    <div className="page settings-page">
      <header className="page-head"><span className="eyebrow"><Icon name="clock" size={14} /> Your study rhythm</span><h1>Study settings</h1><p>Choose sensible account defaults. Any deck can override them from its Edit details dialog.</p></header>
      <ErrorBanner message={error} onDismiss={() => setError('')} />
      {form && <form className="settings-card" onSubmit={save}>
        <label className="field-label">Maximum reviews per day<input type="number" min="1" max="1000" value={form.max_reviews} onChange={(event) => setForm({ ...form, max_reviews: event.target.value })} /><span>Previously studied cards that are ready to review.</span></label>
        <label className="field-label">Maximum new cards per day<input type="number" min="0" max="200" value={form.max_new_cards} onChange={(event) => setForm({ ...form, max_new_cards: event.target.value })} /><span>Set this to zero when you want to catch up without introducing material.</span></label>
        <label className="field-label">Grading mode<select value={form.grading_mode} onChange={(event) => setForm({ ...form, grading_mode: event.target.value })}><option value="anki">Four grades · Again, Hard, Good, Easy</option><option value="simple">Simple · Again or Good</option></select><span>Both modes use the same spaced-repetition scheduler.</span></label>
        <div className="settings-actions"><span role="status">{saved ? 'Settings saved.' : ''}</span><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button></div>
      </form>}
    </div>
  )
}
