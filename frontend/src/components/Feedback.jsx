import { Icon } from './Icons'

export function Spinner({ label = 'Loading your decks' }) {
  return (
    <div className="state-panel" role="status">
      <span className="spinner" />
      <strong>{label}</strong>
      <p>Gathering everything you need.</p>
    </div>
  )
}

export function ErrorBanner({ message, onRetry, onDismiss }) {
  if (!message) return null
  return (
    <div className="error-banner" role="alert">
      <span className="error-icon"><Icon name="x" size={16} /></span>
      <div><strong>Something got in the way</strong><p>{message}</p></div>
      <div className="error-actions">
        {onRetry && <button type="button" onClick={onRetry}><Icon name="refresh" size={15} /> Retry</button>}
        {onDismiss && <button className="icon-button" type="button" onClick={onDismiss} aria-label="Dismiss error"><Icon name="x" size={17} /></button>}
      </div>
    </div>
  )
}

export function EmptyState({ title, message, action }) {
  return (
    <div className="empty-state">
      <span className="empty-illustration"><Icon name="cards" size={34} /></span>
      <h2>{title}</h2>
      <p>{message}</p>
      {action}
    </div>
  )
}

