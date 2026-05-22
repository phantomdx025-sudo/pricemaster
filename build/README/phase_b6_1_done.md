# Phase B6-1 — Core Logic Fixes (Done)

**Baseline:** `pricemaster_ax5_done.zip` (AX-0 through AX-5 complete)
**Covers:** BX-1, BX-2, BX-3, BX-4, BX-9, BX-11

---

## What Was Built

### BX-1 — "All Time" Preset on Reports

- Added `{ id: 'all_time', label: 'All Time' }` to the `PRESETS` array in `AdminReports.jsx` (placed between Last FY and Custom).
- `getPresetRange('all_time')` returns `null` — signal for no date filter.
- Added `isAllTime` boolean state to `AdminReports`. When "All Time" is selected, `isAllTime` is set `true`.
- `handlePresetChange` short-circuits for `'all_time'` and sets `isAllTime=true` without touching date inputs.
- `handleFromChange` / `handleToChange` both reset `isAllTime=false` (switching away from All Time when user edits dates).
- `handleApply` routes to `loadAllTime()` when `isAllTime` is true, otherwise `load(from, to)`.
- `loadAllTime()` calls the new `fetchAllLedger()` hook (no date filter) + `fetchCurrentOutstanding()`.
- `PeriodSelector` hides the date inputs entirely when `isAllTime=true`.
- `PeriodSelector` shows an info badge "Showing all data — no date filter applied" when `isAllTime=true`.
- Added `fetchAllLedger()` to `useFinancialReports.js` — fetches all `fin_ledger` rows ordered by `txn_date`, returns `{ debtorRows, creditorRows }`.

### BX-2 — Tappable Party Names → Ledger

Party names now navigate to their ledger in two components:

**PeriodBreakdownTab (inside AdminReports.jsx):**
- Added `useNavigate` from `react-router-dom`.
- Added `goToLedger(partyName)` function that derives `partyType` from the current tab state and calls `navigate('/admin/financial/ledger/${type}/${encodeURIComponent(name)}')`.
- Desktop table: party name `<td>` now contains a `<button>` styled with `color: var(--brand)`, `hover:underline`, no background/border — visually distinct as a link.
- Mobile card: party name `<p>` replaced with a styled `<button>` with same approach.

**FinPaymentPeriodsTab.jsx:**
- Added `import { useNavigate } from 'react-router-dom'`.
- Added `const navigate = useNavigate()` in main component.
- Desktop table: same `<button>` pattern with `navigate(...)` using the existing `partyType` state.
- `PartyCard` (mobile): now accepts `onNameClick` prop. Party name `<p>` replaced with a `<button>` that calls `onNameClick(entry.party_name)`. The caller passes the navigate closure.

### BX-3 — Filter + Scroll Position Persistence

**AdminFinancial.jsx:**
- Added `useRef` to imports.
- `activeTab` state initialises from `sessionStorage.getItem('fin_tab') ?? 'debtors'`.
- `handleSetActiveTab(val)` wrapper sets state AND `sessionStorage.setItem('fin_tab', val)`. All tab button `onClick` handlers use this wrapper.
- Added `containerRef = useRef(null)` and a `useEffect` that:
  - On mount: restores `containerRef.current.scrollTop` from `sessionStorage.getItem('fin_scroll')`.
  - On unmount (cleanup): saves `containerRef.current.scrollTop` to `sessionStorage.setItem('fin_scroll', ...)`.
- `ref={containerRef}` applied to the outermost scrollable `div`.

**FinPartyList.jsx:**
- All five filter states (`sort`, `filter`, `labelFilter`, `stateFilter`, `hideSettled`) now initialise from `sessionStorage` with sensible defaults.
- Handler wrappers created for each: `handleSort`, `handleFilter`, `handleLabelFilter`, `handleStateFilter`, `handleHideSettled` — each calls the state setter AND writes to sessionStorage.
- All `onChange` / `onClick` handlers in the UI now call the handler wrappers instead of raw setters.
- The `useEffect` that resets `labelFilter` on `partyType` change now calls `handleLabelFilter('__all__')` (persists the reset too).

**AdminPanel.jsx:**
- `handleLogout` calls `sessionStorage.clear()` before `await logout()` — clears all persisted filter/scroll state on sign-out.

### BX-4 — Sales Overview Featured Card

**AdminReports.jsx — OverviewTab:**
- Added a full-width featured card rendered **above** the metric grid.
- Styled with `background: var(--brand-light)`, `border: 1px solid var(--brand-border)`.
- Left icon: `ShoppingBag` in a `var(--brand)`-background rounded square.
- Shows `fmt(metrics.totalTurnover)` — total debit side of debtors for the selected period.
- Subtitle: "Total debit side of debtors · {N} active parties".
- Loading skeleton: a single full-width placeholder above the grid skeletons.

### BX-9 — Dashboard Cards Moved to Reports

**AdminFinancial.jsx:**
- Removed `import FinDashboardCards` line.
- Removed the `<FinDashboardCards>` render block (the "Dashboard cards" section). The component file itself is untouched.

**AdminReports.jsx:**
- Added `import { useFinancial } from '../hooks/useFinancial'`.
- Added `import FinDashboardCards from '../components/financial/FinDashboardCards'`.
- Destructures `{ debtors, creditors, syncLog, loading: finLoading, loadAll: loadFinancial }` from `useFinancial()`.
- `useEffect(() => { loadFinancial() }, [loadFinancial])` triggers on mount.
- `<FinDashboardCards>` rendered between the page header and the period selector, with `loading={finLoading}`.

### BX-11 — Payment Periods: Hide Zero-Balance by Default

**FinPaymentPeriodsTab.jsx:**
- Changed `useState('all')` → `useState('has')` for `ostFilter`.
- No other changes needed — the existing `'has'` filter logic (`list.filter(e => e.outstanding > 0)`) already handles this correctly.
- The filter dropdown will show "Has outstanding" as the active selection, making it clear to the user this is a filtered view. They can switch to "All" to see zero-balance parties.

---

## Files Created

- `README/phase_b6_1_done.md` — this file
- `README/ANKXIOUS_MASTERPLAN_v2.md` — masterplan copied into zip

## Files Modified

| File | Changes |
|---|---|
| `src/hooks/useFinancialReports.js` | Added `fetchAllLedger()` function + returned from hook |
| `src/pages/AdminReports.jsx` | BX-1 all-time preset; BX-2 party names clickable in PeriodBreakdownTab; BX-4 Sales Overview featured card; BX-9 FinDashboardCards + useFinancial |
| `src/pages/AdminFinancial.jsx` | BX-3 scroll + tab persistence; BX-9 removed FinDashboardCards |
| `src/components/financial/FinPartyList.jsx` | BX-3 filter state persistence via sessionStorage |
| `src/components/financial/FinPaymentPeriodsTab.jsx` | BX-2 tappable party names (desktop table + PartyCard); BX-11 default ostFilter to 'has' |
| `src/pages/AdminPanel.jsx` | BX-3 sessionStorage.clear() on logout |

## Files NOT Changed

AdminLedger, AdminStaff, AdminSettings, AdminCatalogue, Home, Catalogue,
FinDashboardCards, FinPdfExport, FinSlideOver, FinSearch, FinPartyCard,
Sidebar, Navbar, all UI components, all hooks except useFinancialReports,
src/index.css, tailwind.config.js, supabase/*, sync/*, public/*, package.json,
vite.config.js, vercel.json.

---

## Non-Obvious Decisions

**BX-1 — All Time + Payment Periods tab:** The Payment Periods tab fetches its own data (fetchLastPayments + fetchOutstandingPerParty) independently of the AdminReports date range — it always shows current outstanding and last payment date for all parties, so it is naturally "all time" already. No change needed there; the "All Time" preset just leaves the date inputs hidden and the Payment Periods tab works the same either way.

**BX-3 — stateFilter not persisted in sessionStorage key collision risk:** All five filter keys use unique prefixes (`fin_sort`, `fin_filter`, `fin_label`, `fin_state`, `fin_hide_settled`) to avoid collision with other pages' future sessionStorage usage.

**BX-3 — handleHideSettled:** The original `setHideSettled(v => !v)` toggle pattern was replaced with `handleHideSettled(!hideSettled)` to read the current value at call time. Since `hideSettled` is already in scope at the onClick handler, this is safe.

**BX-9 — finLoading vs loading:** AdminReports has two loading states: `finLoading` for the FinDashboardCards data (from useFinancial), and `loading` for the period report data (from useFinancialReports). These are independent and intentional — the dashboard cards load on mount separately from the period data.

---

## What Next Phase (B6-2) Must Know

- All B6-1 changes are stable and tested mentally against the existing code patterns.
- `sessionStorage` keys used by B6-1: `fin_tab`, `fin_scroll`, `fin_sort`, `fin_filter`, `fin_label`, `fin_state`, `fin_hide_settled`. Future phases must not reuse these keys for different purposes.
- `FinDashboardCards` is now only rendered in `AdminReports`. It is NOT in `AdminFinancial` anymore.
- `useFinancial` is now imported in both `AdminFinancial` and `AdminReports`.
- B6-2 modifies `AdminPanel.jsx` (mobile sidebar), `src/index.css`, `src/App.jsx`, `AdminSettings.jsx`, `useAppSettings.js`, `AdminLedger.jsx`, `FinPdfExport.jsx`, `package.json` — none of these were touched in B6-1.

## Supabase Setup

No changes needed. No new tables, no migrations, no new keys in `app_settings`.
