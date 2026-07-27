import { useEffect } from 'react'
import { Icon } from './Icons'

export default function Modal({ title, children, onClose, size = 'medium' }) {
  useEffect(() => {
    const closeOnEscape = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header"><h2>{title}</h2><button className="icon-button" type="button" onClick={onClose} aria-label="Close"><Icon name="x" size={19} /></button></div>
        {children}
      </section>
    </div>
  )
}

