import { Link } from 'react-router-dom'
import { useApp } from '../context/useApp'

export default function NotFound() {
  const { isAuthenticated } = useApp()
  return <div className="page not-found"><span>⚡</span><h1>That spark got away</h1><p>The page you’re looking for doesn’t exist.</p><Link className="button button-primary" to={isAuthenticated ? '/decks' : '/'}>{isAuthenticated ? 'Back to my decks' : 'Back home'}</Link></div>
}

