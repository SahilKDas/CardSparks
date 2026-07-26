import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight, BarChart3, CalendarDays, CalendarPlus, Check, CheckCircle2, ChevronRight,
  CloudRain, ClipboardCheck, Clock3, Coffee, Compass, Copy, History, Lightbulb,
  LoaderCircle, MapPin, Megaphone, Menu, PackageCheck, Plus, Printer, RefreshCw,
  RotateCcw, Settings, Sparkles, Sun, Target, ThumbsDown, ThumbsUp, TrendingUp,
  Upload, X,
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

const API = import.meta.env.VITE_API_URL || ''

const seedSales = [
  { date: '2026-07-13', amount: 1180 }, { date: '2026-07-14', amount: 1260 },
  { date: '2026-07-15', amount: 1135 }, { date: '2026-07-16', amount: 1320 },
  { date: '2026-07-17', amount: 1580 }, { date: '2026-07-18', amount: 1810 },
  { date: '2026-07-19', amount: 1475 }, { date: '2026-07-20', amount: 1210 },
  { date: '2026-07-21', amount: 1295 }, { date: '2026-07-22', amount: 1370 },
  { date: '2026-07-23', amount: 1415 }, { date: '2026-07-24', amount: 1680 },
  { date: '2026-07-25', amount: 1940 }, { date: '2026-07-26', amount: 1525 },
]

const demoProfile = {
  name: 'Juniper Coffee Co.', type: 'Independent coffee shop', location: 'Portland, OR',
  goal: 'Grow weekday foot traffic', sales: seedSales,
}

const fallbackDemoAction = {
  id: 1, profile_name: 'Juniper Coffee Co.', recommendation_id: 'rainy-day-double-points',
  title: 'Make rainy mornings feel intentional',
  action: 'Run Rainy Day Double Points from 7–10 AM and feature the maple oat latte at the register.',
  why: 'Rain was forecast on a historically soft weekday.', signals: ['weather', 'sales'],
  evidence: ['Rain was forecast during the morning commute', 'The comparable weekday trailed the shop’s daily average'],
  confidence: 'medium', success_metric: 'Sales versus the comparable-day baseline',
  scheduled_for: '2026-07-25', status: 'completed', is_demo: true,
  outcome: { observed_sales: 1420, baseline_sales: 1210, lift_amount: 210, lift_percent: 17.4, helped: 'yes', note: 'Morning regulars responded well.' },
}

const fallbackBriefing = {
  generated_at: new Date().toISOString(),
  live_weather: false,
  weather: {
    current_temp: 68, condition: 'Partly cloudy', high: 74, low: 57,
    precipitation: 20, forecast: [
      { day: 'Today', high: 74, low: 57, code: 2, rain: 20 },
      { day: 'Mon', high: 71, low: 56, code: 61, rain: 65 },
      { day: 'Tue', high: 76, low: 58, code: 1, rain: 10 },
    ],
  },
  events_source: 'Curated demo events',
  events: [
    { name: 'Waterfront Blues Festival', date: 'Fri, Jul 31', time: '4:00 PM', distance: '0.8 mi', category: 'Festival', opportunity: 'high' },
    { name: 'First Thursday Art Walk', date: 'Thu, Jul 30', time: '5:00 PM', distance: '0.5 mi', category: 'Community', opportunity: 'medium' },
    { name: 'Portland Timbers Match', date: 'Sat, Aug 1', time: '7:30 PM', distance: '1.4 mi', category: 'Sports', opportunity: 'high' },
  ],
  sales: seedSales,
  sales_summary: { total: 20195, average: 1443, trend_percent: 12.4, best_day: 'Saturday' },
  advisor_mode: 'local', learning_count: 1, recent_win: fallbackDemoAction,
  recommendations: [
    { id: 'event-rush', priority: 'Today’s best move', icon: 'event', title: 'Turn Friday’s festival crowd into regulars', action: 'Prep 25% more cold brew and pastries by Friday afternoon. Put a “festival fuel” sidewalk bundle at $9 and include a bounce-back card for Monday.', why: 'Waterfront festival · 0.8 mi away · Fridays already run 18% above average', signals: ['event', 'sales'], impact: 'High upside', evidence: ['Waterfront festival is 0.8 mi away on Friday', 'Friday sales run 18% above the shop average'], confidence: 'high', success_metric: 'Friday sales versus the current daily average' },
    { id: 'rainy-monday', priority: 'Plan ahead', icon: 'rain', title: 'Make rainy Monday feel intentional', action: 'Schedule a 7–10 AM “Rainy Day Double Points” message Sunday night. Keep two extra baristas on the morning shift, then taper after lunch.', why: '65% chance of rain Monday · Mondays are your softest sales day', signals: ['weather', 'sales'], impact: 'Protects a slow day', evidence: ['Monday has a 65% chance of rain', 'Monday is the lowest-performing weekday'], confidence: 'medium', success_metric: 'Monday sales versus the usual Monday baseline' },
    { id: 'repeat-learned-win', priority: 'Sidekick learned', icon: 'spark', title: 'Repeat the play that added $210', action: 'Reuse the strongest part of the rainy-morning offer in a two-hour window, then log sales again so Sidekick can separate a repeatable play from a one-off win.', why: 'The prior action finished $210 above its comparable-day baseline', signals: ['sales'], impact: 'Compounding insight', evidence: ['Observed sales: $1,420', 'Comparable-day baseline: $1,210'], confidence: 'high', success_metric: 'Beat the comparable-day baseline again' },
  ],
}

function App() {
  const [profile, setProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sidekick-profile')) } catch { return null }
  })
  const [briefing, setBriefing] = useState(null)
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState('dashboard')
  const [mobileNav, setMobileNav] = useState(false)
  const [actions, setActions] = useState([])
  const [notice, setNotice] = useState('')

  async function loadBriefing(nextProfile = profile, refresh = false) {
    if (!nextProfile) return
    setLoading(true)
    try {
      const response = await fetch(`${API}/api/briefing`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...nextProfile, refresh }),
      })
      if (!response.ok) throw new Error('Briefing unavailable')
      setBriefing(await response.json())
    } catch {
      setBriefing({ ...fallbackBriefing, sales: nextProfile.sales || seedSales })
    } finally { setLoading(false) }
  }

  async function loadActions(nextProfile = profile) {
    if (!nextProfile) return
    try {
      const response = await fetch(`${API}/api/actions?business=${encodeURIComponent(nextProfile.name)}`)
      if (!response.ok) throw new Error()
      setActions((await response.json()).actions || [])
    } catch { setActions(nextProfile.name === demoProfile.name ? [fallbackDemoAction] : []) }
  }

  function flash(message) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2600)
  }

  async function startDemo() {
    setLoading(true)
    try {
      const response = await fetch(`${API}/api/demo/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      if (!response.ok) throw new Error()
      const data = await response.json()
      setProfile(data.profile); setBriefing(data.briefing); setActions([data.seeded_action])
      localStorage.setItem('sidekick-profile', JSON.stringify(data.profile))
    } catch {
      setProfile(demoProfile); setBriefing(fallbackBriefing); setActions([fallbackDemoAction])
      localStorage.setItem('sidekick-profile', JSON.stringify(demoProfile))
    } finally { setView('dashboard'); setLoading(false) }
  }

  async function addToPlan(recommendation) {
    try {
      const response = await fetch(`${API}/api/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile_name: profile.name, recommendation, scheduled_for: new Date().toISOString().slice(0, 10), is_demo: profile.name === demoProfile.name }) })
      if (!response.ok) throw new Error()
      const action = await response.json()
      setActions((current) => [action, ...current.filter((item) => item.id !== action.id)])
      flash('Added to Today’s Playbook')
    } catch { flash('The Playbook is temporarily unavailable') }
  }

  async function updateAction(id, status) {
    const response = await fetch(`${API}/api/actions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    if (!response.ok) throw new Error('Could not update action')
    const updated = await response.json()
    setActions((current) => current.map((item) => item.id === id ? updated : item))
    return updated
  }

  async function recordOutcome(id, outcome) {
    const response = await fetch(`${API}/api/actions/${id}/outcome`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(outcome) })
    if (!response.ok) throw new Error('Could not save outcome')
    const updated = await response.json()
    setActions((current) => current.map((item) => item.id === id ? updated : item))
    flash(`Sidekick learned from ${updated.title}`)
    await loadBriefing(profile, true)
    return updated
  }

  async function buildLaunchKit(id, refresh = false) {
    const response = await fetch(`${API}/api/actions/${id}/launch-kit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh }),
    })
    if (!response.ok) throw new Error('Could not build Launch Kit')
    const launchKit = await response.json()
    setActions((current) => current.map((item) => item.id === id ? { ...item, has_launch_kit: true, launch_kit: launchKit } : item))
    flash(refresh ? 'Launch Kit refreshed' : 'Launch Kit ready')
    return launchKit
  }

  useEffect(() => { if (profile) { loadBriefing(profile); loadActions(profile) } }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function finishOnboarding(nextProfile) {
    setProfile(nextProfile)
    localStorage.setItem('sidekick-profile', JSON.stringify(nextProfile))
    setView('dashboard')
    loadBriefing(nextProfile)
  }

  function reset() {
    localStorage.removeItem('sidekick-profile')
    setProfile(null); setBriefing(null); setActions([]); setView('dashboard')
  }

  if (!profile) return <Onboarding onFinish={finishOnboarding} onDemo={startDemo} loading={loading} />

  return (
    <div className="app-shell">
      <Sidebar profile={profile} view={view} setView={setView} reset={reset} open={mobileNav} close={() => setMobileNav(false)} actionCount={actions.filter((item) => item.status === 'planned').length} />
      <main className="main-content">
        <MobileHeader profile={profile} open={() => setMobileNav(true)} />
        {notice && <div className="toast"><Check /> {notice}</div>}
        {view === 'dashboard' && <Dashboard profile={profile} data={briefing || fallbackBriefing} loading={loading} refresh={() => loadBriefing(profile, true)} addToPlan={addToPlan} plannedIds={new Set(actions.filter((item) => item.status === 'planned').map((item) => item.recommendation_id))} openPlaybook={() => setView('playbook')} />}
        {view === 'playbook' && <PlaybookView actions={actions} updateAction={updateAction} recordOutcome={recordOutcome} buildLaunchKit={buildLaunchKit} />}
        {view === 'history' && <HistoryView profile={profile} />}
        {view === 'settings' && <SettingsView profile={profile} reset={reset} resetDemo={startDemo} />}
      </main>
    </div>
  )
}

function Onboarding({ onFinish, onDemo, loading }) {
  const [step, setStep] = useState(1)
  const [profile, setProfile] = useState({ name: '', type: 'Independent coffee shop', location: '', goal: 'Grow weekday foot traffic' })
  const [sales, setSales] = useState([])
  const [rows, setRows] = useState([{ date: '', amount: '' }, { date: '', amount: '' }, { date: '', amount: '' }])
  const [error, setError] = useState('')

  function update(key, value) { setProfile((current) => ({ ...current, [key]: value })) }
  function next() {
    if (!profile.name.trim() || !profile.location.trim()) { setError('Add your business name and location to continue.'); return }
    setError(''); setStep(2)
  }
  function parseCsv(file) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const lines = String(reader.result).trim().split(/\r?\n/)
        const parsed = lines.slice(1).map((line) => {
          const [date, amount] = line.split(',').map((value) => value.trim().replace(/^"|"$/g, ''))
          return { date, amount: Number(amount.replace(/[$,]/g, '')) }
        }).filter((row) => row.date && Number.isFinite(row.amount))
        if (!parsed.length) throw new Error()
        setSales(parsed); setError('')
      } catch { setError('We could not read that file. Use columns named date and amount.') }
    }
    reader.readAsText(file)
  }
  function finish() {
    const manual = rows.map((row) => ({ date: row.date, amount: Number(row.amount) })).filter((row) => row.date && row.amount > 0)
    const finalSales = sales.length ? sales : manual
    if (finalSales.length < 3) { setError('Add at least three days of sales, or use the ready-made demo.'); return }
    onFinish({ ...profile, sales: finalSales })
  }

  return (
    <div className="onboarding">
      <header className="onboarding-nav">
        <Logo />
        <button className="text-button" onClick={onDemo} disabled={loading}>{loading ? 'Preparing story…' : 'Skip to demo'} <ArrowRight size={15} /></button>
      </header>
      <div className="onboarding-grid">
        <section className="onboarding-story">
          <div className="story-orbit"><span><Sparkles /></span><i className="orbit-dot weather-dot"><CloudRain /></i><i className="orbit-dot event-dot"><CalendarDays /></i><i className="orbit-dot sales-dot"><BarChart3 /></i></div>
          <p className="eyebrow">Meet your new sidekick</p>
          <h1>Make every day a<br /><em>better business day.</em></h1>
          <p>One clear morning briefing, shaped by what you sold, what the sky is doing, and who’s coming to town.</p>
          <div className="trust-row"><span><Check /> No credit card</span><span><Check /> Your data stays yours</span></div>
        </section>
        <section className="setup-card">
          <div className="steps"><span className={step >= 1 ? 'active' : ''}>1</span><i /><span className={step >= 2 ? 'active' : ''}>2</span></div>
          {step === 1 ? (
            <>
              <p className="eyebrow">Step 1 of 2</p><h2>Tell me about your business</h2><p className="muted">A little context makes every recommendation more useful.</p>
              <label>Business name<input value={profile.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Juniper Coffee Co." /></label>
              <label>What kind of business?<select value={profile.type} onChange={(e) => update('type', e.target.value)}><option>Independent coffee shop</option><option>Neighborhood restaurant</option><option>Retail boutique</option><option>Bakery</option><option>Salon or spa</option><option>Other small business</option></select></label>
              <label>City or ZIP code<div className="input-icon"><MapPin /><input value={profile.location} onChange={(e) => update('location', e.target.value)} placeholder="Portland, OR" /></div></label>
              <label>Your focus<select value={profile.goal} onChange={(e) => update('goal', e.target.value)}><option>Grow weekday foot traffic</option><option>Plan inventory more accurately</option><option>Increase average order value</option><option>Build customer loyalty</option></select></label>
              {error && <p className="form-error">{error}</p>}
              <button className="primary-button full" onClick={next}>Next: add sales <ArrowRight size={17} /></button>
              <button className="demo-button" onClick={onDemo} disabled={loading}><Coffee /> <span><strong>{loading ? 'Preparing the story…' : 'See the coffee shop demo'}</strong><small>Includes a measured win and learning loop</small></span>{loading ? <LoaderCircle className="spin" /> : <ChevronRight />}</button>
            </>
          ) : (
            <>
              <button className="back-button" onClick={() => setStep(1)}>← Back</button>
              <p className="eyebrow">Step 2 of 2</p><h2>Add recent sales</h2><p className="muted">Two weeks is ideal, but three days is enough to begin.</p>
              <label className="upload-zone"><Upload /><strong>Drop a CSV here or click to browse</strong><small>Two columns: date, amount</small><input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files[0] && parseCsv(e.target.files[0])} /></label>
              {sales.length > 0 && <div className="upload-success"><Check /> {sales.length} sales days ready</div>}
              <div className="or"><span>or enter a few days</span></div>
              <div className="sales-rows">{rows.map((row, index) => <div key={index}><input aria-label={`Date ${index + 1}`} type="date" value={row.date} onChange={(e) => setRows(rows.map((item, i) => i === index ? { ...item, date: e.target.value } : item))} /><div className="money-input"><span>$</span><input aria-label={`Sales amount ${index + 1}`} type="number" placeholder="0.00" value={row.amount} onChange={(e) => setRows(rows.map((item, i) => i === index ? { ...item, amount: e.target.value } : item))} /></div></div>)}</div>
              <button className="add-row" onClick={() => setRows([...rows, { date: '', amount: '' }])}><Plus /> Add another day</button>
              {error && <p className="form-error">{error}</p>}
              <button className="primary-button full" onClick={finish}>Build my first briefing <Sparkles size={17} /></button>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

function Logo() { return <a className="brand" href="/"><span className="brand-mark">S</span><span>Sidekick <strong>AI</strong></span></a> }

function Sidebar({ profile, view, setView, open, close, actionCount }) {
  const items = [{ id: 'dashboard', label: 'Morning briefing', icon: Compass }, { id: 'playbook', label: 'Today’s Playbook', icon: ClipboardCheck }, { id: 'history', label: 'Past advice', icon: History }, { id: 'settings', label: 'Business profile', icon: Settings }]
  return <><aside className={`sidebar ${open ? 'open' : ''}`}><div className="side-top"><Logo /><button className="close-nav" onClick={close}><X /></button></div><nav>{items.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'active' : ''} onClick={() => { setView(id); close() }}><Icon /> {label}{id === 'playbook' && actionCount > 0 && <span className="nav-count">{actionCount}</span>}</button>)}</nav><div className="side-note"><Sparkles /><strong>Your sidekick is learning</strong><p>Every measured action makes tomorrow’s advice sharper.</p></div><button className="profile-chip" onClick={() => { setView('settings'); close() }}><span>{profile.name.charAt(0)}</span><div><strong>{profile.name}</strong><small>{profile.location}</small></div><ChevronRight /></button></aside>{open && <button className="nav-scrim" onClick={close} aria-label="Close navigation" />}</>
}

function MobileHeader({ profile, open }) { return <header className="mobile-header"><button onClick={open}><Menu /></button><Logo /><span className="mini-avatar">{profile.name.charAt(0)}</span></header> }

function Dashboard({ profile, data, loading, refresh, addToPlan, plannedIds, openPlaybook }) {
  const today = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())
  return <div className="dashboard"><header className="page-header"><div><p className="eyebrow">{today}</p><h1>Good morning, {profile.name.split(' ')[0]}.</h1><p>Here’s what your business world looks like today.</p></div><button className="refresh-button" onClick={refresh} disabled={loading}>{loading ? <LoaderCircle className="spin" /> : <RefreshCw />} Refresh briefing</button></header>
    {loading && !data ? <BriefingSkeleton /> : <>
      {data.recent_win?.outcome && <RecentWin action={data.recent_win} learningCount={data.learning_count} openPlaybook={openPlaybook} />}
      <section className="daily-glance"><div className="glance-label"><span>Today</span><strong>At a glance</strong></div><div className="glance-stat weather"><Sun /><div><strong>{Math.round(data.weather.current_temp)}°</strong><small>{data.weather.condition}</small></div></div><div className="glance-stat"><CalendarDays /><div><strong>{data.events.length}</strong><small>nearby events</small></div></div><div className="glance-stat"><TrendingUp /><div><strong>{data.sales_summary.trend_percent > 0 ? '+' : ''}{data.sales_summary.trend_percent}%</strong><small>7-day trend</small></div></div><span className={`live-pill ${data.live_weather ? '' : 'demo'}`}><i />{data.live_weather ? 'Weather live' : 'Demo weather'}</span></section>
      <section className="advisor-section"><div className="section-heading"><div><span className="section-icon"><Sparkles /></span><div><p className="eyebrow">Your sidekick says</p><h2>Three moves worth making</h2></div></div><span className={`ai-mode provider-${data.advisor_mode}`}>{data.advisor_mode === 'anthropic' ? 'Powered by Claude' : data.advisor_mode === 'gemini' ? 'Gemini free tier' : 'Explainable local advisor'}</span></div><div className="recommendation-grid">{data.recommendations.map((recommendation, index) => <Recommendation key={recommendation.id || index} item={recommendation} index={index} addToPlan={addToPlan} isPlanned={plannedIds.has(recommendation.id)} />)}</div></section>
      <section className="signals-section"><div className="section-heading simple"><div><p className="eyebrow">The signals</p><h2>What your sidekick is watching</h2></div></div><div className="signal-grid"><SalesPanel sales={data.sales} summary={data.sales_summary} /><WeatherPanel weather={data.weather} live={data.live_weather} /><EventsPanel events={data.events} source={data.events_source} updatedAt={data.events_updated_at} /></div></section>
      <footer className="dashboard-footer"><span><Sparkles /> Briefing prepared for {profile.name}</span><span>Sales × weather × local events</span></footer>
    </>}
  </div>
}

function RecentWin({ action, learningCount, openPlaybook }) {
  const outcome = action.outcome
  return <section className="recent-win"><span className="win-icon"><TrendingUp /></span><div><p className="eyebrow">Yesterday’s win · measured</p><h2>{action.title} finished <strong>${outcome.lift_amount.toLocaleString()} above baseline</strong></h2><p>${outcome.observed_sales.toLocaleString()} observed versus a ${outcome.baseline_sales.toLocaleString()} comparable-day baseline. Sidekick has learned from {learningCount} completed {learningCount === 1 ? 'action' : 'actions'}.</p></div><button onClick={openPlaybook}>See the learning loop <ArrowRight /></button></section>
}

function Recommendation({ item, index, addToPlan, isPlanned }) {
  const icons = { rain: CloudRain, event: CalendarDays, spark: Lightbulb }
  const Icon = icons[item.icon] || Lightbulb
  return <article className={`recommendation-card rec-${index}`}><div className="rec-top"><span className="rec-icon"><Icon /></span><span className="priority">{item.priority}</span><span className={`confidence confidence-${item.confidence || 'medium'}`}>{item.confidence || 'medium'} confidence</span></div><h3>{item.title}</h3><p className="action">{item.action}</p><EvidenceTrail item={item} /><div className="rec-footer"><div className="signal-tags">{item.signals?.map((signal) => <span key={signal}>{signal === 'sales' ? <BarChart3 /> : signal === 'weather' ? <CloudRain /> : <CalendarDays />}{signal}</span>)}</div><button className={`plan-button ${isPlanned ? 'planned' : ''}`} onClick={() => !isPlanned && addToPlan(item)}>{isPlanned ? <><Check /> In Playbook</> : <><Plus /> Put this in my plan</>}</button></div></article>
}

function EvidenceTrail({ item }) {
  const [open, setOpen] = useState(false)
  return <div className={`evidence-trail ${open ? 'open' : ''}`}><button onClick={() => setOpen(!open)}><span><Sparkles /> How I connected the dots</span><ChevronRight /></button>{open && <div className="evidence-body"><div className="evidence-flow">{(item.evidence || [item.why]).map((evidence, index) => <div key={evidence}><span>{evidence}</span>{index < (item.evidence || [item.why]).length - 1 && <b>+</b>}</div>)}</div><span className="flow-arrow">↓</span><strong>{item.title}</strong><p><Target /> Measure: {item.success_metric || 'Sales versus the comparable-day baseline'}</p></div>}</div>
}

function SalesPanel({ sales, summary }) {
  const chart = sales.slice(-10).map((row) => ({ ...row, label: new Date(`${row.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' }) }))
  return <article className="signal-card sales-panel"><div className="card-title"><span className="green-icon"><BarChart3 /></span><div><h3>Sales pulse</h3><p>Last {chart.length} days</p></div><span className="trend-badge"><TrendingUp /> {summary.trend_percent}%</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart} margin={{ top: 10, right: 4, left: -18, bottom: 0 }}><defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e26143" stopOpacity={0.34}/><stop offset="100%" stopColor="#e26143" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9e6dd"/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#83908c', fontSize: 11 }}/><YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} tick={{ fill: '#83908c', fontSize: 10 }}/><Tooltip formatter={(value) => [`$${value.toLocaleString()}`, 'Sales']} contentStyle={{ borderRadius: 12, border: '1px solid #ddd8cc' }}/><Area type="monotone" dataKey="amount" stroke="#df6245" strokeWidth={3} fill="url(#salesFill)" /></AreaChart></ResponsiveContainer></div><div className="sales-stats"><div><small>Daily average</small><strong>${summary.average.toLocaleString()}</strong></div><div><small>Best day</small><strong>{summary.best_day}</strong></div></div></article>
}

function WeatherPanel({ weather, live }) {
  return <article className="signal-card weather-panel"><div className="card-title"><span className="blue-icon"><Sun /></span><div><h3>Weather ahead</h3><p>{live ? 'Live forecast' : 'Demo forecast'}</p></div></div><div className="current-weather"><div><span>{Math.round(weather.current_temp)}°</span><p>{weather.condition}</p></div><Sun /></div><div className="forecast-list">{weather.forecast.slice(0, 3).map((day) => <div key={day.day}><span>{day.day}</span>{day.rain >= 40 ? <CloudRain /> : <Sun />}<strong>{Math.round(day.high)}°</strong><small>{day.rain}% rain</small></div>)}</div></article>
}

function EventsPanel({ events, source, updatedAt }) {
  return <article className="signal-card events-panel"><div className="card-title"><span className="gold-icon"><CalendarDays /></span><div><h3>Nearby energy</h3><p>Next 7 days</p></div><span className="count-badge">{events.length}</span></div><div className="event-list">{events.slice(0, 3).map((event, i) => <div className="event-row" key={`${event.name}-${i}`}><div className="date-tile"><strong>{event.date.split(',')[0]}</strong><small>{event.date.split(',')[1] || ''}</small></div><div><strong>{event.name}</strong><small>{event.time} · {event.distance}</small></div><span className={`opportunity ${event.opportunity}`}>{event.opportunity}</span></div>)}</div><p className="source-note">Source: {source}{updatedAt ? ` · refreshed ${new Date(updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}</p></article>
}

function BriefingSkeleton() { return <div className="skeleton"><LoaderCircle className="spin" /><h2>Connecting the dots…</h2><p>Reading sales, weather, and what’s happening nearby.</p></div> }

function PlaybookView({ actions, updateAction, recordOutcome, buildLaunchKit }) {
  const [selected, setSelected] = useState(null)
  const [studioAction, setStudioAction] = useState(null)
  const [buildingId, setBuildingId] = useState(null)
  const [error, setError] = useState('')
  const active = actions.filter((item) => item.status === 'planned')
  const measured = actions.filter((item) => item.outcome)
  async function openOrBuildKit(item) {
    setError('')
    if (item.launch_kit) { setStudioAction(item); return }
    setBuildingId(item.id)
    try {
      const launchKit = await buildLaunchKit(item.id)
      setStudioAction({ ...item, has_launch_kit: true, launch_kit: launchKit })
    } catch { setError('Sidekick could not build that kit right now. Your planned action is still safe.') }
    finally { setBuildingId(null) }
  }
  return <div className="simple-page playbook-page">
    <p className="eyebrow">From counsel to action</p><h1>Today’s Playbook</h1><p>Your clearest next moves, with a ready-to-use campaign kit and a learning loop when the day is done.</p>
    <div className="playbook-summary"><div><ClipboardCheck /><span><strong>{active.length}</strong><small>planned moves</small></span></div><div><PackageCheck /><span><strong>{actions.filter((item) => item.has_launch_kit).length}</strong><small>launch kits ready</small></span></div><div><Sparkles /><span><strong>{measured.filter((item) => item.outcome.lift_amount > 0).length}</strong><small>proven wins</small></span></div></div>
    {error && <p className="form-error">{error}</p>}
    {actions.length ? <div className="playbook-list">{actions.map((item) => <article className={`playbook-card status-${item.status}`} key={item.id}>
      <header><span className={`status-pill ${item.status}`}>{item.outcome ? 'measured' : item.status}</span>{item.has_launch_kit && <span className="kit-ready-pill"><CheckCircle2 /> Kit ready</span>}{item.is_demo && <span className="demo-data-pill">Demo data</span>}<time>{new Date(`${item.scheduled_for}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</time></header>
      <h2>{item.title}</h2><p>{item.action}</p><div className="metric-line"><Target /><span><small>Success looks like</small><strong>{item.success_metric}</strong></span></div>
      {item.outcome ? <div className={`outcome-result ${item.outcome.lift_amount >= 0 ? 'positive' : 'negative'}`}><TrendingUp /><div><span><strong>{item.outcome.lift_amount >= 0 ? '+' : '−'}${Math.abs(item.outcome.lift_amount).toLocaleString()}</strong> vs baseline</span><small>${item.outcome.observed_sales.toLocaleString()} observed · ${item.outcome.baseline_sales.toLocaleString()} usual {item.outcome.note && `· “${item.outcome.note}”`}</small></div></div> : <div className="playbook-actions">{item.status === 'planned' ? <>
        <button className={`launch-kit-button ${item.has_launch_kit ? 'ready' : ''}`} onClick={() => openOrBuildKit(item)} disabled={buildingId === item.id}>{buildingId === item.id ? <LoaderCircle className="spin" /> : item.has_launch_kit ? <CheckCircle2 /> : <Megaphone />} {buildingId === item.id ? 'Building your kit…' : item.has_launch_kit ? 'Open Launch Kit' : 'Build Launch Kit'}</button>
        <button className="primary-button" onClick={() => updateAction(item.id, 'completed').catch(() => setError('Could not mark that action done.'))}><Check /> Mark as done</button><button className="quiet-button" onClick={() => updateAction(item.id, 'dismissed').catch(() => setError('Could not dismiss that action.'))}><X /> Dismiss</button>
      </> : item.status === 'completed' ? <button className="primary-button" onClick={() => setSelected(item)}><TrendingUp /> Log the result</button> : null}</div>}
    </article>)}</div> : <div className="empty-state"><ClipboardCheck /><h2>Your Playbook is ready for its first move</h2><p>Open the morning briefing and put one recommendation into your plan.</p></div>}
    {selected && <OutcomeModal action={selected} close={() => setSelected(null)} save={async (values) => { await recordOutcome(selected.id, values); setSelected(null) }} />}
    {studioAction?.launch_kit && <LaunchKitStudio action={studioAction} kit={studioAction.launch_kit} close={() => setStudioAction(null)} refresh={async () => { const launchKit = await buildLaunchKit(studioAction.id, true); setStudioAction((current) => ({ ...current, launch_kit: launchKit })); return launchKit }} />}
  </div>
}

function escapeCalendarText(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

function calendarTimestamp(value) {
  const pad = (number) => String(number).padStart(2, '0')
  return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}T${pad(value.getHours())}${pad(value.getMinutes())}00`
}

export function buildCalendarFile(kit) {
  const start = new Date(`${kit.schedule.date}T${kit.schedule.time}:00`)
  const end = new Date(start.getTime() + 30 * 60 * 1000)
  const description = `Audience: ${kit.audience}\nMeasure: ${kit.measurement.metric}\nNothing is published or sent automatically.`
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sidekick AI//Launch Kit//EN', 'BEGIN:VEVENT', `UID:sidekick-action-${kit.action_id}@sidekick.local`, `DTSTAMP:${calendarTimestamp(new Date())}`, `DTSTART:${calendarTimestamp(start)}`, `DTEND:${calendarTimestamp(end)}`, `SUMMARY:${escapeCalendarText(kit.offer_name)}`, `DESCRIPTION:${escapeCalendarText(description)}`, 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n')
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value)
  const textarea = document.createElement('textarea')
  textarea.value = value; textarea.style.position = 'fixed'; textarea.style.opacity = '0'
  document.body.appendChild(textarea); textarea.select(); document.execCommand('copy'); textarea.remove()
}

export function LaunchKitStudio({ action, kit, close, refresh }) {
  const [copied, setCopied] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const handleKey = (event) => event.key === 'Escape' && close()
    window.addEventListener('keydown', handleKey)
    document.body.classList.add('launch-kit-open')
    return () => { window.removeEventListener('keydown', handleKey); document.body.classList.remove('launch-kit-open') }
  }, [close])

  async function copy(label, value) {
    try { await copyText(value); setCopied(label); window.setTimeout(() => setCopied(''), 1800) }
    catch { setError('Copy is blocked in this browser. Select the text manually.') }
  }
  function downloadCalendar() {
    const blob = new Blob([buildCalendarFile(kit)], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = `${kit.offer_name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'sidekick-launch-kit'}.ics`
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url)
  }
  async function regenerate() {
    setRefreshing(true); setError('')
    try { await refresh() } catch { setError('Sidekick kept your current kit because regeneration was unavailable.') }
    finally { setRefreshing(false) }
  }
  const providerName = { local: 'Explainable local generator', gemini: 'Gemini', anthropic: 'Claude' }[kit.provider] || kit.provider
  const scheduled = new Date(`${kit.schedule.date}T${kit.schedule.time}:00`)
  return <div className="launch-studio-scrim" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
    <section className="launch-studio" role="dialog" aria-modal="true" aria-labelledby="launch-kit-title">
      <header className="studio-header"><div><span className="studio-mark"><Megaphone /></span><div><p className="eyebrow">Launch Kit Studio</p><h2 id="launch-kit-title">{kit.offer_name}</h2><p>Everything needed to turn this Playbook move into action.</p></div></div><button className="modal-close" onClick={close} aria-label="Close Launch Kit Studio"><X /></button></header>
      <div className="studio-trust"><span><Sparkles /> Generated by {providerName}</span>{action.is_demo && <span className="demo-data-pill">Demo action context</span>}<span>Copy only · nothing is sent or published</span></div>
      {error && <p className="form-error">{error}</p>}
      <div className="studio-grid">
        <section className="studio-panel copy-panel"><div className="panel-heading"><div><Coffee /><span><small>Customer-ready copy</small><strong>Phone preview</strong></span></div><span>{kit.audience}</span></div>
          <div className="phone-preview"><div className="phone-speaker" /><div className="social-preview"><span className="mini-brand">J</span><div><strong>{action.profile_name}</strong><small>Post preview · not published</small></div></div><p>{kit.customer_copy.social}</p><div className="social-image"><span>{kit.customer_copy.sign_headline}</span><small>{kit.customer_copy.sign_body}</small></div></div>
          <div className="copy-row"><div><small>Social caption</small><p>{kit.customer_copy.social}</p></div><button onClick={() => copy('social', kit.customer_copy.social)}><Copy /> {copied === 'social' ? 'Copied' : 'Copy'}</button></div>
          <div className="copy-row sms-row"><div><small>SMS · {kit.customer_copy.sms.length}/160</small><p>{kit.customer_copy.sms}</p></div><button onClick={() => copy('sms', kit.customer_copy.sms)}><Copy /> {copied === 'sms' ? 'Copied' : 'Copy'}</button></div>
        </section>
        <section className="studio-panel sign-panel"><div className="panel-heading"><div><Printer /><span><small>Sidewalk sign</small><strong>Print-ready preview</strong></span></div><button onClick={() => window.print()}><Printer /> Print sign</button></div>
          <div className="launch-sign"><div className="sign-spark">✦</div><small>{action.profile_name}</small><h3>{kit.customer_copy.sign_headline}</h3><p>{kit.customer_copy.sign_body}</p><span>YOUR NEIGHBORHOOD SIDEKICK PICK</span></div>
        </section>
        <section className="studio-panel operations-panel"><div className="panel-heading"><div><PackageCheck /><span><small>Make it happen</small><strong>Operations checklist</strong></span></div></div><ol>{kit.operations.map((operation, index) => <li key={`${operation.task}-${index}`}><span>{index + 1}</span><div><strong>{operation.task}</strong><small>{operation.timing} · {operation.owner}</small></div></li>)}</ol></section>
        <section className="studio-panel timing-panel"><div className="panel-heading"><div><Clock3 /><span><small>{kit.schedule.label}</small><strong>{scheduled.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · {scheduled.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</strong></span></div></div><button className="calendar-button" onClick={downloadCalendar}><CalendarPlus /> Download calendar task</button><p>No calendar account is connected or modified.</p></section>
        <section className="studio-panel measurement-panel"><div className="panel-heading"><div><Target /><span><small>Measurement plan</small><strong>Know whether it worked</strong></span></div></div><div className="baseline"><small>Comparable-day baseline</small><strong>${Number(kit.measurement.baseline_sales).toLocaleString()}</strong></div><p>{kit.measurement.metric}</p><span>After the day ends, mark the Playbook action done and log observed sales.</span></section>
      </div>
      <footer className="studio-footer"><p><CheckCircle2 /> Your action stays planned until you mark it done.</p><button className="quiet-button" onClick={regenerate} disabled={refreshing}>{refreshing ? <LoaderCircle className="spin" /> : <RefreshCw />} {refreshing ? 'Refreshing…' : 'Regenerate kit'}</button><button className="primary-button" onClick={close}>Back to Playbook</button></footer>
    </section>
  </div>
}

function OutcomeModal({ action, close, save }) {
  const [sales, setSales] = useState('')
  const [helped, setHelped] = useState('yes')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    if (sales === '' || Number(sales) < 0) { setError('Enter the day’s observed sales.'); return }
    setSaving(true); setError('')
    try { await save({ observed_sales: Number(sales), helped, note }) } catch { setError('Sidekick could not save that result. Please try again.'); setSaving(false) }
  }
  return <div className="modal-scrim" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}><form className="outcome-modal" onSubmit={submit}><button type="button" className="modal-close" onClick={close}><X /></button><span className="modal-icon"><Sparkles /></span><p className="eyebrow">Close the learning loop</p><h2>How did “{action.title}” go?</h2><p>Sidekick compares the result with similar weekdays—then brings what worked into tomorrow’s advice.</p><label>Observed sales that day<div className="money-input"><span>$</span><input autoFocus type="number" min="0" step="0.01" value={sales} onChange={(event) => setSales(event.target.value)} placeholder="0.00" /></div></label><fieldset><legend>Did this action help?</legend><button type="button" className={helped === 'yes' ? 'selected' : ''} onClick={() => setHelped('yes')}><ThumbsUp /> Yes</button><button type="button" className={helped === 'unsure' ? 'selected' : ''} onClick={() => setHelped('unsure')}><Sparkles /> Unsure</button><button type="button" className={helped === 'no' ? 'selected' : ''} onClick={() => setHelped('no')}><ThumbsDown /> No</button></fieldset><label>Quick note <small>(optional)</small><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What did customers respond to?" /></label>{error && <p className="form-error">{error}</p>}<button className="primary-button full" disabled={saving}>{saving ? <LoaderCircle className="spin" /> : <Sparkles />} Save result and teach Sidekick</button></form></div>
}

function HistoryView({ profile }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch(`${API}/api/history?business=${encodeURIComponent(profile.name)}`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setHistory(data.history || []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false))
  }, [profile.name])
  return <div className="simple-page history-page"><p className="eyebrow">Past advice</p><h1>Your sidekick’s notebook</h1><p>Every generated briefing is saved here, so you can return to the moves that worked.</p>{loading ? <div className="history-loading"><LoaderCircle className="spin" /> Opening the notebook…</div> : history.length ? <div className="history-list">{history.map((entry, index) => <article key={`${entry.generated_at}-${index}`}><header><div><strong>{new Date(entry.generated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong><small>{new Date(entry.generated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</small></div><span>{entry.advisor_mode === 'claude' ? 'Claude advisor' : 'Demo advisor'}</span></header>{entry.recommendations.map((item) => <div className="history-rec" key={item.id}><Check /><div><strong>{item.title}</strong><p>{item.action}</p></div></div>)}</article>)}</div> : <div className="empty-state"><History /><h2>Your first briefing is today</h2><p>Return to the morning briefing and tap refresh to start building your history.</p></div>}</div>
}

function SettingsView({ profile, reset, resetDemo }) { return <div className="simple-page"><p className="eyebrow">Business profile</p><h1>{profile.name}</h1><p>The context your sidekick uses to tailor every recommendation.</p><div className="settings-card"><div><small>Business type</small><strong>{profile.type}</strong></div><div><small>Location</small><strong>{profile.location}</strong></div><div><small>Current focus</small><strong>{profile.goal}</strong></div><div><small>Sales days connected</small><strong>{profile.sales.length} days</strong></div>{profile.name === demoProfile.name && <button className="secondary-button demo-reset" onClick={resetDemo}><RotateCcw /> Reset recorded-demo story</button>}<button className="secondary-button" onClick={reset}>Start over with another business</button></div></div> }

export default App
