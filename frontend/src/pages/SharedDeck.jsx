import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorBanner, Spinner } from '../components/Feedback'
import { Icon } from '../components/Icons'
import { useApp } from '../context/useApp'

export default function SharedDeck() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { getSharedDeck, duplicateSharedDeck, isAuthenticated } = useApp()
  const [deck, setDeck] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    let cancelled = false
    getSharedDeck(token)
      .then((payload) => {
        if (!cancelled) {
          setDeck(payload)
          setStatus('ready')
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError.message)
          setStatus('error')
        }
      })
    return () => { cancelled = true }
  }, [getSharedDeck, token])

  async function copyDeck() {
    setCopying(true)
    setError('')
    try {
      const duplicate = await duplicateSharedDeck(token)
      navigate(`/decks/${duplicate.id}`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setCopying(false)
    }
  }

  if (status === 'loading') return <div className="page"><Spinner label="Opening shared deck" /></div>
  if (status === 'error' && !deck) return <div className="page"><ErrorBanner message={error} /><Link className="button button-secondary" to="/">Go home</Link></div>

  return (
    <div className="page shared-page">
      <ErrorBanner message={error} onDismiss={() => setError('')} />
      <header className={`shared-hero accent-${deck.color || 'coral'}`}>
        <span className="detail-emoji">{deck.emoji || '✨'}</span>
        <div><span className="eyebrow">Shared by {deck.author || 'a CardSparks learner'}</span><h1>{deck.title}</h1><p>{deck.description || 'A public CardSparks study deck.'}</p><span><Icon name="cards" size={15} /> {deck.cards.length} cards</span></div>
        {isAuthenticated ? <button className="button button-primary" type="button" onClick={copyDeck} disabled={copying}>{copying ? 'Copying…' : <><Icon name="plus" size={16} /> Add to my decks</>}</button> : <Link className="button button-primary" to="/signup">Create an account to copy</Link>}
      </header>
      <section className="shared-preview"><h2>Deck preview</h2>{deck.cards.map((card, index) => <article key={card.id || index}><span>{index + 1}</span><div><small>Front</small><p>{card.front}</p></div><div><small>Back</small><p>{card.back}</p></div></article>)}</section>
    </div>
  )
}
