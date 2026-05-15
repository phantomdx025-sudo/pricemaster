/**
 * AdminPanel — dashboard shell with sidebar navigation.
 * Routes to AdminCatalogue and AdminStaff sub-views.
 * On mobile: uses a top tab bar instead of sidebar.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutGrid, Users, LogOut, Moon, Sun } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import Sidebar from '../components/layout/Sidebar'
import AdminCatalogueContent from './AdminCatalogue'
import AdminStaffContent from './AdminStaff'

const NAV_ITEMS = [
  { id: 'catalogue', label: 'Catalogue', icon: <LayoutGrid size={16} /> },
  { id: 'staff',     label: 'Staff',     icon: <Users size={16} /> },
]

function useDarkToggle() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  )
  const toggle = () => {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    try { localStorage.setItem('pm_theme', next ? 'dark' : 'light') } catch (_) {}
  }
  return [isDark, toggle]
}

export default function AdminPanel() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('catalogue')
  const [isDark, toggleTheme] = useDarkToggle()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--bg-base)' }}>
      {/* ── Mobile top header ────────────────────────────── */}
      <header
        className="md:hidden flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--brand)' }}
          >
            <span className="text-xs font-bold" style={{ color: 'var(--text-inverse)' }}>PM</span>
          </div>
          <span className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            Admin
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl transition-colors"
            style={{ color: 'var(--error)' }}
            aria-label="Log out"
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>

      {/* ── Mobile tab bar ───────────────────────────────── */}
      <div
        className="md:hidden flex border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === activeSection
          return (
            <button
              key={item.id}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors"
              style={{
                color: isActive ? 'var(--brand)' : 'var(--text-muted)',
                borderBottom: isActive ? '2px solid var(--brand)' : '2px solid transparent',
              }}
              onClick={() => setActiveSection(item.id)}
            >
              {item.icon}
              {item.label}
            </button>
          )
        })}
      </div>

      {/* ── Body ────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop sidebar */}
        <Sidebar
          items={NAV_ITEMS}
          activeId={activeSection}
          onSelect={setActiveSection}
          onLogout={handleLogout}
          adminEmail={session?.user?.email}
          isDark={isDark}
          onToggleTheme={toggleTheme}
        />

        {/* Content area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {activeSection === 'catalogue' && <AdminCatalogueContent />}
          {activeSection === 'staff'     && <AdminStaffContent />}
        </main>
      </div>
    </div>
  )
}
