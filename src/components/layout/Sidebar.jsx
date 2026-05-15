/**
 * Sidebar — admin panel navigation sidebar.
 * Desktop: fixed left sidebar. Mobile: hidden (admin uses top nav tabs instead).
 *
 * Props:
 *   items          — array of { id, label, icon: ReactNode }
 *   activeId       — string
 *   onSelect       — fn(id)
 *   onLogout       — fn()
 *   adminEmail     — string
 *   isDark         — bool (Phase 7: theme toggle)
 *   onToggleTheme  — fn()
 */
import { LogOut, Moon, Sun } from 'lucide-react'

export default function Sidebar({ items = [], activeId, onSelect, onLogout, adminEmail, isDark, onToggleTheme }) {
  return (
    <aside
      className="hidden md:flex flex-col w-56 shrink-0 min-h-0"
      style={{
        background: 'var(--bg-elevated)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Brand */}
      <div
        className="flex items-center gap-2.5 px-4 py-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--brand)' }}
        >
          <span className="text-xs font-bold" style={{ color: 'var(--text-inverse)' }}>PM</span>
        </div>
        <div className="min-w-0">
          <p className="font-display font-semibold text-sm leading-tight truncate" style={{ color: 'var(--text-primary)' }}>
            PriceMaster
          </p>
          <p className="text-xs leading-tight" style={{ color: 'var(--text-muted)' }}>Admin Panel</p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-0.5 px-2 py-3 flex-1">
        {items.map((item) => {
          const isActive = item.id === activeId
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all duration-150 w-full"
              style={{
                color: isActive ? 'var(--brand)' : 'var(--text-primary)',
                background: isActive ? 'var(--brand-light)' : 'transparent',
                fontWeight: isActive ? '600' : '500',
              }}
            >
              <span className="flex-shrink-0" style={{ color: isActive ? 'var(--brand)' : 'var(--text-muted)' }}>
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
              {isActive && (
                <span
                  className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: 'var(--brand)' }}
                />
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer: theme toggle + admin email + logout */}
      <div
        className="px-3 py-3 flex flex-col gap-1"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium w-full transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
            {isDark ? 'Light mode' : 'Dark mode'}
          </button>
        )}
        {adminEmail && (
          <p className="text-xs px-2 truncate" style={{ color: 'var(--text-muted)' }} title={adminEmail}>
            {adminEmail}
          </p>
        )}
        <button
          onClick={onLogout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium w-full transition-opacity hover:opacity-80"
          style={{ color: 'var(--error)' }}
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
