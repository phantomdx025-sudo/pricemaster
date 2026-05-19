// PriceMaster Service Worker
// Purpose: Enable PWA install prompt only.
// No offline caching — this app requires an internet connection.

const CACHE_NAME = 'pricemaster-v2'

// Install — activate immediately, no pre-caching
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

// Activate — claim clients immediately, clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  )
})

// Fetch — always go to network (no offline support)
self.addEventListener('fetch', (event) => {
  // Only handle same-origin requests; let cross-origin (Supabase, fonts) pass through
  if (!event.request.url.startsWith(self.location.origin)) return
  event.respondWith(fetch(event.request))
})
