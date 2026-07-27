import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Icon } from './Icons'

function Logo() {
  return (
    <NavLink to="/" className="brand" aria-label="CardSparks home">
      <span className="brand-mark"><Icon name="sparkles" size={22} strokeWidth={2.1} /></span>
      <span>Card<span>Sparks</span></span>
    </NavLink>
  )
}

export default function Layout() {
  const { theme, toggleTheme, user, logout, isMockMode } = useApp()
  const [profileOpen, setProfileOpen] = useState(false)
  const navigate = useNavigate()
  const initials = (user?.name || 'Guest learner').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <nav className="desktop-nav" aria-label="Primary navigation">
            <NavLink to="/" end><Icon name="grid" size={17} /> My decks</NavLink>
            <NavLink to="/decks/new"><Icon name="plus" size={17} /> Create</NavLink>
          </nav>
          <div className="topbar-actions">
            {isMockMode && <span className="demo-badge"><span /> Demo mode</span>}
            <button className="icon-button" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
              <Icon name={theme === 'light' ? 'moon' : 'sun'} size={19} />
            </button>
            <div className="profile-wrap">
              <button className="avatar-button" type="button" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen}>
                {initials}
              </button>
              {profileOpen && (
                <div className="profile-menu">
                  <div className="profile-copy">
                    <strong>{user?.name}</strong>
                    <span>{user?.guest ? 'Learning as guest' : user?.email}</span>
                  </div>
                  <button type="button" onClick={() => { logout(); setProfileOpen(false); navigate('/login') }}><Icon name="logout" size={17} /> {user?.guest ? 'Sign in' : 'Sign out'}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main><Outlet /></main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <NavLink to="/" end><Icon name="grid" size={20} /><span>Decks</span></NavLink>
        <NavLink to="/decks/new"><span className="mobile-create"><Icon name="plus" size={22} /></span><span>Create</span></NavLink>
        <NavLink to="/login"><span className="mobile-avatar">{initials}</span><span>Profile</span></NavLink>
      </nav>
    </div>
  )
}

