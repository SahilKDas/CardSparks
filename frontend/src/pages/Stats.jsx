import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorBanner, Spinner } from '../components/Feedback'
import { Icon } from '../components/Icons'
import { getStats } from '../services/stats'

const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "2026-07-01" parsed by new Date() is UTC midnight, which renders as the
// previous day in any negative-offset timezone. Build it as a local date.
function parseLocalDate(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDay(iso) {
  const date = parseLocalDate(iso)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function Heatmap({ days }) {
  const { cells, months, busiest } = useMemo(() => {
    if (!days.length) return { cells: [], months: [], busiest: 0 }

    const max = days.reduce((peak, day) => Math.max(peak, day.count), 0)
    const leading = parseLocalDate(days[0].date).getDay()

    const padded = [
      ...Array.from({ length: leading }, () => null),
      ...days,
    ]

    const monthMarks = []
    let lastMonth = null
    padded.forEach((day, position) => {
      if (!day || position % 7 !== 0) return
      const month = parseLocalDate(day.date).getMonth()
      if (month !== lastMonth) {
        monthMarks.push({ column: position / 7, label: MONTH_NAMES[month] })
        lastMonth = month
      }
    })

    return { cells: padded, months: monthMarks, busiest: max }
  }, [days])

  const level = (count) => {
    if (!count) return 0
    const ratio = count / (busiest || 1)
    if (ratio <= 0.25) return 1
    if (ratio <= 0.5) return 2
    if (ratio <= 0.75) return 3
    return 4
  }

  return (
    <div className="heatmap-wrap">
      <div className="heatmap-scroll">
        <div className="heatmap-months">
          {months.map((mark) => (
            <span key={`${mark.label}-${mark.column}`} style={{ gridColumn: mark.column + 1 }}>
              {mark.label}
            </span>
          ))}
        </div>
        <div className="heatmap-body">
          <div className="heatmap-weekdays">
            {WEEKDAY_LABELS.map((label, position) => (
              <span key={position}>{label}</span>
            ))}
          </div>
          <div className="heatmap-grid">
            {cells.map((day, position) => (
              day
                ? (
                  <span
                    key={day.date}
                    className={`heat-cell level-${level(day.count)}`}
                    title={`${day.count} ${day.count === 1 ? 'review' : 'reviews'} on ${formatDay(day.date)}`}
                  />
                )
                : <span key={`pad-${position}`} className="heat-cell is-empty" />
            ))}
          </div>
        </div>
      </div>
      <div className="heatmap-legend">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((step) => <span key={step} className={`heat-cell level-${step}`} />)}
        <span>More</span>
      </div>
    </div>
  )
}

function Forecast({ days, backlog }) {
  const peak = Math.max(...days.map((day) => day.count), backlog, 1)

  return (
    <div className="forecast">
      <div className="forecast-bars">
        {backlog > 0 && (
          <div className="forecast-bar is-backlog" title={`${backlog} ready now`}>
            <span style={{ height: `${(backlog / peak) * 100}%` }} />
            <small>Now</small>
          </div>
        )}
        {days.map((day, position) => (
          <div
            key={day.date}
            className="forecast-bar"
            title={`${day.count} due on ${formatDay(day.date)}`}
          >
            <span style={{ height: `${(day.count / peak) * 100}%` }} />
            <small>{position % 5 === 0 ? parseLocalDate(day.date).getDate() : ''}</small>
          </div>
        ))}
      </div>
      <p className="forecast-caption">
        Cards scheduled over the next {days.length} days. Tallest bar is {peak}.
      </p>
    </div>
  )
}

function RetentionTrend({ weeks }) {
  return <div className="insight-bars" aria-label="Eight-week retention trend">{weeks.map((week) => <div key={week.date} title={`${formatDay(week.date)}: ${week.retention === null ? 'No reviews' : `${Math.round(week.retention * 100)}% retained`}`}><span style={{ height: `${week.retention === null ? 3 : Math.max(8, week.retention * 100)}%` }} /><small>{formatDay(week.date)}</small></div>)}</div>
}

function StreakHistory({ weeks }) {
  return <div className="streak-weeks">{weeks.map((week) => <div key={week.date}><span><strong>{week.active_days}</strong>/7 days</span><i><b style={{ width: `${(week.active_days / 7) * 100}%` }} /></i><small>{week.reviews} reviews</small></div>)}</div>
}

export default function Stats() {
  const [stats, setStats] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')

    getStats({ days: 365, horizon: 30 })
      .then((payload) => {
        if (cancelled) return
        setStats(payload)
        setStatus('ready')
      })
      .catch((requestError) => {
        if (cancelled) return
        setError(requestError.message)
        setStatus('error')
      })

    return () => { cancelled = true }
  }, [attempt])

  if (status === 'loading') return <div className="page"><Spinner label="Crunching your review history" /></div>

  if (status === 'error') {
    return (
      <div className="page">
        <ErrorBanner message={error} onRetry={() => setAttempt((value) => value + 1)} />
      </div>
    )
  }

  const { totals, retention, streak, backlog, heatmap, forecast, retention_trend: retentionTrend, streak_history: streakHistory, weakest_decks: weakestDecks, difficult_cards: difficultCards } = stats
  const forecastTotal = forecast.reduce((sum, day) => sum + day.count, 0)
  const percent = (value) => value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`

  if (!totals.reviews) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>Your progress</h1>
          <p>Retention, streaks, and what’s coming up.</p>
        </header>
        <div className="empty-state">
          <span className="empty-illustration"><Icon name="cards" size={34} /></span>
          <h2>No reviews yet</h2>
          <p>Study a deck and your history starts building here.</p>
          <Link className="button button-primary" to="/decks">Pick a deck</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Your progress</h1>
        <p>Retention, streaks, and what’s coming up.</p>
      </header>

      <div className="stat-tiles">
        <div className="stat-tile">
          <span className="stat-label">Retention · last {retention.window_days} days</span>
          <strong>{percent(retention.recent)}</strong>
          <small>{retention.recent_reviews} reviews · {percent(retention.all_time)} all time</small>
        </div>
        <div className="stat-tile">
          <span className="stat-label">Current streak</span>
          <strong>{streak.current} {streak.current === 1 ? 'day' : 'days'}</strong>
          <small>Longest {streak.longest} {streak.longest === 1 ? 'day' : 'days'}</small>
        </div>
        <div className="stat-tile">
          <span className="stat-label">Mature cards</span>
          <strong>{totals.mature_cards}</strong>
          <small>of {totals.cards} · 3 weeks or longer</small>
        </div>
        <div className="stat-tile">
          <span className="stat-label">Ready now</span>
          <strong>{backlog}</strong>
          <small>{totals.reviews} reviews · {totals.lapses} lapses</small>
        </div>
      </div>

      {retention.recent !== null && retention.recent < 0.8 && (
        <p className="stat-note">
          Retention under 80% usually means intervals are stretching faster than recall. Rating
          honestly with <strong>Hard</strong> instead of Good pulls them back in.
        </p>
      )}

      <section className="stat-section">
        <div className="stat-section-head">
          <h2>Review history</h2>
          <span>{totals.reviews} reviews across {totals.decks} {totals.decks === 1 ? 'deck' : 'decks'}</span>
        </div>
        <Heatmap days={heatmap} />
      </section>

      <section className="stat-section">
        <div className="stat-section-head">
          <h2>Coming up</h2>
          <span>{forecastTotal} {forecastTotal === 1 ? 'card' : 'cards'} over 30 days</span>
        </div>
        <Forecast days={forecast} backlog={backlog} />
      </section>

      <div className="insight-grid">
        <section className="stat-section insight-panel"><div className="stat-section-head"><h2>Retention trend</h2><span>Last 8 weeks</span></div><RetentionTrend weeks={retentionTrend} /></section>
        <section className="stat-section insight-panel"><div className="stat-section-head"><h2>Streak history</h2><span>Active days by week</span></div><StreakHistory weeks={streakHistory} /></section>
      </div>

      <div className="insight-grid attention-grid">
        <section className="stat-section insight-panel"><div className="stat-section-head"><h2>Weakest decks</h2><span>Lowest retention first</span></div><div className="rank-list">{weakestDecks.map((deck) => <Link key={deck.id} to={`/decks/${deck.id}`}><span>{deck.emoji || '📚'}</span><div><strong>{deck.title}</strong><small>{deck.reviews} reviews</small></div><b>{percent(deck.retention)}</b></Link>)}{!weakestDecks.length && <p>No reviewed decks yet.</p>}</div></section>
        <section className="stat-section insight-panel"><div className="stat-section-head"><h2>Difficult cards</h2><span>Failures and lapses</span></div><div className="rank-list">{difficultCards.slice(0, 5).map((card) => <Link key={card.id} to={`/decks/${card.deck_id}`}><span><Icon name="cards" size={16} /></span><div><strong>{card.front}</strong><small>{card.deck__title}</small></div><b>{card.failed_reviews + card.lapses} misses</b></Link>)}{!difficultCards.length && <p>No difficult cards yet.</p>}</div></section>
      </div>
    </div>
  )
}
