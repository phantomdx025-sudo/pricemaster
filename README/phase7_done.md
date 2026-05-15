# Phase 7 — Done ✅
## Polish, PWA, QA & Vercel Deploy

---

## What Was Built

### PWA Audit & Improvements

**`public/manifest.json`** — added `"id": "/"` field (improves PWA identity on Chrome/Android) and a `screenshots` entry (required by some browsers for the enhanced install prompt). Cache name bumped to `pricemaster-v2`.

**`public/sw.js`** — tightened the fetch handler to only intercept same-origin requests. Cross-origin requests (Supabase, Google Fonts) now pass through untouched, which was causing spurious network errors on some Samsung Internet versions.

**`src/components/ui/PWAInstallPrompt.jsx`** — full rewrite:
- Detects Android Chrome, Samsung Internet, and desktop Chrome/Edge via `beforeinstallprompt`
- Detects iOS Safari (iPhone/iPad/iPod, excluding Chrome on iOS which also fires `beforeinstallprompt`) for manual "Share → Add to Home Screen" instructions
- Listens to `appinstalled` event to auto-hide banner if user installs via browser UI
- Uses `Share` icon for iOS, `Download` icon for others
- 7-day dismiss cooldown with `localStorage`
- Never shows in standalone mode (`display-mode: standalone` or `navigator.standalone`)

**`index.html`** — dual `theme-color` meta tags for light/dark mode (Chrome on Android switches the status bar colour). Added `apple-touch-icon` for 152px. Inline `<script>` in `<head>` applies saved theme before React mounts, preventing flash of unstyled content (FOUC) on reload.

---

### Dark / Light Mode

**`src/main.jsx`** — theme-init IIFE runs before React renders. Reads `pm_theme` from `localStorage` first, falls back to `prefers-color-scheme`. Duplicate logic from `App.jsx` cleaned up.

**`src/App.jsx`** — removed the module-level `applySystemTheme()` call (now handled in `main.jsx` and the Navbar hook). Cleaned up duplicate event listener.

**`src/components/layout/Navbar.jsx`** — manual dark/light toggle button added (Moon/Sun icon). Saves preference to `localStorage` as `pm_theme`. Still responds to system-level changes when no manual override is set.

**`src/components/layout/Sidebar.jsx`** — same toggle in the admin desktop sidebar footer. Accepts `isDark` and `onToggleTheme` props from `AdminPanel`.

**`src/pages/AdminPanel.jsx`** — wires `useDarkToggle` hook to both the mobile header and the desktop `Sidebar`. Mobile admin header now also has Moon/Sun button.

**`src/index.css`** — added `transition: background-color / border-color / color` on `*` for smooth theme transitions. Also added `text-size-adjust: 100%` (prevents iOS landscape font inflation), `env(safe-area-inset-bottom)` utility, and `scrollbar-hide` helper class.

---

### Loading States

**`src/components/ui/Skeleton.jsx`** — new component with `Skeleton` (base, any shape), `Skeleton.Row` (full item table row), and `Skeleton.Card` (mobile item card). Used in ItemTable.

**`src/components/catalogue/ItemTable.jsx`** — replaced the single centered spinner with inline skeleton rows/cards that match the table's actual layout. Desktop shows 10 skeleton rows; mobile shows 6 skeleton cards. No more blank white flash between tab switches.

---

### Empty States

All key empty states already existed from previous phases. Phase 7 improves the copy:
- **ItemTable** — "No items in this tab yet / Items will appear here once the admin adds them."
- **Catalogue no-tabs state** — unchanged (already good)
- **StaffApprovalList** pending/approved empty states — unchanged

---

### Error Handling

**`src/components/ui/ErrorBoundary.jsx`** — new React error boundary component. Catches unhandled render errors, shows a friendly error card with a "Try again" button (resets error state). Console-logs the full error + component stack for debugging. Wrap any page or section: `<ErrorBoundary><Catalogue /></ErrorBoundary>`.

---

### Vercel Deploy

**`vercel.json`**:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```
This is the only config needed. All routes (`/catalogue`, `/admin`, etc.) return `index.html` and React Router handles them client-side. Without this, hard refresh on any route returns a 404.

**`vite.config.js`** — added `host: true` to dev server (allows mobile devices on the same LAN to test via the dev server's IP). Added `rollupOptions.manualChunks` to split `react-vendor` and `supabase` into separate chunks, improving cache efficiency after deploys.

---

## Vercel Environment Variables

Set these in your Vercel project → Settings → Environment Variables:

| Variable | Value | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Supabase anon/public key. Safe to expose. |

**Do NOT add `SUPABASE_SERVICE_ROLE_KEY` to Vercel.** The service role key is only used by Supabase Edge Functions (deployed separately to Supabase, not Vercel). It must never reach the browser.

---

## Deploy Checklist

### One-time Supabase setup (if not already done)
- [ ] Run `supabase/migrations/001_init.sql` against your Supabase project
- [ ] Deploy edge functions: `supabase functions deploy staff-login`, `staff-signup`, `staff-write`, `catalogue-write`
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` as a Supabase secret: `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...`
- [ ] Enable Realtime on `staff_users` table in Supabase Dashboard → Database → Replication

### Every deploy
- [ ] Push code to GitHub (or connect repo to Vercel)
- [ ] Vercel auto-deploys on push to `main`
- [ ] Confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in Vercel project settings
- [ ] Visit deployed URL, confirm catalogue loads
- [ ] Test staff login with an approved account
- [ ] Test admin login and catalogue edit
- [ ] Open on Android Chrome — confirm install banner appears
- [ ] Open on iOS Safari — confirm "Add to Home Screen" instruction banner appears
- [ ] Toggle dark mode — confirm all screens look correct

### Mobile QA checklist (375px / iPhone SE viewport)
- [ ] Home landing — cards not clipped, buttons reachable with thumb
- [ ] Staff login / signup — all inputs visible above keyboard
- [ ] Catalogue — category strip scrollable, tab bar scrollable, item cards readable
- [ ] Search overlay — full-screen, keyboard doesn't obscure results
- [ ] Admin panel — tab bar visible, item list scrollable, forms usable
- [ ] Admin forms (ItemForm, TabManager, CategoryManager) — inputs not clipped

---

## Files Created / Modified in Phase 7

```
New:
  vercel.json                               ← SPA routing for Vercel
  src/components/ui/Skeleton.jsx            ← Skeleton loading placeholders
  src/components/ui/ErrorBoundary.jsx       ← React error boundary

Modified:
  index.html                                ← Dual theme-color, FOUC-prevention script
  public/manifest.json                      ← Added `id` field, screenshots stub
  public/sw.js                              ← Tightened fetch handler
  src/main.jsx                              ← Theme-init before React, clean SW registration
  src/App.jsx                               ← Removed duplicate theme code, clean routes
  src/index.css                             ← Smooth transitions, mobile fixes, utilities
  src/components/layout/Navbar.jsx          ← Dark mode toggle (Moon/Sun)
  src/components/layout/Sidebar.jsx         ← Dark mode toggle, accepts isDark prop
  src/pages/AdminPanel.jsx                  ← Wires theme toggle to Navbar + Sidebar
  src/components/catalogue/ItemTable.jsx    ← Skeleton rows/cards during load
  src/components/ui/PWAInstallPrompt.jsx    ← Full rewrite: iOS/Android/desktop, appinstalled
  vite.config.js                            ← host: true, chunk splitting

Unchanged:
  All Phase 1–6 files not listed above
  sync/ (entire sync tool unchanged)
```

---

## What's Done — Full Project Summary

| Phase | Status | What |
|---|---|---|
| 1 | ✅ | Scaffolding, Supabase schema, routing, design system |
| 2 | ✅ | Auth (admin + staff), Home page, route guards |
| 3 | ✅ | Staff catalogue — browse categories/tabs/items, search |
| 4 | ✅ | Admin catalogue — add/edit/delete items, tabs, categories |
| 5 | ✅ | Admin staff management — approve/reject, realtime |
| 6 | ✅ | Sync tool — CTk GUI, push/pull SQLite ↔ Supabase |
| 7 | ✅ | PWA polish, dark mode toggle, skeletons, Vercel deploy config |

PriceMaster is production-ready. 🎉
