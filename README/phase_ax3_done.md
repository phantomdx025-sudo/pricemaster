# Phase AX-3 Done — Financial Party List UX Overhaul

## What Was Built

### Change 1 — Collapsible Filter Strip (`FinPartyList.jsx`)

Replaced the previous multi-row pill layout with a compact 3-button collapsible filter strip:

```
[ Ledger ▾ ]  [ Hide Settled ▾ ]  [ Labels ▾ ]
```

**Implementation details:**
- New `FilterDropdown` sub-component inside `FinPartyList.jsx` — anchors below its trigger, `position: absolute`, `z-index: 50`
- Each button shows an active-filter badge (numbered circle) when its group has a filter active
- Close on outside click via `useRef` + `document.addEventListener('mousedown', ...)`
- `openGroup` state: `'ledger' | 'settled' | 'labels' | null`
- Ledger group dropdown shows all `STATUS_FILTER_OPTIONS` with a checkmark on the active one
- Hide Settled group shows a single toggle button inside the dropdown
- Labels group shows all label options (system + custom) with colour dots; includes "Manage Labels" at the bottom behind a divider
- On selection, the dropdown closes and the filter is applied
- Sort, State filter, bulk export, and party count moved to the second row below the filter strip
- No functional filter logic changed — same `displayed` useMemo computation as before

### Change 2 — Full-Page Ledger (`src/pages/AdminLedger.jsx` + routing)

**New file created:** `src/pages/AdminLedger.jsx`

A standalone full-screen page at `/admin/financial/ledger/:partyType/:partyName`. Does NOT use the AdminPanel sidebar — it has its own minimal header with a back button.

**Features:**
- Back button (top-left) → navigates to `/admin` with `state: { section: 'financial' }` so AdminPanel opens directly on the Financial tab
- Party name as page title with status chip and party type badge
- Balance display (same as slide-over)
- Share button with full popover (Download PDF, WhatsApp with phone number input, Email, Print) — exact same logic as FinSlideOver
- Pin button (toggles pin via `useFinancial().togglePin`)
- Label pill (opens FinLabelPicker inline, synced to Supabase)
- Internal tab bar: Ledger / Outstanding / Contact / Insights
- Reuses `FinLedgerTab`, `FinOutstandingTab`, `FinContactTab`, `FinInsightsTab` exactly as before
- Cached ledger + outstanding rows passed to FinInsightsTab (same pattern as FinSlideOver)
- Max-width `max-w-3xl mx-auto` for content so it's not uncomfortably wide on desktop

**`App.jsx` changes:**
- Added `import AdminLedger` 
- Added route `/admin/financial/ledger/:partyType/:partyName` **before** the `/admin/*` wildcard (required for React Router to match the specific route)

**`AdminPanel.jsx` changes:**
- Added `useLocation` import 
- `activeSection` initial state now reads `location.state?.section ?? 'catalogue'` — so back-navigation from AdminLedger restores the Financial tab

**`AdminFinancial.jsx` changes:**
- Added `useNavigate` import
- Removed `selectedParty`, `slideOverOpen`, `handleSlideOverClose`, `handlePartyClick` slide-over state
- `handlePartyClick` now calls `navigate('/admin/financial/ledger/${type}/${encodeURIComponent(name)}')`
- Removed `FinSlideOver` import and usage
- Simplified `slideOverHooks` / `currentLabelMap` / `currentPartyLabelKey` — label context is no longer needed here since the ledger page manages its own labels
- `FinSlideOver.jsx` is NOT deleted — kept for potential future use

### Change 3 — Mobile Ledger Fixes (`FinLedgerTab.jsx`)

**`LedgerCard` component restructured:**

Old layout:
```
Date                    vch_type + vch_no (truncated, same line)
Narration (always shown)
Debit / Credit / Balance
```

New layout (AX-3):
```
Date                                   Vch Type
Vch No (full-width, mono, NEVER truncated)
Narration (hidden by default, shown only when showNarrations = true)
Debit / Credit / Balance
```

**Narration toggle:**
- `showNarrations` boolean state in `FinLedgerTab` (default `false`)
- Only rendered on mobile (`md:hidden` section)
- Toggle button appears above the first card, right-aligned, `text-xs underline text-muted`
- Label: "Show narrations" / "Hide narrations"
- Only shown at all if at least one row has a non-empty narration (`hasAnyNarration` check)

**Desktop table:** Unchanged — no narration column since FIN-5.

---

## Files Created
- `src/pages/AdminLedger.jsx` — new full-screen ledger page

## Files Modified
- `src/App.jsx` — added AdminLedger import + route before /admin/* wildcard
- `src/pages/AdminPanel.jsx` — added useLocation, read location.state.section for back-navigation
- `src/pages/AdminFinancial.jsx` — removed FinSlideOver, onPartyClick now navigates
- `src/components/financial/FinPartyList.jsx` — collapsible filter strip (FilterDropdown component)
- `src/components/financial/FinLedgerTab.jsx` — vch_no on own line, narration toggle

## Files NOT Changed
- `FinSlideOver.jsx` — kept intact, just not used from AdminFinancial anymore
- `FinLedgerTab.jsx` desktop table — unchanged
- All other components, hooks, Supabase tables, sync tool
- `FinLabelPicker.jsx`, `FinLabelManager.jsx`, `FinPartyCard.jsx` — untouched
- `AdminReports.jsx`, `AdminSettings.jsx` — untouched

## Non-Obvious Decisions

1. **FinSlideOver not deleted** — as specified in masterplan. It still exists at its path. Future phases can re-introduce it or use it in other contexts.

2. **AdminLedger uses `useFinancial()`** — this means it re-fetches parties on mount if the cache is empty. Since `useFinancial` has its own in-memory cache, navigating back and forward is fast once data is loaded. No duplicate requests.

3. **Label state in AdminLedger is local** — the page fetches `partyLabelKey` on mount and manages it locally. When the user navigates back to AdminFinancial, the label map there refreshes on the next `fetchAllPartyLabels` call. This is acceptable since labels are not shown in the party list in real-time sync; any label changes made in AdminLedger will appear correctly next time AdminFinancial loads.

4. **Back navigation uses `location.state`** — `navigate('/admin', { state: { section: 'financial' } })` and `useState(() => location.state?.section ?? 'catalogue')` in AdminPanel. This is clean and avoids URL query params. If the user navigates to /admin directly (fresh), they land on Catalogue as before.

5. **`vch_no` line is always rendered when present** — not dependent on `showNarrations`. The spec says vch_no should "never be truncated" — it's on its own full-width line with `font-mono text-xs`.

## What the Next Phase (AX-4) Must Know
- `AdminLedger` is now the primary party ledger page. Any AX-4 links to party ledgers should use `/admin/financial/ledger/:partyType/:partyName`.
- `useFinancial()` hook is used in both `AdminFinancial` and `AdminLedger` — cache is shared.
- `FinLedgerTab` now has `showNarrations` as internal state — no prop needed from parent.

## Supabase Changes
None. No new tables, no migrations needed.
