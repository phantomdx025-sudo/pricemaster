import { useState, useEffect } from 'react'
import { Download, X, Share } from 'lucide-react'

/**
 * PWA Install Prompt — Phase 7 audited version.
 *
 * Covers:
 * - Android Chrome / Edge / Samsung Internet  → beforeinstallprompt
 * - iOS Safari (14.3+)                        → manual "Share → Add to Home Screen" instructions
 * - Desktop Chrome / Edge                     → beforeinstallprompt
 *
 * Dismissed state stored in localStorage with 7-day cooldown.
 * Never shown when app is already running standalone (installed).
 */
export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showBanner, setShowBanner] = useState(false)
  const [platform, setPlatform] = useState('android') // 'android' | 'ios'

  useEffect(() => {
    // Already installed as PWA — never show
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    if (isStandalone) return

    // Check dismiss cooldown (7 days)
    try {
      const ts = localStorage.getItem('pm_pwa_dismissed')
      if (ts && Date.now() - parseInt(ts, 10) < 7 * 24 * 60 * 60 * 1000) return
    } catch (_) {
      // localStorage unavailable — show anyway
    }

    // Detect iOS (iPhone, iPad, iPod) — these never fire beforeinstallprompt
    const ua = navigator.userAgent
    const isIOS = /iphone|ipad|ipod/i.test(ua) && !/CriOS/i.test(ua) && !window.MSStream
    // Samsung Internet also fires beforeinstallprompt, treat same as Android

    if (isIOS) {
      setPlatform('ios')
      const timer = setTimeout(() => setShowBanner(true), 2500)
      return () => clearTimeout(timer)
    }

    // Android Chrome, Samsung Internet, desktop Chrome/Edge
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setPlatform('android')
      setShowBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // appinstalled — hide if user installs via browser UI
    const onInstalled = () => setShowBanner(false)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    try {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setShowBanner(false)
      }
    } catch (_) {
      // prompt() can throw if called at wrong time
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowBanner(false)
    try {
      localStorage.setItem('pm_pwa_dismissed', String(Date.now()))
    } catch (_) {}
  }

  if (!showBanner) return null

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50 animate-slide-up"
      style={{ maxWidth: '420px', margin: '0 auto' }}
      role="dialog"
      aria-label="Install PriceMaster"
    >
      <div
        className="rounded-2xl p-4 flex items-start gap-3"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--brand-border)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        <div
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--brand-light)' }}
        >
          {platform === 'ios'
            ? <Share size={18} style={{ color: 'var(--brand)' }} />
            : <Download size={18} style={{ color: 'var(--brand)' }} />
          }
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm mb-0.5" style={{ color: 'var(--text-primary)' }}>
            Add PriceMaster to your phone
          </p>

          {platform === 'ios' ? (
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Tap the <strong>Share</strong> icon below, then tap{' '}
              <strong>"Add to Home Screen"</strong> for quick access.
            </p>
          ) : (
            <>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Install for faster access — works like a native app.
              </p>
              {deferredPrompt && (
                <button
                  onClick={handleInstall}
                  className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: 'var(--brand)', color: 'var(--text-inverse)' }}
                >
                  Install
                </button>
              )}
            </>
          )}
        </div>

        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 rounded-lg transition-opacity hover:opacity-60"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
