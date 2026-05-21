/**
 * AdminPanel — dashboard shell with sidebar navigation.
 * Routes to AdminCatalogue and AdminStaff sub-views.
 * BX-5: Mobile uses a slide-in sidebar overlay (hamburger) instead of top tab bar.
 */

import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutGrid, Users, LogOut, Moon, Sun, Search,
  TrendingUp, Settings, BarChart2, Menu, X,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import Sidebar from '../components/layout/Sidebar'
import AdminCatalogueContent from './AdminCatalogue'
import AdminStaffContent from './AdminStaff'
import AdminFinancialContent from './AdminFinancial'
import AdminSettingsContent from './AdminSettings'
import AdminReportsContent from './AdminReports'

const NAV_ITEMS = [
  { id: 'catalogue', label: 'Catalogue', icon: <LayoutGrid size={16} /> },
  { id: 'staff',     label: 'Staff',     icon: <Users size={16} /> },
  { id: 'financial', label: 'Financial', icon: <TrendingUp size={16} /> },
  { id: 'reports',   label: 'Reports',   icon: <BarChart2 size={16} /> },
  { id: 'settings',  label: 'Settings',  icon: <Settings size={16} /> },
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
  const location = useLocation()
  // AX-3: back from AdminLedger passes state.section to restore active section
  const [activeSection, setActiveSection] = useState(
    () => location.state?.section ?? 'catalogue'
  )
  const [isDark, toggleTheme] = useDarkToggle()
  const [searchOpen, setSearchOpen] = useState(false)
  // BX-5: mobile sidebar overlay state
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const handleLogout = async () => {
    sessionStorage.clear()
    await logout()
    navigate('/')
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* ── Mobile top header ────────────────────────────── */}
      <header
        className="md:hidden flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          {/* BX-5: Hamburger button — replaces the old logo-only left side */}
          <button
            onClick={() => setMobileNavOpen(true)}
            className="p-2 rounded-xl transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--brand)' }}
          >
            <span className="text-xs font-bold" style={{ color: 'var(--text-inverse)' }}>AX</span>
          </div>
          <span className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            Admin
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Search — only shown on catalogue tab */}
          {activeSection === 'catalogue' && (
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-xl transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Search"
            >
              <Search size={17} />
            </button>
          )}
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

      {/* ── BX-5: Mobile slide-in sidebar overlay ─────────── */}
      {mobileNavOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex"
          style={{ background: 'var(--bg-overlay)' }}
          onClick={() => setMobileNavOpen(false)}
        >
          <div
            className="w-64 h-full flex flex-col overflow-y-auto animate-slide-in-left"
            style={{ background: 'var(--bg-elevated)', borderRight: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Brand header */}
            <div
              className="flex items-center justify-between px-4 py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-2">
                <img src="/icons/icon.svg" alt="ANKxIOUS" className="w-7 h-7" />
                <span
                  className="font-display font-semibold text-sm"
                  style={{ color: 'var(--text-primary)' }}
                >
                  ANKxIOUS
                </span>
              </div>
              <button
                onClick={() => setMobileNavOpen(false)}
                className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
                style={{ color: 'var(--text-muted)' }}
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            {/* Nav items — same items as desktop sidebar */}
            <nav className="flex flex-col gap-0.5 px-2 py-3 flex-1">
              {NAV_ITEMS.map(item => {
                const isActive = item.id === activeSection
                return (
                  <button
                    key={item.id}
                    onClick={() => { setActiveSection(item.id); setMobileNavOpen(false) }}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-left transition-all w-full"
                    style={{
                      color: isActive ? 'var(--brand)' : 'var(--text-primary)',
                      background: isActive ? 'var(--brand-light)' : 'transparent',
                    }}
                  >
                    <span style={{ color: isActive ? 'var(--brand)' : 'var(--text-muted)' }}>
                      {item.icon}
                    </span>
                    {item.label}
                  </button>
                )
              })}
            </nav>

            {/* Bottom: theme toggle + logout */}
            <div
              className="px-2 py-3 flex-shrink-0"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <button
                onClick={toggleTheme}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-sm transition-opacity hover:opacity-70"
                style={{ color: 'var(--text-muted)' }}
              >
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
                {isDark ? 'Light Mode' : 'Dark Mode'}
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-sm transition-opacity hover:opacity-70"
                style={{ color: 'var(--error)' }}
              >
                <LogOut size={16} />
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Body ────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <Sidebar
          items={NAV_ITEMS}
          activeId={activeSection}
          onSelect={setActiveSection}
          onLogout={handleLogout}
          adminEmail={session?.user?.email}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          onSearchOpen={() => setSearchOpen(true)}
          showSearch={activeSection === 'catalogue'}
        />

        {/* Content area */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          {activeSection === 'catalogue' && (
            <AdminCatalogueContent
              searchOpen={searchOpen}
              onSearchClose={() => setSearchOpen(false)}
            />
          )}
          {activeSection === 'staff' && <AdminStaffContent />}
          {activeSection === 'financial' && <AdminFinancialContent />}
          {activeSection === 'reports' && <AdminReportsContent />}
          {activeSection === 'settings' && <AdminSettingsContent />}
        </main>
      </div>
    </div>
  )
}