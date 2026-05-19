import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Lock, Phone, User, Eye, EyeOff, ChevronRight, ArrowLeft, Package, Download, Share2, Smartphone } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useStaffAuth } from '../hooks/useStaffAuth'
import { supabase } from '../lib/supabase'
import Button from '../components/ui/Button'
import toast from 'react-hot-toast'

// ─── which panel is shown ─────────────────────────────────────
// 'landing' | 'admin-login' | 'staff-login' | 'staff-signup' | 'pending'
// ─────────────────────────────────────────────────────────────

function PasswordInput({ value, onChange, placeholder = 'Password', name, id, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="input-field pr-10"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
        style={{ color: 'var(--text-muted)' }}
        tabIndex={-1}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

// ── Admin Login ───────────────────────────────────────────────
function AdminLoginPanel({ onBack }) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    try {
      await login(email.trim(), password)
      navigate('/admin')
    } catch (err) {
      toast.error(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-slide-up w-full max-w-sm mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 mb-6 text-sm font-medium transition-opacity hover:opacity-70"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft size={15} />
        Back
      </button>

      <div className="mb-8">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'var(--brand-light)', border: '1px solid var(--brand-border)' }}
        >
          <Lock size={22} style={{ color: 'var(--brand)' }} />
        </div>
        <h2 className="font-display text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          Admin Login
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Sign in to manage the catalogue and staff.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="admin@example.com"
            autoComplete="email"
            required
            className="input-field"
          />
        </div>
        <div>
          <label className="label" htmlFor="admin-password">Password</label>
          <PasswordInput
            id="admin-password"
            name="admin-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Your password"
            autoComplete="current-password"
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full mt-2"
        >
          Sign In
        </Button>
      </form>
    </div>
  )
}

// ── Staff Login ───────────────────────────────────────────────
function StaffLoginPanel({ onBack, onSignUp }) {
  const { login: staffLogin } = useStaffAuth()
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!phone.trim() || !password) return
    setLoading(true)
    try {
      const res = await supabase.functions.invoke('staff-login', {
        body: { phone: phone.trim(), password },
      })

      if (res.error) throw new Error(res.error.message || 'Login failed')
      if (!res.data) throw new Error('No response from server. Please try again.')

      const { session, error: bodyError } = res.data
      if (bodyError) throw new Error(bodyError)
      if (!session) throw new Error('Login failed')

      staffLogin(session)
      navigate('/catalogue')
    } catch (err) {
      toast.error(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-slide-up w-full max-w-sm mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 mb-6 text-sm font-medium transition-opacity hover:opacity-70"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft size={15} />
        Back
      </button>

      <div className="mb-8">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'var(--brand-light)', border: '1px solid var(--brand-border)' }}
        >
          <Phone size={22} style={{ color: 'var(--brand)' }} />
        </div>
        <h2 className="font-display text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          Staff Login
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Enter your phone number and password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="staff-phone">Phone Number</label>
          <input
            id="staff-phone"
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="9876543210"
            autoComplete="tel"
            required
            className="input-field"
          />
        </div>
        <div>
          <label className="label" htmlFor="staff-password">Password</label>
          <PasswordInput
            id="staff-password"
            name="staff-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Your password"
            autoComplete="current-password"
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full mt-2"
        >
          Sign In
        </Button>
      </form>

      <div className="mt-6 text-center">
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Don't have an account?{' '}
        </span>
        <button
          type="button"
          onClick={onSignUp}
          className="text-sm font-semibold transition-opacity hover:opacity-70"
          style={{ color: 'var(--brand)' }}
        >
          Sign Up
        </button>
      </div>
    </div>
  )
}

// ── Staff Signup ──────────────────────────────────────────────
function StaffSignupPanel({ onBack, onPending }) {
  const [form, setForm] = useState({ name: '', phone: '', designation: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match')
      return
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      const res = await supabase.functions.invoke('staff-signup', {
        body: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          designation: form.designation.trim(),
          password: form.password,
        },
      })

      if (res.error) throw new Error(res.error.message || 'Signup failed')
      if (!res.data) throw new Error('No response from server. Please try again.')

      const { user, error: bodyError } = res.data
      if (bodyError) throw new Error(bodyError)

      onPending(form.name.trim())
    } catch (err) {
      toast.error(err.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-slide-up w-full max-w-sm mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 mb-6 text-sm font-medium transition-opacity hover:opacity-70"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft size={15} />
        Back to Login
      </button>

      <div className="mb-7">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'var(--brand-light)', border: '1px solid var(--brand-border)' }}
        >
          <User size={22} style={{ color: 'var(--brand)' }} />
        </div>
        <h2 className="font-display text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          Create Account
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Your account will be active once the admin approves it.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="signup-name">Full Name</label>
          <input
            id="signup-name"
            type="text"
            value={form.name}
            onChange={set('name')}
            placeholder="Your name"
            autoComplete="name"
            required
            className="input-field"
          />
        </div>
        <div>
          <label className="label" htmlFor="signup-phone">Phone Number</label>
          <input
            id="signup-phone"
            type="tel"
            value={form.phone}
            onChange={set('phone')}
            placeholder="9876543210"
            autoComplete="tel"
            required
            className="input-field"
          />
        </div>
        <div>
          <label className="label" htmlFor="signup-designation">Designation</label>
          <input
            id="signup-designation"
            type="text"
            value={form.designation}
            onChange={set('designation')}
            placeholder="e.g. Sales Staff"
            autoComplete="organization-title"
            required
            className="input-field"
          />
        </div>
        <div>
          <label className="label" htmlFor="signup-password">Password</label>
          <PasswordInput
            id="signup-password"
            name="signup-password"
            value={form.password}
            onChange={set('password')}
            placeholder="Min. 6 characters"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="label" htmlFor="signup-confirm">Confirm Password</label>
          <PasswordInput
            id="signup-confirm"
            name="signup-confirm"
            value={form.confirm}
            onChange={set('confirm')}
            placeholder="Repeat password"
            autoComplete="new-password"
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full mt-2"
        >
          Request Access
        </Button>
      </form>
    </div>
  )
}

// ── Pending Screen ────────────────────────────────────────────
function PendingPanel({ name, onBack }) {
  return (
    <div className="animate-slide-up w-full max-w-sm mx-auto text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
        style={{ background: 'var(--success-light)', border: '2px solid var(--success)' }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h2 className="font-display text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
        Request Submitted
      </h2>
      <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--text-muted)' }}>
        Thanks, <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{name}</span>! Your account is pending admin approval. You'll be able to sign in once it's approved.
      </p>
      <Button variant="ghost" onClick={onBack} className="w-full">
        Back to Login
      </Button>
    </div>
  )
}

// ── Install banner (shown on landing page) ────────────────────
function InstallBanner() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installed, setInstalled]         = useState(false)
  const [dismissed, setDismissed]         = useState(false)

  const ua = navigator.userAgent
  const isIOS = /iphone|ipad|ipod/i.test(ua) && !/CriOS|FxiOS/i.test(ua)
  const isAndroid = /android/i.test(ua)
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true

  useEffect(() => {
    if (window.__pwaInstallPrompt) setInstallPrompt(window.__pwaInstallPrompt)
    const onReady = () => setInstallPrompt(window.__pwaInstallPrompt)
    window.addEventListener('pwa-prompt-ready', onReady)
    window.addEventListener('appinstalled', () => setInstalled(true))
    return () => window.removeEventListener('pwa-prompt-ready', onReady)
  }, [])

  // Never show if already a PWA, or user dismissed
  if (isStandalone || installed || dismissed) return null

  const handleInstall = async () => {
    if (!installPrompt) return
    try {
      installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      if (outcome === 'accepted') setInstalled(true)
    } catch (_) {}
    window.__pwaInstallPrompt = null
    setInstallPrompt(null)
  }

  // Android with native prompt available — show Install button
  if (installPrompt) {
    return (
      <div
        className="mt-5 rounded-2xl p-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--brand-border)' }}
      >
        <div className="flex items-center gap-3">
          <img src="/icons/icon-72.png" alt="" className="w-9 h-9 rounded-xl flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Install PriceMaster
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Add to home screen for quick access
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setDismissed(true)}
              className="text-xs px-2 py-1.5 rounded-lg"
              style={{ color: 'var(--text-muted)' }}
            >
              Not now
            </button>
            <button
              onClick={handleInstall}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl"
              style={{ background: 'var(--brand)', color: 'var(--text-inverse)' }}
            >
              Install
            </button>
          </div>
        </div>
      </div>
    )
  }

  // iOS Safari — always show manual instructions (can't do programmatic install)
  if (isIOS) {
    return (
      <div
        className="mt-5 rounded-2xl p-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: 'var(--brand-light)' }}
          >
            <Smartphone size={17} style={{ color: 'var(--brand)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
              Add to Home Screen
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Tap the <Share2 size={11} className="inline mx-0.5" /> <strong>Share</strong> button at the bottom of Safari, then tap <strong>"Add to Home Screen"</strong>.
            </p>
          </div>
          <button onClick={() => setDismissed(true)} style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            <span style={{ fontSize: '18px', lineHeight: 1 }}>×</span>
          </button>
        </div>
      </div>
    )
  }

  // Android without prompt (Chrome first visit, not yet eligible) or Desktop
  // Show manual instructions as fallback
  return (
    <div
      className="mt-5 rounded-2xl p-4"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: 'var(--brand-light)' }}
        >
          <Download size={17} style={{ color: 'var(--brand)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
            Install PriceMaster
          </p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Tap the <strong>⋮ menu</strong> in your browser, then tap <strong>"Add to Home Screen"</strong> or <strong>"Install app"</strong>.
          </p>
        </div>
        <button onClick={() => setDismissed(true)} style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          <span style={{ fontSize: '18px', lineHeight: 1 }}>×</span>
        </button>
      </div>
    </div>
  )
}

// ── Landing ───────────────────────────────────────────────────
function LandingPanel({ onAdmin, onStaff }) {
  return (
    <div className="animate-fade-in w-full max-w-sm mx-auto">
      {/* Logo + Title */}
      <div className="text-center mb-10">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-warm"
          style={{ background: 'var(--brand)', boxShadow: '0 4px 20px rgba(212,132,42,0.4)' }}
        >
          <Package size={30} color="#fffbf0" />
        </div>
        <h1 className="font-display text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          PriceMaster
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Textile & Garment Supplies — Price Catalogue
        </p>
      </div>

      {/* Entry cards */}
      <div className="flex flex-col gap-3">
        {/* Staff card */}
        <button
          onClick={onStaff}
          className="group w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all duration-200 hover:shadow-warm"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
            style={{ background: 'var(--brand-light)' }}
          >
            <Phone size={20} style={{ color: 'var(--brand)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm mb-0.5" style={{ color: 'var(--text-primary)' }}>
              Staff Login
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Browse the price catalogue
            </p>
          </div>
          <ChevronRight size={16} className="flex-shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--text-muted)' }} />
        </button>

        {/* Admin card */}
        <button
          onClick={onAdmin}
          className="group w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all duration-200 hover:shadow-warm"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--bg-elevated)' }}
          >
            <Lock size={20} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm mb-0.5" style={{ color: 'var(--text-primary)' }}>
              Admin Login
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Manage catalogue & staff
            </p>
          </div>
          <ChevronRight size={16} className="flex-shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {/* Install banner — sits right below login cards */}
      <InstallBanner />

      {/* Divider + signup hint */}
      <div className="mt-6 text-center">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          New staff member?{' '}
        </span>
        <button
          type="button"
          onClick={onStaff}
          className="text-xs font-semibold transition-opacity hover:opacity-70"
          style={{ color: 'var(--brand)' }}
        >
          Request access
        </button>
      </div>
    </div>
  )
}

// ── Home (root) ───────────────────────────────────────────────
export default function Home() {
  const { isAdmin, loading: adminLoading } = useAuth()
  const { isStaff, loading: staffLoading } = useStaffAuth()
  const [panel, setPanel] = useState('landing')
  const [pendingName, setPendingName] = useState('')

  // Wait for both auth states to resolve before deciding
  if (adminLoading || staffLoading) return null

  if (isAdmin) return <Navigate to="/admin" replace />
  if (isStaff) return <Navigate to="/catalogue" replace />

  const handlePending = (name) => {
    setPendingName(name)
    setPanel('pending')
  }

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Subtle background texture — two soft radial glows */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background: `
            radial-gradient(ellipse 60% 40% at 20% 10%, rgba(212,132,42,0.08) 0%, transparent 70%),
            radial-gradient(ellipse 50% 50% at 80% 90%, rgba(212,132,42,0.06) 0%, transparent 70%)
          `,
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        {panel === 'landing' && (
          <LandingPanel
            onAdmin={() => setPanel('admin-login')}
            onStaff={() => setPanel('staff-login')}
          />
        )}
        {panel === 'admin-login' && (
          <AdminLoginPanel onBack={() => setPanel('landing')} />
        )}
        {panel === 'staff-login' && (
          <StaffLoginPanel
            onBack={() => setPanel('landing')}
            onSignUp={() => setPanel('staff-signup')}
          />
        )}
        {panel === 'staff-signup' && (
          <StaffSignupPanel
            onBack={() => setPanel('staff-login')}
            onPending={handlePending}
          />
        )}
        {panel === 'pending' && (
          <PendingPanel
            name={pendingName}
            onBack={() => setPanel('staff-login')}
          />
        )}
      </div>

      {/* Footer */}
      <p
        className="relative z-10 mt-10 text-xs"
        style={{ color: 'var(--text-muted)' }}
      >
        PriceMaster · Textile & Garment Supplies
      </p>
    </div>
  )
}