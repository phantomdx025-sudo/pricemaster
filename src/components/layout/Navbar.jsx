import { useState, useEffect } from 'react'
import { Package, LogOut, Search, Moon, Sun } from 'lucide-react'

/**
 * Navbar used in the Catalogue view.
 * Props:
 *   staffUser      — { name, designation } from useStaffAuth
 *   onLogout       — fn
 *   onSearchOpen   — fn (opens SearchBox overlay)
 *   showSearch     — bool
 */
export default function Navbar({ staffUser, onLogout, onSearchOpen, showSearch = false }) {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  )

  // Sync state when system preference changes externally
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      // Only sync if user hasn't manually overridden
      if (!localStorage.getItem('pm_theme')) {
        const dark = mq.matches
        setIsDark(dark)
        document.documentElement.classList.toggle('dark', dark)
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('pm_theme', next ? 'dark' : 'light')
    } catch (_) {}
  }

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-4 h-14 gap-3"
      style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--brand)' }}
        >
          <Package size={15} color="#fffbf0" />
        </div>
        <span className="font-display font-semibold text-base truncate" style={{ color: 'var(--text-primary)' }}>
          PriceMaster
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {showSearch && (
          <button
            onClick={onSearchOpen}
            className="p-2 rounded-xl transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Search"
          >
            <Search size={18} />
          </button>
        )}

        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-muted)' }}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {staffUser && (
          <div className="hidden sm:flex flex-col items-end mr-1">
            <span className="text-xs font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
              {staffUser.name}
            </span>
            <span className="text-xs leading-tight" style={{ color: 'var(--text-muted)' }}>
              {staffUser.designation}
            </span>
          </div>
        )}

        <button
          onClick={onLogout}
          className="p-2 rounded-xl transition-opacity hover:opacity-70"
          style={{ color: 'var(--error)' }}
          aria-label="Log out"
          title="Log out"
        >
          <LogOut size={17} />
        </button>
      </div>
    </header>
  )
}
