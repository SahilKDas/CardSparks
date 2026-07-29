import { Link, NavLink, Outlet } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/useApp'
import { Icon } from './Icons'

function Logo({ destination }) {
  return (
    <NavLink to={destination} className="brand" aria-label="CardSparks home">
      <span className="brand-mark"><Icon name="sparkles" size={22} strokeWidth={2.1} /></span>
      <span>Card<span>Sparks</span></span>
    </NavLink>
  )
}

export default function Layout() {
  const { theme, toggleTheme, user, logout, isMockMode, isAuthenticated } = useApp()
  const [profileOpen, setProfileOpen] = useState(false)
  const profileWrap = useRef(null)
  const mobileProfileButton = useRef(null)
  const initials = (user?.name || user?.email || 'Learner').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  useEffect(() => {
    if (!profileOpen) return undefined
    const closeProfile = (event) => {
      const clickedOutside = event.type === 'pointerdown'
        && !profileWrap.current?.contains(event.target)
        && !mobileProfileButton.current?.contains(event.target)
      if (event.key === 'Escape' || clickedOutside) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('keydown', closeProfile)
    document.addEventListener('pointerdown', closeProfile)
    return () => {
      document.removeEventListener('keydown', closeProfile)
      document.removeEventListener('pointerdown', closeProfile)
    }
  }, [profileOpen])

  useEffect(() => {
    if (!isAuthenticated) setProfileOpen(false)
  }, [isAuthenticated])

  return (
    <div className={`app-shell ${isAuthenticated ? 'authenticated' : 'public'}`}>
      <header className="topbar">
        <div className="topbar-inner">
          <Logo destination={isAuthenticated ? '/decks' : '/'} />
          <nav className="desktop-nav" aria-label="Primary navigation">
            {isAuthenticated ? <>
              <NavLink to="/decks" end><Icon name="grid" size={17} /> My decks</NavLink>
              <NavLink to="/stats"><Icon name="clock" size={17} /> Progress</NavLink>
              <NavLink to="/community"><Icon name="sparkles" size={17} /> Community</NavLink>
              <NavLink to="/decks/new"><Icon name="plus" size={17} /> Create</NavLink>
            </> : <>
              <a href="/#how-it-works">How it works</a>
              <Link to="/login">For returning learners</Link>
            </>}
          </nav>
          <div className="topbar-actions">
            {isAuthenticated && isMockMode && <span className="demo-badge"><span /> Demo mode</span>}
            <button className="icon-button" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
              <Icon name={theme === 'light' ? 'moon' : 'sun'} size={19} />
            </button>
            {isAuthenticated ? <div className="profile-wrap" ref={profileWrap}>
              <button className="avatar-button" type="button" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen}>
                {initials}
              </button>
              {profileOpen && (
                <div className="profile-menu">
                  <div className="profile-copy">
                    <strong>{user?.name}</strong>
                    <span>{user?.email}</span>
                  </div>
                  <Link className="profile-menu-link" to="/settings" onClick={() => setProfileOpen(false)}><Icon name="clock" size={17} /> Study settings</Link>
                  <Link className="profile-menu-link" to="/transfer" onClick={() => setProfileOpen(false)}><Icon name="save" size={17} /> Import & export</Link>
                  <button type="button" onClick={() => { logout(); setProfileOpen(false) }}><Icon name="logout" size={17} /> Sign out</button>
                </div>
              )}
            </div> : <div className="public-auth-actions"><Link to="/login">Log in</Link><Link className="button button-primary" to="/signup">Get started</Link></div>}
          </div>
        </div>
      </header>

      <main><Outlet /></main>

      {isAuthenticated && <nav className="mobile-nav" aria-label="Mobile navigation">
        <NavLink to="/decks" end><Icon name="grid" size={20} /><span>Decks</span></NavLink>
        <NavLink to="/stats"><Icon name="clock" size={20} /><span>Progress</span></NavLink>
        <NavLink to="/community"><Icon name="sparkles" size={20} /><span>Community</span></NavLink>
        <NavLink to="/decks/new"><span className="mobile-create"><Icon name="plus" size={22} /></span><span>Create</span></NavLink>
        <button ref={mobileProfileButton} type="button" className={profileOpen ? 'active' : ''} onClick={() => setProfileOpen((value) => !value)}><span className="mobile-avatar">{initials}</span><span>Profile</span></button>
      </nav>}
    </div>
  )
}
