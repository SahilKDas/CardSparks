import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icons'
import { useApp } from '../context/useApp'

export default function Login({ mode }) {
  const isSignup = mode === 'signup'
  const { authenticate, isAuthenticated, isMockMode } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from
  const requestedPath = from ? `${from.pathname}${from.search || ''}${from.hash || ''}` : ''
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setForm({ name: '', email: '', password: '' })
    setError('')
    setBusy(false)
  }, [mode])

  if (isAuthenticated) return <Navigate to={requestedPath || '/decks'} replace />

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await authenticate(mode, form)
      navigate(requestedPath || '/decks', { replace: true })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-card">
        <span className="auth-spark"><Icon name="sparkles" size={27} /></span>
        <span className="eyebrow">{isSignup ? 'Start learning smarter' : 'Welcome back'}</span>
        <h1>{isSignup ? 'Create your account' : 'Keep your momentum'}</h1>
        <p>{isSignup ? 'Turn the next thing you learn into something you remember.' : 'Your decks are right where you left them.'}</p>
        {isMockMode && <div className="auth-demo-note"><span /><p><strong>Demo mode is on.</strong> Any email and password will work locally.</p></div>}
        <form onSubmit={submit} className="auth-form">
          {isSignup && <label className="field-label">Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Your name" maxLength="32" autoComplete="name" required /></label>}
          <label className="field-label">Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" autoComplete="email" required /></label>
          <label className="field-label">Password<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="At least 8 characters" minLength={isMockMode ? 1 : 8} autoComplete={isSignup ? 'new-password' : 'current-password'} required /></label>
          {error && <p className="field-error">{error}</p>}
          <button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy ? 'One moment…' : isSignup ? 'Create account' : 'Sign in'} <Icon name="arrowRight" size={17} /></button>
        </form>
        <p className="auth-switch">{isSignup ? 'Already have an account?' : 'New to CardSparks?'} <Link to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Sign in' : 'Create one'}</Link></p>
      </section>
    </div>
  )
}

