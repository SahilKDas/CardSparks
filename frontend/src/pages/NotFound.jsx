import { Link } from 'react-router-dom'

export default function NotFound() {
  return <div className="page not-found"><span>⚡</span><h1>That spark got away</h1><p>The page you’re looking for doesn’t exist.</p><Link className="button button-primary" to="/">Back to my decks</Link></div>
}

