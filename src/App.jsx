import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from './components/ui/Toast'
import PWAInstallPrompt from './components/ui/PWAInstallPrompt'
import { useAuth } from './hooks/useAuth'
import { useStaffAuth } from './hooks/useStaffAuth'
import Spinner from './components/ui/Spinner'

// Pages
import Home from './pages/Home'
import Catalogue from './pages/Catalogue'
import AdminPanel from './pages/AdminPanel'

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
  return (
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
  )
}
