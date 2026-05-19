import { useState, useEffect } from 'react'
import { X, Share } from 'lucide-react'

/**
 * PWAInstallPrompt — fixed Phase 8 version.
 *
 * Key fixes vs Phase 7:
 * - Reads window.__pwaInstallPrompt (stashed in main.jsx BEFORE React mounts)
 *   so we never miss the beforeinstallprompt event.
 * - Also listens for the custom 'pwa-prompt-ready' event if the prompt
 *   fires after mount (e.g. on slower devices).
 * - iOS: detects correctly and shows Share instructions.
 * - 7-day dismiss cooldown via localStorage.
 * - Shows real app icon instead of generic icon.
 */
export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showBanner, setShowBanner]         = useState(false)
  const [platform, setPlatform]             = useState('android')

  useEffect(() => {
    // Already installed — never show
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    if (isStandalone) return

    // Dismiss cooldown (7 days)
    try {
      const ts = localStorage.getItem('pm_pwa_dismissed')
      if (ts && Date.now() - parseInt(ts, 10) < 7 * 24 * 60 * 60 * 1000) return
    } catch (_) {}

    // iOS Safari detection (excludes Chrome/Firefox on iOS)
    const ua = navigator.userAgent
    const isIOS =
      /iphone|ipad|ipod/i.test(ua) &&
      !/CriOS|FxiOS|OPiOS/i.test(ua) &&
      !window.MSStream

    if (isIOS) {
      setPlatform('ios')
      const t = setTimeout(() => setShowBanner(true), 3000)
      return () => clearTimeout(t)
    }

    // Android / Desktop — check if prompt already stashed before React mounted
    if (window.__pwaInstallPrompt) {
      setDeferredPrompt(window.__pwaInstallPrompt)
      setPlatform('android')
      setTimeout(() => setShowBanner(true), 1500)
      return
    }

    // Listen in case it fires after mount
    const onReady = () => {
      if (window.__pwaInstallPrompt) {
        setDeferredPrompt(window.__pwaInstallPrompt)
        setPlatform('android')
        setShowBanner(true)
      }
    }
    window.addEventListener('pwa-prompt-ready', onReady)
    const onInstalled = () => setShowBanner(false)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('pwa-prompt-ready', onReady)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    try {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setShowBanner(false)
    } catch (_) {}
    window.__pwaInstallPrompt = null
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowBanner(false)
    try { localStorage.setItem('pm_pwa_dismissed', String(Date.now())) } catch (_) {}
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
        <img
          src="/icons/icon-72.png"
          alt="PriceMaster"
          className="flex-shrink-0 w-10 h-10 rounded-xl"
          style={{ objectFit: 'cover' }}
        />

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm mb-0.5" style={{ color: 'var(--text-primary)' }}>
            Add PriceMaster to your phone
          </p>

          {platform === 'ios' ? (
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Tap the <Share size={11} className="inline mx-0.5" /> <strong>Share</strong> button at the bottom of Safari, then <strong>"Add to Home Screen"</strong>.
            </p>
          ) : (
            <>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Install for faster access — works like a native app.
              </p>
              {deferredPrompt && (
                <button
                  onClick={handleInstall}
                  className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg"
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
          className="flex-shrink-0 p-1 rounded-lg hover:opacity-60"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
