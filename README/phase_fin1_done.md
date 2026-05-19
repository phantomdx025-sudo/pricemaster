# Phase FIN-1 Done — Foundation + Party List

## What Was Built

Phase FIN-1 delivers the Financial Reports page fully wired into the Admin Panel. The page is accessible as a third nav item ("Financial") with a `TrendingUp` icon, sitting alongside Catalogue and Staff in both the desktop sidebar and mobile tab bar.

### Components & files created

#### `supabase/migrations/002_fin_init.sql`
All 7 `fin_*` tables created with exact schema from masterplan:
- `fin_parties`, `fin_ledger`, `fin_outstanding`, `fin_address`, `fin_party_notes`, `fin_pinned`, `fin_sync_log`
- RLS enabled on all tables; public read policies for `anon` + `authenticated`; write policies for notes and pinned (authenticated only)

#### `src/hooks/useFinancial.js`
- Module-level cache (same pattern as `useInventory.js`) with keys: `parties`, `address`, `syncLog`, `pinned`
- `fetchParties()` — loads all `fin_parties`, splits into `debtors` / `creditors` arrays
- `fetchAddress()` — loads all `fin_address`, builds `Map<lowerName, row>` for O(1) lookup
- `fetchSyncLog()` — loads last 20 `fin_sync_log` rows, newest first
- `fetchPinned()` — loads `fin_pinned`, builds `Set<'type:name'>` for O(1) membership test
- `loadAll()` — fires all 4 in parallel via `Promise.all`
- `clearCache()` — invalidates all 4 cache keys (call after sync)
- Exposes `setPinned` setter for FIN-2 optimistic pin updates
- Individual loading flags: `loadingParties`, `loadingAddress`, `loadingSync` + composite `loading`
- `error` string for party fetch failures (address/sync failures are soft-logged, not blocking)

#### `src/pages/AdminFinancial.jsx`
- Main page shell; wraps in `max-w-5xl` centered container with `px-4 py-5`
- Calls `loadAll()` on mount via `useEffect`
- Refresh button (top-right) calls `clearCache()` then `loadAll()`; spins while loading
- Three states:
  - **Empty** — no data yet: illustrated empty state with sync instructions
  - **Error** — inline error card with retry button (not just a toast)
  - **Data** — dashboard cards + tabbed party list
- Debtors / Creditors tab strip with animated underline; each tab shows party count badge
- `onPartyClick` stub logs party name in DEV; FIN-2 will replace with slide-over open

#### `src/components/financial/FinDashboardCards.jsx`
- 4 cards in a 2-col (mobile) / 4-col (desktop) responsive grid
- **Total Receivable** — sum of `closing_bal` where `status === 'Receivable'` (debtors); sub-label shows party count
- **Total Payable** — sum of `closing_bal` where `status === 'Payable'` (creditors); sub-label shows vendor count
- **Outstanding Parties** — count of parties with `closing_bal > 0` across both types
- **Last Synced** — reads most recent `fin_sync_log` row with `status === 'success'`; shows "Never synced" if none
- Skeleton shown while `loading && !hasData`; all amounts use `₹` + `en-IN` locale

#### `src/components/financial/FinPartyList.jsx`
- Filter chips row (scrollable horizontal strip): All, Outstanding, Receivable, Payable, Settled, Credit Bal
- Hide Settled toggle button (pill style, activates with brand colour)
- Sort dropdown: Name A→Z (default), Name Z→A, Balance ↑, Balance ↓
- State dropdown: appears only when 3+ unique states are present in address book for current party set
- Party count badge (e.g. "1,287 parties")
- Desktop column headers: Party Name (sortable), Status, State, Mobile, Balance (sortable) — via `ColHeader` sub-component with `ChevronUp`/`ChevronDown`/`ChevronsUpDown` indicators
- Skeleton (8 rows) shown while `loading && list.length === 0`
- Empty filtered state: "No parties match the current filter"
- Sort logic: pinned parties always float to top within any sort order; secondary sort applied within each pin group

#### `src/components/financial/FinPartyCard.jsx`
- **Mobile**: party name + closing balance on top row; status badge + state + mobile on second row
- **Desktop**: pin star | name | status badge | state | tap-to-call mobile | balance (right-aligned)
- Pin star: `Star` icon, filled, brand colour — shown only when `isPinned` is true
- Status badge: colour-coded via CSS variables — Receivable=brand, Payable=error, Settled=success, Credit Bal=warning
- Negative closing balance shown as `−₹X` with error colour
- Mobile number: `<a href="tel:...">` with `e.stopPropagation()` so tap-to-call doesn't open slide-over
- Entire card is a `<button>` → `onClick` fires `onPartyClick`; min-height 44px for touch targets

### Files modified

#### `src/pages/AdminPanel.jsx`
Three surgical changes only:
1. Added `TrendingUp` to the lucide-react import
2. Added `import AdminFinancialContent from './AdminFinancial'`
3. Added `{ id: 'financial', label: 'Financial', icon: <TrendingUp size={16} /> }` to `NAV_ITEMS`
4. Added `{activeSection === 'financial' && <AdminFinancialContent />}` in the content render block

No other changes — existing Catalogue and Staff sections untouched.

### Files NOT changed
- `src/components/layout/Sidebar.jsx` — driven by `NAV_ITEMS` prop, no change needed
- `src/hooks/useInventory.js`, `useCatalogueWrite.js`, `useStaffAuth.js`, `useStaffWrite.js` — untouched
- `src/pages/AdminCatalogue.jsx`, `AdminStaff.jsx` — untouched
- All `supabase/functions/*` — untouched
- `sync/sync_core.py`, `sync_tool.pyw` — untouched (FIN-4 handles these)
- `src/index.css`, `tailwind.config.js` — untouched (all new components use existing variables)
- `package.json` — no new dependencies needed for FIN-1

## Non-obvious Decisions

1. **Address map as `Map<lowerName, row>`** — O(1) lookup in `FinPartyList` and `FinPartyCard` without a nested `.find()` per card render. Key is lowercased + trimmed to handle case differences between party names in ledger vs address book.

2. **`loadingParties || loadingAddress || loadingSync` composite flag** — passed to dashboard cards as `loading && !hasData` so that cards show skeleton only on the very first load, not on every refresh (avoids flicker when cache is warm).

3. **`pinned` as `Set<'type:name'>`** — O(1) membership test in `FinPartyList` sort comparator. Avoids iterating the pinned array for every card render.

4. **Soft errors for address/sync fetches** — only party fetch errors are surfaced as blocking error UI (because without parties there's nothing to show). Address and sync log failures log to console in DEV but don't block the page.

5. **`onPartyClick` stub** — logs in DEV only (`import.meta.env.DEV` guard). FIN-2 replaces this with slide-over open logic.

6. **State dropdown appears conditionally** — only rendered when `uniqueStates.length > 2` (i.e. at least 2 actual state values). Avoids cluttering the UI when all parties are in one state.

## Supabase Setup Steps Required

Run `supabase/migrations/002_fin_init.sql` in the Supabase SQL Editor. Tables will be empty until the FIN-4 sync tool populates them. The page handles this gracefully with the empty state UI.

## What FIN-2 Must Know

1. **`onPartyClick(party)`** in `AdminFinancial.jsx` is the entry point for the slide-over. Replace the DEV log with `setSelectedParty(party); setSlideOverOpen(true)`.

2. **`useFinancial` hook** is already exported and ready to extend. Add `fetchLedger`, `fetchOutstanding`, `fetchContact`, `fetchNotes`, `addNote`, `deleteNote`, `togglePin` as described in masterplan — all lazy, called from slide-over tabs.

3. **`setPinned` is exposed** from the hook — use it for optimistic pin updates (update the Set immediately, revert on Supabase error).

4. **Cache invalidation on pin toggle**: after `togglePin`, call `cache.pinned = null` and `fetchPinned()` to re-sync, OR do optimistic update with `setPinned(new Set([...pinned, key]))` / `setPinned(new Set([...pinned].filter(k => k !== key)))`.

5. **Party card `isPinned` prop** is derived from the `pinned` Set in `FinPartyList` — no changes needed to `FinPartyCard` for pin functionality.

6. **Mobile slide-over** must be bottom-sheet (`animate-slide-up`); desktop must be right-panel (`animate-slide-in-right`). Use `window.innerWidth < 768` or a CSS media query class check to decide.

7. **`fin_ledger` fetching** — order by `txn_date ASC, id ASC` to preserve original transaction order within a day.
