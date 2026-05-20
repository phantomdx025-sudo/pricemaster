import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from './components/ui/Toast'
import PWAInstallPrompt from './components/ui/PWAInstallPrompt'
import SplashScreen from './components/ui/SplashScreen'
import { useAuth } from './hooks/useAuth'
import { useStaffAuth } from './hooks/useStaffAuth'
import Spinner from './components/ui/Spinner'
import { fetchTheme } from './hooks/useAppSettings'

// Pages
import Home from './pages/Home'
import Catalogue from './pages/Catalogue'
import AdminPanel from './pages/AdminPanel'
import AdminLedger from './pages/AdminLedger'

// ── Dark mode — follow system preference ──────────────────────
function applySystemTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (prefersDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

// Apply immediately (before first paint) and watch for changes
applySystemTheme()
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySystemTheme)

// ── BX-6: Determine if splash should be shown ──────────────────
// Only show on true first load in this tab session.
function shouldShowSplash() {
  try {
    return !sessionStorage.getItem('ax_splash_shown')
  } catch (_) {
    return false
  }
}

// ── Route Guards ──────────────────────────────────────────────
function RequireStaff({ children }) {
  const { isStaff, loading } = useStaffAuth()
  if (loading) return (
    <div className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <Spinner size={32} />
    </div>
  )
  return isStaff ? children : <Navigate to="/" replace />
}

function RequireAdmin({ children }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return (
    <div className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <Spinner size={32} />
    </div>
  )
  return isAdmin ? children : <Navigate to="/" replace />
}

// ── App ───────────────────────────────────────────────────────
export default function App() {
  // BX-6: Splash screen — shown once per browser tab session
  const [splashDone, setSplashDone] = useState(() => !shouldShowSplash())

  // BX-8: Apply saved colour theme from app_settings on every load
  useEffect(() => {
    fetchTheme().then(theme => {
      document.documentElement.setAttribute('data-theme', theme)
    })
  }, [])

  return (
    <>
      {/* BX-6: Splash screen overlay — shown before app content on first load */}
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}

      <BrowserRouter>
        <Toaster />
        <PWAInstallPrompt />

        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />

          {/* Staff — protected */}
          <Route
            path="/catalogue"
            element={
              <RequireStaff>
                <Catalogue />
              </RequireStaff>
            }
          />

          {/* AX-3: Full-page ledger — must be BEFORE /admin/* wildcard */}
          <Route
            path="/admin/financial/ledger/:partyType/:partyName"
            element={
              <RequireAdmin>
                <AdminLedger />
              </RequireAdmin>
            }
          />

          {/* Admin — protected (handles all /admin/* sub-routes) */}
          <Route
            path="/admin/*"
            element={
              <RequireAdmin>
                <AdminPanel />
              </RequireAdmin>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  )
}
