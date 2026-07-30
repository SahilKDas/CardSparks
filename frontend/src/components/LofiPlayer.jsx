import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icons'

// BASE_URL keeps the asset reachable if CardSparks is deployed under a
// subdirectory instead of at a domain's root.
const TRACK_PATH = `${import.meta.env.BASE_URL}audio/chill-lofi.mp3`
const TRACK_TITLE = 'Chill lofi inspired'

export default function LofiPlayer() {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackError, setPlaybackError] = useState('')
  const [status, setStatus] = useState('Lo-fi music is paused.')

  // Keep background music comfortably below the volume of spoken study content.
  // Browsers intentionally block autoplay, so playback only begins after the
  // learner presses the button.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = 0.35
  }, [])

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio) return

    if (!audio.paused) {
      audio.pause()
      return
    }

    setPlaybackError('')
    setStatus('Loading lo-fi music.')
    try {
      await audio.play()
    } catch {
      setIsPlaying(false)
      setPlaybackError('Music could not be played. Try again.')
      setStatus('Lo-fi music could not be played. Try again.')
    }
  }

  const handlePlay = () => {
    setIsPlaying(true)
    setPlaybackError('')
    setStatus(`Playing ${TRACK_TITLE}.`)
  }

  const handlePause = () => {
    setIsPlaying(false)
    setStatus('Lo-fi music is paused.')
  }

  const handleError = () => {
    setIsPlaying(false)
    setPlaybackError('Music is unavailable.')
    setStatus('Lo-fi music is unavailable.')
  }

  return (
    <div className={`lofi-player${playbackError ? ' has-error' : ''}`}>
      <audio
        ref={audioRef}
        src={TRACK_PATH}
        preload="metadata"
        loop
        onPlay={handlePlay}
        onPause={handlePause}
        onError={handleError}
      />
      <button
        className="lofi-button"
        type="button"
        onClick={togglePlayback}
        aria-label={isPlaying ? 'Pause lo-fi music' : 'Play lo-fi music'}
        aria-pressed={isPlaying}
        title={`${isPlaying ? 'Pause' : 'Play'} ${TRACK_TITLE}`}
      >
        <span className={`lofi-bars${isPlaying ? ' is-playing' : ''}`} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="lofi-copy">
          <strong>Lo-fi</strong>
          <small>{playbackError || (isPlaying ? 'Playing' : 'Play music')}</small>
        </span>
        <span className="lofi-toggle-icon" aria-hidden="true">
          {isPlaying ? <><i /><i /></> : <Icon name="play" size={14} />}
        </span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">{status}</span>
    </div>
  )
}
