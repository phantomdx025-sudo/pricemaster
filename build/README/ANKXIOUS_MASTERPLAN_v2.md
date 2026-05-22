# ANKxIOUS — Upgrade Masterplan v2
## Bug Fixes + Feature Expansion (Post AX-5)

> **This document is the single source of truth for all Claude sessions in this upgrade series.**
> Every session must read this file entirely before writing a single line of code.
> Never guess. Never invent. Match existing code quality, CSS variables, and patterns exactly.
> Current codebase baseline: `pricemaster_ax5_done.zip` (all phases AX-0 through AX-5 complete).

---

## Project State at Baseline

| Item | Detail |
|---|---|
| App name | ANKxIOUS (rebranded from PriceMaster in AX-1) |
| Framework | React 18 + Vite + Tailwind (class dark mode) |
| Backend | Supabase (Postgres + RLS + Edge Functions) |
| Auth | Supabase Auth for admin; custom bcrypt edge fn for staff |
| Styling | CSS variables in `src/index.css` — deep space dark + electric violet palette |
| Icons | `lucide-react@0.383.0` only |
| PDF | `jspdf` + `jspdf-autotable` |
| Routing | `react-router-dom` v6, admin lives at `/admin/*`, ledger at `/admin/financial/ledger/:partyType/:partyName` |
| PWA | Service worker + manifest in `public/` |
| Deploy | Vercel |

### Key Pages & Components
- `src/pages/AdminPanel.jsx` — shell with sidebar (desktop) + top tab bar (mobile)
- `src/pages/AdminFinancial.jsx` — financial party list with `FinDashboardCards` + `FinPartyList`
- `src/pages/AdminReports.jsx` — reports page with Overview / Period Breakdown / Payment Periods tabs
- `src/pages/AdminLedger.jsx` — full-screen single-party ledger at `/admin/financial/ledger/:type/:name`
- `src/pages/AdminSettings.jsx` — app settings (entity name)
- `src/components/financial/FinPaymentPeriodsTab.jsx` — payment periods tab component
- `src/components/financial/FinDashboardCards.jsx` — 4 summary cards (currently in AdminFinancial)
- `src/components/financial/FinPdfExport.jsx` — PDF generation
- `src/components/layout/Sidebar.jsx` — desktop sidebar (hidden on mobile with `md:hidden`)
- `src/hooks/useFinancialReports.js` — `fetchPeriodSummary`, `fetchCurrentOutstanding`, `fetchLastPayments`, `fetchOutstandingPerParty`

### Supabase Tables
- `fin_parties`, `fin_ledger`, `fin_outstanding`, `fin_address`, `fin_party_notes`, `fin_pinned`, `fin_sync_log`
- `fin_party_labels`, `fin_custom_labels`
- `app_settings` (AX-1: entity name)

---

## Overview of All Changes — 11 Bug Fixes / Features

| # | Ref | Description | Phase |
|---|---|---|---|
| 1 | BX-1 | "All Time" preset on Reports — no date filter, all 3 tabs | B6-1 |
| 2 | BX-2 | Party names tappable everywhere → opens their ledger | B6-1 |
| 3 | BX-3 | Filter + scroll position persistence when opening/closing ledger | B6-1 |
| 4 | BX-4 | Sales Overview card on Reports Overview tab | B6-1 |
| 5 | BX-5 | Mobile sidebar slide-in (hamburger), not top tab bar | B6-2 |
| 6 | BX-6 | PWA icons regenerated from user logo + splash animation on load | B6-2 |
| 7 | BX-7 | PDF outstanding breakdown hidden by default; toggle in settings | B6-2 |
| 8 | BX-8 | Multiple full colour themes in settings, persisted globally + for staff | B6-3 |
| 9 | BX-9 | Dashboard cards moved from Financial page → Reports Overview | B6-1 |
| 10 | BX-10 | Additional insight features on Reports page | B6-3 |
| 11 | BX-11 | Payment Periods: hide zero-balance parties by default | B6-1 |

---

## Phase B6-1 — Core Logic Fixes (Quick Wins)

**Session covers:** BX-1, BX-2, BX-3, BX-4, BX-9, BX-11

These are all pure logic / data flow changes. No new pages, no CSS theming. All fit in one session.

---

### BX-1 — "All Time" / "Not Specified" Preset on Reports

**What the user asked:** In the Reports page, add a preset called "Not Specified" which shows the entire data without date filters across all 3 tabs — Overview, Payment Periods, Period Breakdown.

**Where to change:** `src/pages/AdminReports.jsx`

**Exact change:**

1. Add `{ id: 'all_time', label: 'All Time' }` to the `PRESETS` array **before** `Custom`.

2. In `getPresetRange`, add a branch:
```js
if (preset === 'all_time') {
  return null // signal: no date filter
}
```

3. In `AdminReports` component state, add:
```js
const [isAllTime, setIsAllTime] = useState(false)
```

4. In `handlePresetChange`:
```js
if (p === 'all_time') {
  setIsAllTime(true)
  setPreset('all_time')
  return
}
setIsAllTime(false)
// ... existing logic
```

5. In `handleFromChange` / `handleToChange`, always set `setIsAllTime(false)`.

6. In `handleApply`, call a different fetch path when `isAllTime`:
```js
function handleApply() {
  if (isAllTime) {
    loadAllTime()
  } else {
    load(from, to)
  }
}
```

7. Add `loadAllTime` function that calls `fetchPeriodSummary` with **no date filter**. Add a new hook method `fetchAllLedger()` to `useFinancialReports.js`:
```js
const fetchAllLedger = useCallback(async () => {
  const { data, error } = await supabase
    .from('fin_ledger')
    .select('party_name, party_type, txn_date, debit, credit, vch_type, vch_no, balance')
    .order('txn_date', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw new Error(error.message)
  const rows = data ?? []
  return {
    debtorRows:   rows.filter(r => r.party_type === 'debtor'),
    creditorRows: rows.filter(r => r.party_type === 'creditor'),
  }
}, [])
```
Return it from `useFinancialReports`.

8. Pass `isAllTime` as prop to `FinPaymentPeriodsTab`. In that component, when `isAllTime=true`, the payment periods tab already fetches its own data (all-time by nature since it's based on outstanding + last payment, not date range) — so Payment Periods tab requires **no change** for all-time. Just hide the date inputs in `PeriodSelector` when preset is `all_time`:
```jsx
{preset !== 'all_time' && (
  <div className="flex items-center gap-3 ...">
    {/* date inputs */}
  </div>
)}
```

9. When `isAllTime` is true, show a small badge below the period selector: `"Showing all data — no date filter applied"`.

**Files to modify:**
- `src/pages/AdminReports.jsx`
- `src/hooks/useFinancialReports.js` — add `fetchAllLedger`

---

### BX-2 — Party Names Open Their Ledger

**What the user asked:** Everywhere in any page where party names are shown — in creditors OR debtors — tapping the name should open their ledger.

**Where party names appear (all must be wired):**

| Component / Page | Context | Action |
|---|---|---|
| `AdminReports.jsx` → `PeriodBreakdownTab` | desktop table `td`, mobile card `p` | navigate to ledger |
| `AdminReports.jsx` → `OverviewTab` | none currently shown — N/A | — |
| `FinPaymentPeriodsTab.jsx` | party card `p.party_name`, desktop table `td` | navigate to ledger |
| `AdminFinancial.jsx` → `FinPartyList` → `FinPartyCard` | party card — already does `onPartyClick` which navigates | already works |
| `AdminLedger.jsx` | shows single party — no other names | N/A |

**Exact change — PeriodBreakdownTab (inside AdminReports.jsx):**

The `PeriodBreakdownTab` component needs access to `useNavigate`. Currently it's a pure UI component. Add:

```js
import { useNavigate } from 'react-router-dom'

function PeriodBreakdownTab({ debtorRows, creditorRows, loading }) {
  const navigate = useNavigate()
  
  function goToLedger(partyName) {
    // Need to know partyType — derive from current tab state
    const type = tab === 'debtors' ? 'debtor' : 'creditor'
    navigate(`/admin/financial/ledger/${type}/${encodeURIComponent(partyName)}`)
  }
  // ...
```

In the desktop table's party name `<td>`:
```jsx
<td style={tdLeftStyle}>
  <button
    onClick={() => goToLedger(p.party_name)}
    className="font-medium text-left hover:underline transition-colors"
    style={{ color: 'var(--brand)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
  >
    {p.party_name}
  </button>
</td>
```

In the mobile card's party name:
```jsx
<button
  onClick={() => goToLedger(p.party_name)}
  className="text-sm font-medium mb-2 text-left w-full hover:underline"
  style={{ color: 'var(--brand)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
>
  {p.party_name}
</button>
```

**Exact change — FinPaymentPeriodsTab.jsx:**

Import `useNavigate`. Add `navigate` hook. Wire party name in card and desktop table exactly as above (with correct partyType coming from the existing `partyType` state in that component which is already `'debtor'` or `'creditor'`).

**Files to modify:**
- `src/pages/AdminReports.jsx` — PeriodBreakdownTab
- `src/components/financial/FinPaymentPeriodsTab.jsx`

---

### BX-3 — Filter + Scroll Position Persistence

**What the user asked:** When you open a ledger from any list page and then go back, the filters and scroll position should be exactly where they were. Currently everything resets.

**Current behaviour:** `AdminFinancial.jsx` mounts fresh on every navigation. State is lost.

**Strategy:** Use `sessionStorage` to persist filter state + scroll position. Key by page identity (`'financial_list'`). Restore on mount, save on unmount + on every filter/scroll change.

**What to persist for `AdminFinancial.jsx`:**
- `activeTab` — `'debtors'` or `'creditors'`
- `filterState` — search query, sort, label filter, pin filter (all from `FinPartyList`'s internal state)
- `scrollTop` — scroll position of the main content area

**Implementation approach:**

1. **Scroll persistence** — in `AdminFinancial.jsx`, the main scrollable container is `<main className="flex-1 flex flex-col min-w-0 min-h-0">`. Add a `ref` to it. On unmount, save `ref.current.scrollTop` to `sessionStorage.setItem('fin_scroll', value)`. On mount after a tick, restore: `ref.current.scrollTop = saved`.

2. **Tab persistence** — `AdminFinancial.jsx` already has `activeTab` state. Change `useState('debtors')` to:
```js
const [activeTab, setActiveTab] = useState(
  () => sessionStorage.getItem('fin_tab') ?? 'debtors'
)
```
On every `setActiveTab`, also call `sessionStorage.setItem('fin_tab', newTab)`.

3. **Filter state in FinPartyList** — `FinPartyList.jsx` holds all filter state internally. Lift this state up or use sessionStorage inside the component. The simplest surgical fix: inside `FinPartyList.jsx`, for each filter state:
```js
const [sort, setSort] = useState(
  () => sessionStorage.getItem('fin_sort') ?? 'name_asc'
)
const [labelFilter, setLabelFilter] = useState(
  () => sessionStorage.getItem('fin_label') ?? 'all'
)
const [pinFilter, setPinFilter] = useState(
  () => (sessionStorage.getItem('fin_pin') ?? 'false') === 'true'
)
const [searchQuery, setSearchQuery] = useState(
  () => sessionStorage.getItem('fin_search') ?? ''
)
```
Wrap each setter to also write to sessionStorage:
```js
function handleSort(val) { setSort(val); sessionStorage.setItem('fin_sort', val) }
function handleLabelFilter(val) { setLabelFilter(val); sessionStorage.setItem('fin_label', val) }
// etc.
```

4. **Scroll restoration** — in the AdminPanel body, the scrollable area is inside `<main>`. Add a `ref` to the content container in `AdminFinancial.jsx`:
```js
const containerRef = useRef(null)

useEffect(() => {
  // Restore scroll on mount
  const saved = sessionStorage.getItem('fin_scroll')
  if (saved && containerRef.current) {
    containerRef.current.scrollTop = parseInt(saved, 10)
  }
  return () => {
    // Save scroll on unmount
    if (containerRef.current) {
      sessionStorage.setItem('fin_scroll', String(containerRef.current.scrollTop))
    }
  }
}, [])
```
Apply `ref={containerRef}` to the outermost scrollable `div` inside `AdminFinancial.jsx`.

5. **Clear session on logout** — in `AdminPanel.jsx`, `handleLogout` already calls `logout()`. Add: `sessionStorage.clear()` before navigating away.

**Note:** `sessionStorage` is per-tab, clears on tab close — perfect for this use case. No privacy concerns since this is admin-only.

**Files to modify:**
- `src/pages/AdminFinancial.jsx`
- `src/components/financial/FinPartyList.jsx`
- `src/pages/AdminPanel.jsx` (add sessionStorage.clear() in logout)

---

### BX-4 — Sales Overview Card on Reports Overview Tab

**What the user asked:** In the Overview page of Reports, add a card called "Sales Overview" that shows the entire debit side of debtors added up — for the period selected.

**What this means technically:** Sum all `debit` values from `debtorRows` for the current period. This is already computed in `computeMetrics` as `totalTurnover`. But the user wants a dedicated card that makes it prominent and clearly named "Sales Overview".

**Exact change in `AdminReports.jsx`:**

In the `CARDS` array inside `OverviewTab`, add a new card entry:
```js
{
  icon: ShoppingBag,
  label: 'Sales Overview (Debtors Debit Side)',
  value: fmt(metrics.totalTurnover),
  sub: `${metrics.activeDebtors.toLocaleString('en-IN')} active debtors`,
  iconBg: 'var(--brand-light)',
  iconColor: 'var(--brand)',
},
```

Place it as the **first card** in the array so it's the most prominent. Rename the existing `'Total Turnover (Debtors Dr)'` card or merge — actually: keep the existing "Total Turnover" card but give the new "Sales Overview" card a more visual distinction — make it a **wide full-row card** by giving it a `fullRow: true` flag and rendering it separately above the grid:

```jsx
{/* Sales Overview — full-width featured card */}
<div
  className="rounded-xl p-4 flex items-center gap-4"
  style={{ background: 'var(--brand-light)', border: '1px solid var(--brand-border)' }}
>
  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
    style={{ background: 'var(--brand)' }}>
    <ShoppingBag size={18} style={{ color: 'var(--text-inverse)' }} />
  </div>
  <div className="flex-1 min-w-0">
    <p className="text-xs font-medium" style={{ color: 'var(--brand)' }}>Sales Overview</p>
    <p className="text-lg font-bold font-mono leading-tight" style={{ color: 'var(--text-primary)' }}>
      {fmt(metrics.totalTurnover)}
    </p>
    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
      Total debit side of debtors · {metrics.activeDebtors.toLocaleString('en-IN')} active parties
    </p>
  </div>
</div>
```

Render this full-width card above the existing metric grid.

**Files to modify:**
- `src/pages/AdminReports.jsx` — `OverviewTab` function

---

### BX-9 — Dashboard Cards: Move from Financial → Reports

**What the user asked:** The cards on the Financial page should show on the Reports page instead, not on the Financial page.

**Current state:** `AdminFinancial.jsx` renders `<FinDashboardCards>` with `debtors`, `creditors`, `syncLog` data. It shows Total Receivable, Total Payable, Outstanding Parties, Last Synced.

**What to do:**

1. **Remove** `<FinDashboardCards>` from `AdminFinancial.jsx`. Also remove the import. Do NOT remove the component file itself.

2. **Add** `FinDashboardCards` to `AdminReports.jsx` — render it at the top of the page content, **above** the period selector. It needs its own data: `debtors`, `creditors`, `syncLog` from `useFinancial()`. Add the hook to `AdminReports.jsx`:
```js
import { useFinancial } from '../hooks/useFinancial'

// inside the component:
const { debtors, creditors, syncLog, loading: finLoading, loadAll } = useFinancial()
useEffect(() => { loadAll() }, [loadAll])
```

3. Render:
```jsx
<FinDashboardCards
  debtors={debtors}
  creditors={creditors}
  syncLog={syncLog}
  loading={finLoading}
/>
```
Place it between the page header and the period selector.

**Files to modify:**
- `src/pages/AdminFinancial.jsx` — remove FinDashboardCards render + import
- `src/pages/AdminReports.jsx` — add FinDashboardCards + useFinancial hook

---

### BX-11 — Payment Periods: Hide Zero-Balance Parties by Default

**What the user asked:** In the Payment Periods tab, parties with ₹0 outstanding balance should not show by default (it doesn't make sense). But they can be revealed via the existing filters.

**Current state:** `FinPaymentPeriodsTab.jsx` has `OST_FILTER_OPTIONS` with `'all'` as default. All parties including zero-outstanding ones show by default.

**Exact change in `FinPaymentPeriodsTab.jsx`:**

Change the default value of the outstanding filter state from `'all'` to `'has'`:

```js
// BEFORE:
const [ostFilter, setOstFilter] = useState('all')

// AFTER:
const [ostFilter, setOstFilter] = useState('has')
```

This uses the existing `'has'` filter option which already correctly filters to only parties where `outstanding > 0`. The user can switch back to `'all'` using the existing filter dropdown whenever they need.

No new UI needed — the filter label will naturally show as active (`"Has outstanding"`) making it clear this is a filtered view.

**Files to modify:**
- `src/components/financial/FinPaymentPeriodsTab.jsx` — one line change

---

### Phase B6-1 Files Summary

**Modified:**
- `src/pages/AdminReports.jsx` — BX-1 (all-time preset), BX-4 (sales overview card), BX-9 (add FinDashboardCards)
- `src/hooks/useFinancialReports.js` — BX-1 (fetchAllLedger)
- `src/pages/AdminFinancial.jsx` — BX-3 (scroll/filter persistence), BX-9 (remove dashboard cards)
- `src/components/financial/FinPartyList.jsx` — BX-3 (filter state persistence)
- `src/components/financial/FinPaymentPeriodsTab.jsx` — BX-2 (party names clickable), BX-11 (default hide zero balance)
- `src/pages/AdminPanel.jsx` — BX-3 (sessionStorage.clear on logout)

**Not touched:** AdminLedger, AdminStaff, AdminSettings, AdminCatalogue, FinPdfExport, Sidebar, CSS/themes, manifest, icons.

**Supabase:** No migrations needed.

**Handoff:** Write `README/phase_b6_1_done.md`. Deliver zip.

---

## Phase B6-2 — Mobile Navigation + PWA + PDF Toggle

**Session covers:** BX-5, BX-6, BX-7

---

### BX-5 — Mobile Sidebar Slide-In (Hamburger)

**What the user asked:** On mobile, the top tab bar (5 items crammed horizontally) is too cluttered. Replace it with a proper slide-in sidebar from the left side — just like desktop but draggable/tappable open. Desktop behaviour unchanged.

**Current state:** Mobile has a `<header>` with logo + action buttons, then a `<div>` with 5 tab buttons horizontally (`md:hidden`). Desktop has `<Sidebar>` which is `hidden md:flex`.

**Target state:** Mobile gets a hamburger button in the header. Tapping it slides in a sidebar overlay from the left. The crammed top tab bar is removed entirely.

**Implementation:**

1. **Add state to `AdminPanel.jsx`:**
```js
const [mobileNavOpen, setMobileNavOpen] = useState(false)
```

2. **Replace the mobile tab bar `<div>` entirely** with a slide-in overlay:
```jsx
{/* Mobile slide-in sidebar overlay */}
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
      <div className="flex items-center justify-between px-4 py-4"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <img src="/icons/icon.svg" alt="ANKxIOUS" className="w-7 h-7" />
          <span className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            ANKxIOUS
          </span>
        </div>
        <button onClick={() => setMobileNavOpen(false)} style={{ color: 'var(--text-muted)' }}>
          <X size={18} />
        </button>
      </div>
      
      {/* Nav items — same as desktop sidebar */}
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
      <div className="px-2 py-3" style={{ borderTop: '1px solid var(--border)' }}>
        <button onClick={toggleTheme} className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-sm"
          style={{ color: 'var(--text-muted)' }}>
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </button>
        <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-sm"
          style={{ color: 'var(--error)' }}>
          <LogOut size={16} />
          Log Out
        </button>
      </div>
    </div>
  </div>
)}
```

3. **Add hamburger to the mobile header:**
```jsx
<button
  onClick={() => setMobileNavOpen(true)}
  className="p-2 rounded-xl"
  style={{ color: 'var(--text-muted)' }}
  aria-label="Open menu"
>
  <Menu size={20} />
</button>
```
Import `Menu, X` from lucide-react.

4. **Add slide-in animation to `src/index.css`:**
```css
@keyframes slide-in-left {
  from { transform: translateX(-100%); }
  to   { transform: translateX(0); }
}
.animate-slide-in-left {
  animation: slide-in-left 0.22s cubic-bezier(0.22, 1, 0.36, 1) both;
}
```

5. **Remove** the entire old `<div className="md:hidden flex border-b ...">` tab bar block.

6. **Keep** the `<header className="md:hidden ...">` block — just update it to include the hamburger button instead of no menu button.

**Files to modify:**
- `src/pages/AdminPanel.jsx`
- `src/index.css` — add slide-in animation

---

### BX-6 — PWA Icons + Splash Screen Animation

**What the user asked:** (a) The PWA icons still look wrong. Regenerate them from the proper ANKxIOUS logo. (b) Add a splash animation when the app loads — the logo animates in attractively.

**Note on user's provided image:** The attached PNG file (`Gemini_Generated_Image_tvf00btvf00btvf0.png`) appears to be empty/corrupt (0 bytes). The session must use the existing `public/icons/icon.svg` as the source for all PWA icons. Do NOT reference or use the broken uploaded file.

**Part A — Regenerate PNG icons from icon.svg:**

The existing `icon.svg` already has the correct ANKxIOUS "A" logo with space background and electric violet. The issue is the PNG files may have been generated from the old PriceMaster logo. Regenerate all sizes using a Node script:

```js
// scripts/gen-icons.mjs  (run once: node scripts/gen-icons.mjs)
import sharp from 'sharp'
import { readFileSync } from 'fs'

const svg = readFileSync('public/icons/icon.svg')
const sizes = [72, 96, 128, 144, 152, 192, 384, 512]
for (const size of sizes) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(`public/icons/icon-${size}.png`)
  console.log(`icon-${size}.png done`)
}
```

Include `sharp` as a devDependency in `package.json`. The session should run this script and include the generated PNGs in the output zip.

**Part B — Splash Screen / Logo Animation:**

Add a splash screen that shows for ~1.5 seconds on first load, then fades out.

Create `src/components/ui/SplashScreen.jsx`:

```jsx
/**
 * SplashScreen — shown for ~1.5s on app launch, then fades out.
 * Uses the ANKxIOUS logo SVG inline with CSS animation.
 */
import { useEffect, useState } from 'react'

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState('in') // 'in' | 'hold' | 'out'

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 600)
    const t2 = setTimeout(() => setPhase('out'), 1400)
    const t3 = setTimeout(() => onDone(), 1800)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '20px',
        background: 'var(--bg-base)',
        opacity: phase === 'out' ? 0 : 1,
        transition: phase === 'out' ? 'opacity 0.4s ease' : 'none',
        pointerEvents: phase === 'out' ? 'none' : 'auto',
      }}
    >
      {/* Animated logo */}
      <div
        style={{
          width: 80, height: 80,
          transform: phase === 'in' ? 'scale(0.6)' : 'scale(1)',
          opacity: phase === 'in' ? 0 : 1,
          transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease',
        }}
      >
        <img src="/icons/icon.svg" alt="ANKxIOUS" width="80" height="80" />
      </div>

      {/* App name */}
      <div
        style={{
          opacity: phase === 'in' ? 0 : 1,
          transform: phase === 'in' ? 'translateY(8px)' : 'translateY(0)',
          transition: 'opacity 0.4s ease 0.2s, transform 0.4s ease 0.2s',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-display, sans-serif)',
            fontWeight: 700, fontSize: '22px', letterSpacing: '0.08em',
            color: 'var(--text-primary)',
          }}
        >
          ANK<span style={{ color: 'var(--brand)' }}>x</span>IOUS
        </p>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Business Admin Panel
        </p>
      </div>

      {/* Pulsing ring */}
      <div
        style={{
          position: 'absolute',
          width: 120, height: 120,
          borderRadius: '50%',
          border: '1px solid var(--brand)',
          opacity: phase === 'hold' ? 0.3 : 0,
          transform: phase === 'hold' ? 'scale(1.6)' : 'scale(1)',
          transition: 'opacity 0.6s ease, transform 0.8s ease',
        }}
      />
    </div>
  )
}
```

Wire it in `src/main.jsx` or `src/App.jsx`:
```jsx
const [splashDone, setSplashDone] = useState(false)

return (
  <>
    {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
    {/* ... rest of app */}
  </>
)
```

Only show splash on true first load — check `sessionStorage.getItem('ax_splash_shown')`. If already shown (page reload within same session), skip. Set it after splash is done.

**Files to create:**
- `src/components/ui/SplashScreen.jsx`
- `scripts/gen-icons.mjs`

**Files to modify:**
- `src/App.jsx` — add splash screen
- `package.json` — add `sharp` devDependency

---

### BX-7 — PDF Outstanding Breakdown Toggle

**What the user asked:** The PDF always includes the outstanding breakdown table at the end. By default this should be hidden/removed. A toggle in Settings should let you enable it.

**Current state:** `FinPdfExport.jsx` always renders the outstanding breakdown table. `AdminSettings.jsx` only has the entity name setting.

**Implementation:**

**Step 1 — Settings toggle:**

In `AdminSettings.jsx`, add a toggle for "Include outstanding breakdown in PDF":

```jsx
{/* PDF Outstanding Breakdown toggle */}
<div className="card p-5 max-w-md mt-4" style={{ border: '1px solid var(--border)' }}>
  <div className="flex items-center justify-between gap-4">
    <div>
      <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
        PDF Outstanding Breakdown
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
        Include outstanding invoice breakdown table at end of PDF statements
      </p>
    </div>
    <button
      onClick={togglePdfBreakdown}
      className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors"
      style={{ background: pdfBreakdown ? 'var(--brand)' : 'var(--border-strong)' }}
      aria-checked={pdfBreakdown}
      role="switch"
    >
      <span
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
        style={{ transform: pdfBreakdown ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  </div>
</div>
```

The setting is stored in `app_settings` table (already exists) with key `'pdf_breakdown'`, value `'1'` or `'0'`. Add to `useAppSettings.js`:
```js
export async function fetchPdfBreakdownSetting() {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'pdf_breakdown')
    .single()
  return data?.value === '1'
}

export async function setPdfBreakdownSetting(enabled) {
  await supabaseAdmin
    .from('app_settings')
    .upsert({ key: 'pdf_breakdown', value: enabled ? '1' : '0' })
}
```

**Step 2 — Read setting before PDF generation:**

In `AdminLedger.jsx`, the `buildPDF` function calls `generatePartyPDF(...)`. Before calling it, fetch the setting:

```js
const pdfBreakdown = await fetchPdfBreakdownSetting()
const pdfBlob = await generatePartyPDF(
  partyData, ledgerRows, outstandingRows, addressData, entityName,
  { includeOutstandingBreakdown: pdfBreakdown }
)
```

**Step 3 — Honour the flag in FinPdfExport.jsx:**

`generatePartyPDF` signature changes to accept an options object:
```js
export async function generatePartyPDF(
  party, ledgerRows, outstandingRows, addressData, entityName,
  options = {}
) {
  const { includeOutstandingBreakdown = false } = options
  // ...
  // Only render outstanding section if flag is true:
  if (includeOutstandingBreakdown && outstandingRows.length > 0) {
    // ... existing outstanding table code
  }
}
```

Default is `false` — by default, PDF has no outstanding breakdown.

**Files to modify:**
- `src/pages/AdminSettings.jsx` — add toggle UI
- `src/hooks/useAppSettings.js` — add fetch/set for pdf_breakdown
- `src/pages/AdminLedger.jsx` — pass option to generatePartyPDF
- `src/components/financial/FinPdfExport.jsx` — accept + honour `includeOutstandingBreakdown` flag

**Supabase:** No migration needed — `app_settings` table already exists with upsert pattern.

---

### Phase B6-2 Files Summary

**Created:**
- `src/components/ui/SplashScreen.jsx`
- `scripts/gen-icons.mjs`

**Modified:**
- `src/pages/AdminPanel.jsx` — slide-in mobile nav
- `src/index.css` — slide-in animation
- `src/App.jsx` — splash screen integration
- `src/pages/AdminSettings.jsx` — PDF breakdown toggle
- `src/hooks/useAppSettings.js` — pdf_breakdown fetch/set
- `src/pages/AdminLedger.jsx` — pass includeOutstandingBreakdown
- `src/components/financial/FinPdfExport.jsx` — honour the flag
- `package.json` — sharp devDependency

**Not touched:** AdminFinancial, AdminReports, FinPaymentPeriodsTab, FinPartyList, theming/CSS variables, Supabase tables.

**Handoff:** Write `README/phase_b6_2_done.md`. Deliver zip with regenerated PNG icons.

---

## Phase B6-3 — Themes + Report Insights

**Session covers:** BX-8, BX-10

---

### BX-8 — Multiple Full Colour Themes

**What the user asked:** Add 3–4 more complete colour themes in Settings. When toggled in settings, it should change everywhere — including for staff users.

**Theme design — 4 total themes (existing + 3 new):**

| ID | Name | Personality |
|---|---|---|
| `space` | Space Dark *(current)* | Deep navy + electric violet — existing palette |
| `emerald` | Emerald Night | Dark green base + emerald accent |
| `rose` | Rose Dark | Dark warm base + rose/pink accent |
| `ocean` | Ocean Depth | Deep teal base + cyan accent |
| `amber` | Amber Classic | The original warm amber/cream light theme |

**CSS variables for each theme (add to `src/index.css`):**

```css
/* ── Emerald Night ── */
[data-theme="emerald"] {
  --bg-base:        #060e09;
  --bg-surface:     #0b1810;
  --bg-elevated:    #112118;
  --bg-overlay:     rgba(0,0,0,0.75);
  --text-primary:   #e6f5ea;
  --text-secondary: #7db88a;
  --text-muted:     #3e6648;
  --text-inverse:   #060e09;
  --brand:          #3ecf74;
  --brand-hover:    #5ddB8a;
  --brand-light:    #0f2a1a;
  --brand-border:   #1e4830;
  --border:         #142b1c;
  --border-strong:  #1e4228;
  --success:        #3ecf74;
  --success-light:  #0a2212;
  --error:          #e05c5c;
  --error-light:    #2a1010;
  --warning:        #f0a832;
  --warning-light:  #2a1e08;
  --shadow-sm:  0 1px 3px rgba(0,0,0,0.45);
  --shadow:     0 4px 12px rgba(0,0,0,0.55);
  --shadow-lg:  0 8px 32px rgba(0,0,0,0.65);
  --shadow-xl:  0 16px 48px rgba(0,0,0,0.72);
}

/* ── Rose Dark ── */
[data-theme="rose"] {
  --bg-base:        #0e0809;
  --bg-surface:     #1a0e10;
  --bg-elevated:    #231318;
  --bg-overlay:     rgba(0,0,0,0.75);
  --text-primary:   #f5e8ea;
  --text-secondary: #c48892;
  --text-muted:     #6e3840;
  --text-inverse:   #0e0809;
  --brand:          #f06884;
  --brand-hover:    #f585a0;
  --brand-light:    #2a1018;
  --brand-border:   #501828;
  --border:         #2e1218;
  --border-strong:  #481a24;
  --success:        #3ecf74;
  --success-light:  #0a2212;
  --error:          #e05c5c;
  --error-light:    #2a1010;
  --warning:        #f0a832;
  --warning-light:  #2a1e08;
  --shadow-sm:  0 1px 3px rgba(0,0,0,0.45);
  --shadow:     0 4px 12px rgba(0,0,0,0.55);
  --shadow-lg:  0 8px 32px rgba(0,0,0,0.65);
  --shadow-xl:  0 16px 48px rgba(0,0,0,0.72);
}

/* ── Ocean Depth ── */
[data-theme="ocean"] {
  --bg-base:        #020c10;
  --bg-surface:     #061520;
  --bg-elevated:    #0c2030;
  --bg-overlay:     rgba(0,0,0,0.75);
  --text-primary:   #e0f4fa;
  --text-secondary: #5aaccc;
  --text-muted:     #2a6880;
  --text-inverse:   #020c10;
  --brand:          #00d4ff;
  --brand-hover:    #22e0ff;
  --brand-light:    #052030;
  --brand-border:   #0a4060;
  --border:         #0c2840;
  --border-strong:  #1a4060;
  --success:        #3ecf74;
  --success-light:  #0a2212;
  --error:          #e05c5c;
  --error-light:    #2a1010;
  --warning:        #f0a832;
  --warning-light:  #2a1e08;
  --shadow-sm:  0 1px 3px rgba(0,0,0,0.45);
  --shadow:     0 4px 12px rgba(0,0,0,0.55);
  --shadow-lg:  0 8px 32px rgba(0,0,0,0.65);
  --shadow-xl:  0 16px 48px rgba(0,0,0,0.72);
}

/* ── Amber Classic (light) ── */
[data-theme="amber"] {
  --bg-base:        #fffbf5;
  --bg-surface:     #fef8ee;
  --bg-elevated:    #fdf3e3;
  --bg-overlay:     rgba(0,0,0,0.45);
  --text-primary:   #1a1208;
  --text-secondary: #6b4c1e;
  --text-muted:     #a8885a;
  --text-inverse:   #fffbf5;
  --brand:          #d4842a;
  --brand-hover:    #b8701e;
  --brand-light:    #faefd9;
  --brand-border:   #e8c890;
  --border:         #ead5a8;
  --border-strong:  #d4bc88;
  --success:        #2e8040;
  --success-light:  #e8f5ec;
  --error:          #c03030;
  --error-light:    #fdeaea;
  --warning:        #b87010;
  --warning-light:  #fef6e4;
  --shadow-sm:  0 1px 3px rgba(0,0,0,0.10);
  --shadow:     0 4px 12px rgba(0,0,0,0.12);
  --shadow-lg:  0 8px 32px rgba(0,0,0,0.15);
  --shadow-xl:  0 16px 48px rgba(0,0,0,0.18);
}
```

**Theme application strategy:**

Themes are applied via `data-theme` attribute on `<html>`. The `:root` and `.dark` blocks remain as the default `space` theme. All other themes override via `[data-theme="X"]`.

**Storage:** Theme preference is stored in `app_settings` table with key `'theme'`. This is what makes it global — ALL clients (admin + staff) read this setting and apply the theme on load.

Add to `useAppSettings.js`:
```js
export async function fetchTheme() {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'theme')
    .single()
  return data?.value ?? 'space'
}

export async function setTheme(themeId) {
  await supabaseAdmin
    .from('app_settings')
    .upsert({ key: 'theme', value: themeId })
}
```

**Apply theme on app load** — in `src/App.jsx` (or `src/main.jsx`), on mount:
```js
import { fetchTheme } from './hooks/useAppSettings'

useEffect(() => {
  fetchTheme().then(theme => {
    document.documentElement.setAttribute('data-theme', theme)
  })
}, [])
```

Staff also loads this on their page mount — so both admin and staff see the same theme.

**Theme picker UI in `AdminSettings.jsx`:**

```jsx
const THEMES = [
  { id: 'space',   name: 'Space Dark',     swatch: '#7c6ff7' },
  { id: 'emerald', name: 'Emerald Night',  swatch: '#3ecf74' },
  { id: 'rose',    name: 'Rose Dark',      swatch: '#f06884' },
  { id: 'ocean',   name: 'Ocean Depth',    swatch: '#00d4ff' },
  { id: 'amber',   name: 'Amber Classic',  swatch: '#d4842a' },
]

{/* Theme selector card */}
<div className="card p-5 max-w-md mt-4">
  <p className="font-medium text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Colour Theme</p>
  <div className="flex flex-wrap gap-3">
    {THEMES.map(t => (
      <button
        key={t.id}
        onClick={() => handleThemeChange(t.id)}
        className="flex flex-col items-center gap-1.5"
        style={{ minWidth: 56 }}
      >
        <div
          className="w-10 h-10 rounded-xl border-2 transition-all"
          style={{
            background: t.swatch,
            borderColor: activeTheme === t.id ? 'var(--text-primary)' : 'transparent',
            transform: activeTheme === t.id ? 'scale(1.15)' : 'scale(1)',
          }}
        />
        <span className="text-xs" style={{
          color: activeTheme === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
          fontWeight: activeTheme === t.id ? 600 : 400,
        }}>
          {t.name}
        </span>
      </button>
    ))}
  </div>
</div>
```

`handleThemeChange`:
```js
async function handleThemeChange(themeId) {
  setActiveTheme(themeId)
  document.documentElement.setAttribute('data-theme', themeId)
  try {
    await setTheme(themeId)
    toast.success('Theme updated for all users')
  } catch {
    toast.error('Failed to save theme')
  }
}
```

**Important — remove the dark mode toggle from Settings/Sidebar:** The `data-theme` system replaces the dark mode toggle for theming. The existing `pm_theme` dark/light localStorage toggle can remain for the `.dark` class (which now has minimal effect since all themes define their own palette), but the new theme picker is the primary control.

**FinPdfExport.jsx note:** The PDF uses hardcoded `C` RGB arrays and always renders on white. Themes don't affect PDF generation — intentional, PDFs must stay printable.

**Files to modify:**
- `src/index.css` — add all 4 new theme blocks
- `src/hooks/useAppSettings.js` — fetchTheme, setTheme
- `src/pages/AdminSettings.jsx` — theme picker UI
- `src/App.jsx` — apply theme on load

---

### BX-10 — Additional Report Insights

**What the user asked:** Add more related features on the Reports page that users might find useful for insights.

**Proposed additions (implement all):**

#### 10A — Top Debtors by Outstanding (Overview Tab)
A "Top 10 Debtors by Outstanding" expandable list at the bottom of the Overview tab. Shows the 10 parties with highest outstanding, their amount, and a mini bar. Tapping a name navigates to their ledger.

```jsx
function TopDebtorsList({ outstanding }) {
  // `outstanding` here needs per-party breakdown
  // fetch from fetchOutstandingPerParty('debtor') — already exists in the hook
  // Pass it as a prop from AdminReports after fetching
}
```

Add `fetchOutstandingPerParty` call to `AdminReports.jsx`'s `load()` function and store as `debtorOutstandingList` / `creditorOutstandingList` state. Show top 10 by outstanding descending.

#### 10B — Collection Efficiency Card (Overview Tab)
A card showing "Collection Efficiency" = (Receivable Collected / Total Turnover) × 100 as a percentage with a circular or linear progress indicator.

```jsx
// Already have: metrics.receivableCollected and metrics.totalTurnover
const efficiency = metrics.totalTurnover > 0
  ? Math.round((metrics.receivableCollected / metrics.totalTurnover) * 100)
  : 0
```

Render as a metric card with a progress bar:
```jsx
<div className="rounded-xl p-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Collection Efficiency</p>
  <p className="text-2xl font-bold mt-1" style={{ color: efficiency > 75 ? 'var(--success)' : efficiency > 50 ? 'var(--warning)' : 'var(--error)' }}>
    {efficiency}%
  </p>
  <div className="h-1.5 rounded-full mt-2" style={{ background: 'var(--border)' }}>
    <div className="h-1.5 rounded-full transition-all"
      style={{ width: `${efficiency}%`, background: efficiency > 75 ? 'var(--success)' : efficiency > 50 ? 'var(--warning)' : 'var(--error)' }} />
  </div>
  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
    {fmt(metrics.receivableCollected)} collected of {fmt(metrics.totalTurnover)} billed
  </p>
</div>
```

#### 10C — Creditor vs Debtor Balance Comparison (Overview Tab)
A simple visual comparison card: "Net Position" = Debtors Outstanding − Creditors Payable. Shows whether the business is net-receivable or net-payable overall.

```jsx
const netPosition = metrics.debtorOutstanding - metrics.creditorPayable
const isNetPositive = netPosition >= 0
```

#### 10D — Most Active Period (Period Breakdown Tab)
In `PeriodBreakdownTab`, below the table, add a "Most Active Month" callout — which month in the period had the highest transaction count (from the data already in `debtorRows`/`creditorRows`).

#### 10E — Export to CSV Button (Period Breakdown Tab)
Add a "Export CSV" button to the Period Breakdown tab that downloads the current visible breakdown as a `.csv` file. Client-side only using `Blob` and `URL.createObjectURL`. No new dependencies.

```js
function exportCSV(data, filename) {
  const headers = ['Party Name', 'Total Debited', 'Total Credited', 'Closing Balance', 'Txns']
  const rows = data.map(p => [
    p.party_name, p.totalDebit.toFixed(2), p.totalCredit.toFixed(2),
    (p.lastBalance ?? 0).toFixed(2), p.txnCount
  ])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
```

**Files to modify:**
- `src/pages/AdminReports.jsx` — add all 5 insight features

---

### Phase B6-3 Files Summary

**Modified:**
- `src/index.css` — 4 new theme variable blocks
- `src/hooks/useAppSettings.js` — fetchTheme, setTheme
- `src/pages/AdminSettings.jsx` — theme picker UI
- `src/App.jsx` — theme apply on load
- `src/pages/AdminReports.jsx` — all 5 insight additions

**Not touched:** AdminFinancial, AdminLedger, FinPdfExport (themes don't affect PDF), Supabase schema.

**Supabase:** No migration. `app_settings` table already exists. Theme stored as `key='theme'`, PDF breakdown as `key='pdf_breakdown'`.

**Handoff:** Write `README/phase_b6_3_done.md`. Deliver zip.

---

## Cross-Phase Rules (Every Session Must Follow)

Carry forward ALL rules from `ANKXIOUS_MASTERPLAN_v1.md`:

1. **Never break existing features** — Catalogue, Staff, existing sync tool Python files, all existing hooks — untouched unless listed in "Files to Modify" for the current phase.
2. **CSS / Styling** — all colours via CSS variables only. No hardcoded hex in JSX. Exception: `FinPdfExport.jsx` (jsPDF can't read CSS vars — intentional).
3. **Amount formatting** — `const fmt = (n) => \`₹${Math.abs(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}\``
4. **Loading states** — `Spinner.jsx` for full-area, `Skeleton.jsx` for lists.
5. **Error states** — `toast` from `src/components/ui/Toast.jsx`.
6. **Mobile first** — 375px minimum width. Touch targets 44px minimum height. No horizontal overflow.
7. **Supabase client** — `supabase` for public reads, `supabaseAdmin` for admin writes.
8. **File naming** — React: PascalCase `.jsx`. Hooks: camelCase `useXxx.js`.
9. **No console.log in production** — use `if (import.meta.env.DEV) console.log(...)`.
10. **Screen real estate discipline** — no new persistent UI that clutters. Every addition collapsible or on its own section.
11. **Labels survive sync** — `fin_party_labels`, `fin_custom_labels` never touched by sync tool.

---

## Supabase Changes Summary

| Phase | Change | Table | Details |
|---|---|---|---|
| B6-1 | None | — | No schema changes |
| B6-2 | New settings keys | `app_settings` | `pdf_breakdown` key (upsert, no migration needed) |
| B6-3 | New settings key | `app_settings` | `theme` key (upsert, no migration needed) |

All use the existing `app_settings` table's upsert pattern. No `ALTER TABLE` or new tables needed.

---

## Session Handoff — Required Files Every Time

| File | Every Session | Notes |
|---|---|---|
| Current project zip | ✅ Always | Output of immediately preceding phase |
| This masterplan (`ANKXIOUS_MASTERPLAN_v2.md`) | ✅ Always | Single source of truth |
| `README/phase_b6_{N}_done.md` (most recent) | ✅ Always | What was built and what to know |
| `ANKXIOUS_MASTERPLAN_v1.md` | Optional | For context on original phases if needed |

---

## Opening Prompt Template

```
I am building Phase B6-{N} of the ANKxIOUS upgrade.

Attached:
1. [zip] — current project state (output of Phase B6-{N-1} or AX-5 for first session)
2. ANKXIOUS_MASTERPLAN_v2.md — this master plan
3. phase_b6_{N-1}_done.md — what was built last phase (or phase_ax5_done.md for B6-1)

Please read all files, then build Phase B6-{N} exactly as specified in the masterplan.
Deliver a zip of the updated project + README/phase_b6_{N}_done.md inside it.
```

---

## Phase README Format (Every Session Must Write)

Each `phase_b6_{N}_done.md` must include:
- What was built (component-level detail, per BX-N fix)
- Files created (with paths)
- Files modified (with exact changes described)
- Files NOT changed
- Any non-obvious decisions made and why
- What the next phase must know
- Any Supabase setup steps needed

---

## Handoff Checklist (Before Ending Each Session)

- [ ] All new files created at correct paths
- [ ] Modified files changed minimally and correctly
- [ ] `README/phase_b6_{N}_done.md` written with full detail
- [ ] This masterplan copied into zip as `README/ANKXIOUS_MASTERPLAN_v2.md`
- [ ] Zip delivered to user
- [ ] No `console.log` left in production code
- [ ] No hardcoded colours in JSX (exception: FinPdfExport.jsx)
- [ ] All themes tested mentally in dark AND light contexts
- [ ] Mobile layout tested mentally (375px)
- [ ] No invented Supabase table names — only tables defined in this document or v1 masterplan

---

## Phase Quick Reference

| Phase | Code | Covers | Key Deliverables |
|---|---|---|---|
| 1 | B6-1 | BX-1,2,3,4,9,11 | All-time preset; tappable party names; filter persistence; sales card; dashboard cards move; hide zero balance |
| 2 | B6-2 | BX-5,6,7 | Mobile slide sidebar; PWA splash animation; PDF breakdown toggle |
| 3 | B6-3 | BX-8,10 | 5 colour themes; 5 new report insights + CSV export |

---

## Pre-Session Understanding Check (For User's Reference)

Before the user hands off this plan to a Claude session, here is what each fix means in plain terms — to cross-check mutual understanding:

**BX-1:** A new "All Time" pill button on the Reports page that bypasses the date pickers entirely and loads ALL ledger data — so Overview shows all-time totals, Period Breakdown shows all parties ever, Payment Periods shows all parties too. When "All Time" is selected, the date input fields are hidden.

**BX-2:** Every party name shown as text anywhere in the app — in the Period Breakdown table, in the Payment Periods list — becomes a tappable link (styled in brand colour with underline on hover) that navigates to `/admin/financial/ledger/[type]/[name]`. The Financial page's party list already does this via `onPartyClick`.

**BX-3:** When you're on the Financial page with filters set (e.g. sorted by outstanding, label filter = "follow up", scrolled halfway down), and you tap a party name to open their ledger, then press Back — you land back on the Financial page with the exact same filters, sort, and scroll position. This is achieved via `sessionStorage` — it survives React navigation but clears when you close the tab/browser.

**BX-4:** On the Reports → Overview tab, add a prominent wide card at the top called "Sales Overview" that shows the sum of all debit entries on the debtors ledger for the selected period, with a count of how many parties were active. This is the "money billed to customers" figure.

**BX-5:** On mobile, the cramped 5-button tab bar at the top is replaced by a hamburger (≡) icon in the header. Tapping it slides in a full sidebar from the left with proper nav items, theme toggle, and logout — exactly like desktop but as an overlay. Tapping the overlay or any nav item closes it.

**BX-6:** The app's PWA icons (the icons shown on home screen when you install the app) are regenerated from the existing ANKxIOUS SVG logo. Additionally, when the app first opens in a browser session, an animated splash screen shows for ~1.5 seconds — the logo scales in with a spring animation, the name fades in below it, then it fades out smoothly.

**BX-7:** When generating a PDF statement for any party, the "Outstanding Breakdown" table at the end (which shows individual unpaid invoices) is hidden by default. In Settings, there's a toggle "Include Outstanding Breakdown in PDF" which is OFF by default. Turning it ON makes all subsequent PDFs include the table again.

**BX-8:** In Settings, there's a theme picker showing 5 colour swatches: Space Dark (current), Emerald Night, Rose Dark, Ocean Depth, Amber Classic. Selecting one changes the entire app's colour palette immediately — AND saves it to the database so that any staff member or other admin session also sees the new theme on their next load.

**BX-9:** The 4 summary cards (Total Receivable, Total Payable, Outstanding Parties, Last Synced) currently appear at the top of the Financial page. They are moved to the top of the Reports page instead. The Financial page no longer shows these cards.

**BX-10:** Five additional insight features on the Reports page: (a) top 10 debtors by outstanding shown as a list with mini bar chart, (b) collection efficiency percentage with progress bar, (c) net position card (debtors outstanding minus creditors payable), (d) most active month callout in Period Breakdown tab, (e) Export CSV button in Period Breakdown.

**BX-11:** On the Payment Periods tab, parties with ₹0 outstanding are now hidden by default (the "Outstanding" filter defaults to "Has outstanding" instead of "All"). The existing filter dropdown still lets the user switch to "All" to see zero-balance parties when needed.

---

*Masterplan v2.0 — written after full review of pricemaster_ax5_done.zip, ANKXIOUS_MASTERPLAN_v1.md, and FINANCIAL_REPORTS_MASTERPLAN.md.*
*Place this file at `README/ANKXIOUS_MASTERPLAN_v2.md` inside every project zip going forward.*
