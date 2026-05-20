# Phase B6-2 — Mobile Navigation + PWA + PDF Toggle (Done)

**Baseline:** `pricemaster_b6_1_done.zip` (B6-1 complete — BX-1,2,3,4,9,11 done)
**Covers:** BX-5, BX-6, BX-7

---

## What Was Built

### BX-5 — Mobile Sidebar Slide-In (Hamburger)

**Problem:** The old mobile UI had a cramped 5-button horizontal tab bar below the header — all 5 nav items squashed side-by-side at small widths.

**Solution:** Replaced the top tab bar entirely with a slide-in sidebar overlay, triggered by a hamburger (≡) button added to the left side of the mobile header.

**Implementation details:**
- Added `mobileNavOpen` boolean state to `AdminPanel.jsx`.
- Imported `Menu, X` from `lucide-react`.
- The old `<div className="md:hidden flex border-b ...">` tab bar block was **removed entirely**.
- A new `{mobileNavOpen && <div className="md:hidden fixed inset-0 z-50 ...">}` overlay renders when open:
  - Clicking the backdrop (outer div) closes it via `onClick={() => setMobileNavOpen(false)}`.
  - Inner sidebar panel uses `onClick={e => e.stopPropagation()}` so clicks inside don't bubble to the backdrop.
  - The `w-64` panel has a brand header (icon.svg + "ANKxIOUS" text + X close button), nav items list, and a bottom section with theme toggle + logout.
  - Nav items exactly match desktop sidebar: same `NAV_ITEMS` array, same active highlight pattern (`var(--brand)` text + `var(--brand-light)` background).
  - Selecting a nav item calls `setActiveSection(item.id); setMobileNavOpen(false)` — closes sidebar automatically.
- Added hamburger `<button>` to the left of the logo in the mobile `<header>`.
- Added `@keyframes slide-in-left` and `.animate-slide-in-left` to `src/index.css`. Animation uses `cubic-bezier(0.22, 1, 0.36, 1)` for a snappy deceleration feel. Duration: 0.22s.
- Desktop behaviour is completely unchanged — `Sidebar` component still renders for `md:` and up.

### BX-6 — PWA Icons Regenerated + Splash Screen

**Part A — Icons regenerated:**
- `scripts/gen-icons.mjs` (already existed from an earlier draft but now properly written) reads `public/icons/icon.svg` and outputs all 8 PNG sizes: 72, 96, 128, 144, 152, 192, 384, 512.
- `sharp` added as a devDependency in `package.json`.
- The script was **actually run** during this session — all PNG files in `public/icons/` are fresh regenerations from the current ANKxIOUS `icon.svg`.
- Note from masterplan: an attached PNG was noted as potentially corrupt/0-bytes in the masterplan spec. The script uses `icon.svg` as the source as instructed.

**Part B — Splash screen:**
- Created `src/components/ui/SplashScreen.jsx`.
- Three animation phases: `'in'` (0–600ms) → `'hold'` (600–1400ms) → `'out'` (1400–1800ms).
  - `'in'`: logo scales from 0.6 → 1 with spring cubic-bezier (0.34, 1.56, 0.64, 1), name fades in with 200ms delay.
  - `'hold'`: logo and name are fully visible. A pulsing ring (border: 1px solid `var(--brand)`) expands from scale(1) → scale(1.6) with 0.3 opacity.
  - `'out'`: entire splash container fades to opacity 0 over 400ms, then `onDone()` fires.
- All colours use CSS variables — respects light/dark theme automatically.
- On `onDone()`, sets `sessionStorage.setItem('ax_splash_shown', '1')` to skip splash on subsequent page navigations within the same tab session.
- Wired in `src/App.jsx`:
  - `shouldShowSplash()` checks `sessionStorage.getItem('ax_splash_shown')` — returns true only on first load.
  - `useState(() => !shouldShowSplash())` initialises `splashDone` — already true if splash was shown before.
  - `{!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}` renders the splash **outside** `<BrowserRouter>` (above it) so it doesn't interfere with routing.

### BX-7 — PDF Outstanding Breakdown Toggle

**Problem:** Every PDF statement always included the outstanding invoices table at the end. This is noisy for clean statements. Should be opt-in.

**Solution:** New setting stored in `app_settings` table (key `pdf_breakdown`, value `'1'`/`'0'`). Default is OFF (breakdown hidden). Toggle in Settings page.

**Implementation details:**

**`src/hooks/useAppSettings.js`** — appended two new exported functions:
- `fetchPdfBreakdownSetting()`: reads `app_settings` where `key = 'pdf_breakdown'`, returns `true` if value is `'1'`. Returns `false` as default if key doesn't exist yet (graceful first-run behaviour). Uses `supabase` (anon read — settings are readable without auth).
- `setPdfBreakdownSetting(enabled)`: upserts `{ key: 'pdf_breakdown', value: '1'|'0' }` with `onConflict: 'key'`. Uses `supabase` (same pattern as `setEntityName` — anon client with RLS allowing authenticated upsert).

**`src/pages/AdminSettings.jsx`** — added a second settings card below the Entity Name card:
- Imports `fetchPdfBreakdownSetting, setPdfBreakdownSetting` from `useAppSettings`.
- `pdfBreakdown` boolean state, loaded on mount via `useEffect`.
- `togglePdfBreakdown()` function: optimistically updates local state, calls `setPdfBreakdownSetting(next)`, shows toast success/error, reverts on failure.
- Toggle UI: a pill-style `role="switch"` button (w-11 h-6, white knob, brand colour when on, border-strong when off). Dynamic subtitle text: "Included at end of PDF" vs "Hidden by default — enable to include in PDFs".
- Loading state shows an animated skeleton while fetching the current value.

**`src/components/financial/FinPdfExport.jsx`** — `generatePartyPDF` function signature updated:
- Added `options = {}` sixth parameter.
- Destructures `{ includeOutstandingBreakdown = false }` from options. Default is `false`.
- The outstanding invoices `if (outstandingRows.length > 0) {` block now reads `if (includeOutstandingBreakdown && outstandingRows.length > 0) {`.

**`src/pages/AdminLedger.jsx`** — `buildPDF` updated:
- Imports `fetchPdfBreakdownSetting` from `useAppSettings`.
- Fetches the setting in parallel with ledger/outstanding/contact via `Promise.all`.
- Passes `{ includeOutstandingBreakdown: pdfBreakdown }` as the options arg to `generatePartyPDF`.

**Supabase:** No migration needed. `app_settings` table already exists with `key` (unique), `value` columns. First time the toggle is used it upserts the row. First PDF before setting is saved uses the default (`false`), which is the correct behaviour.

---

## Files Created

| File | Purpose |
|---|---|
| `src/components/ui/SplashScreen.jsx` | BX-6: Animated splash screen component |
| `scripts/gen-icons.mjs` | BX-6: Node script to regenerate PWA PNGs from icon.svg |
| `README/phase_b6_2_done.md` | This file |
| `README/ANKXIOUS_MASTERPLAN_v2.md` | Masterplan copied into zip |

## Files Modified

| File | Changes |
|---|---|
| `src/pages/AdminPanel.jsx` | BX-5: removed tab bar, added hamburger + slide-in sidebar overlay, imported Menu/X |
| `src/index.css` | BX-5: added `@keyframes slide-in-left` + `.animate-slide-in-left` utility |
| `src/App.jsx` | BX-6: added SplashScreen import, `shouldShowSplash()`, `splashDone` state, renders `<SplashScreen>` before `<BrowserRouter>` |
| `src/hooks/useAppSettings.js` | BX-7: appended `fetchPdfBreakdownSetting` + `setPdfBreakdownSetting` |
| `src/pages/AdminSettings.jsx` | BX-7: added PDF settings card with toggle UI |
| `src/pages/AdminLedger.jsx` | BX-7: import `fetchPdfBreakdownSetting`, fetch in parallel, pass options to generatePartyPDF |
| `src/components/financial/FinPdfExport.jsx` | BX-7: added `options` param to `generatePartyPDF`, guard outstanding section with `includeOutstandingBreakdown` flag |
| `package.json` | BX-6: added `sharp` as devDependency |
| `public/icons/icon-{72,96,128,144,152,192,384,512}.png` | BX-6: regenerated from icon.svg via gen-icons.mjs |

## Files NOT Changed

AdminFinancial, AdminReports, AdminStaff, AdminCatalogue, AdminLedger (structure/JSX — only imports + buildPDF changed),
FinPaymentPeriodsTab, FinPartyList, FinDashboardCards, FinLedgerTab, FinOutstandingTab, FinContactTab, FinInsightsTab,
Sidebar, Navbar, all other UI components, all hooks except useAppSettings,
tailwind.config.js, vite.config.js, postcss.config.js, public/manifest.json, public/sw.js, public/icons/icon.svg,
supabase/*, .gitignore, .env.example.

---

## Non-Obvious Decisions

**BX-5 — Hamburger position:** Placed hamburger to the LEFT of the logo in the mobile header (not the right). This follows the universal convention (hamburger = left = menu) and avoids fighting with action buttons on the right (search, theme toggle, logout).

**BX-5 — Logout stays in header on mobile:** The mobile header still has the logout button on the right side, even though logout is also in the slide-in sidebar. This is intentional — it's a common pattern on mobile apps (quick logout without opening the menu). Both work correctly and both call `handleLogout`.

**BX-6 — Splash outside BrowserRouter:** `<SplashScreen>` is rendered before `<BrowserRouter>` in App.jsx. This avoids any routing race conditions — the splash runs purely as a timed overlay, then `BrowserRouter` routes normally underneath once `splashDone = true`.

**BX-6 — sessionStorage for splash guard:** Using `sessionStorage` (not `localStorage`) means the splash shows once per browser tab session. Opening a new tab shows the splash again. Reloading the same tab (e.g. hard refresh) within the same session does NOT show it again. This matches the masterplan spec.

**BX-7 — Default false without DB row:** If the `pdf_breakdown` key has never been set in `app_settings`, `fetchPdfBreakdownSetting()` returns `false` via the `data?.value === '1'` check. This means newly deployed instances correctly default to hiding the breakdown, without needing any seed SQL.

**BX-7 — supabase (not supabaseAdmin) for upsert:** `setPdfBreakdownSetting` uses the regular `supabase` client, matching the existing `setEntityName` pattern in `useAppSettings.js`. The file explicitly notes that `supabaseAdmin` uses Deno.env and is browser-incompatible — so anon client with RLS is the correct approach throughout.

---

## What Next Phase (B6-3) Must Know

- All B6-2 changes are stable and work with the B6-1 foundation.
- `sessionStorage` key added by B6-2: `ax_splash_shown`. Do not reuse this key.
- `app_settings` keys now in use: `entity_name` (AX-1), `pdf_breakdown` (BX-7). B6-3 will add `theme` (BX-8).
- `FinPdfExport.generatePartyPDF` now takes a 6th `options` parameter — any callers added in B6-3 should pass it too.
- `src/App.jsx` now renders `<SplashScreen>` — B6-3 should not reorganise the top-level App structure.

## Supabase Setup

No migrations needed. `app_settings` table must exist (created in AX-1). The `pdf_breakdown` key is created on first save via upsert — no SQL needed.
