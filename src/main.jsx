import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// ── Theme init — run before React renders to avoid flash ──────
;(() => {
  try {
    const saved = localStorage.getItem('pm_theme')
    if (saved === 'dark') {
      document.documentElement.classList.add('dark')
    } else if (saved === 'light') {
      document.documentElement.classList.remove('dark')
    } else {
      // No saved preference — follow system
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark')
      }
    }
  } catch (_) {
    // localStorage unavailable — fall back to system
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark')
    }
  }
})()

// ── Capture beforeinstallprompt EARLY — before React mounts ──
// The browser fires this event very early (sometimes before components mount).
// We stash it on window so PWAInstallPrompt can pick it up anytime.
window.__pwaInstallPrompt = null
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  window.__pwaInstallPrompt = e
  // Dispatch a custom event so any already-mounted listener can react
  window.dispatchEvent(new Event('pwa-prompt-ready'))
})

// ── Service Worker registration ───────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[SW] Registered:', reg.scope)
      })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err)
      })
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
