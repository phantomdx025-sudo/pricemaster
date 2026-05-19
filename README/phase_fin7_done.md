# Phase FIN-7 — Financial Insights Tab

## What Was Built

A new 4th **Insights** tab inside the party slide-over, showing auto-computed analytics for each party.
All computations are client-side — no new Supabase queries or tables. Data is reused from already-loaded
ledger and outstanding rows; if those aren't loaded yet the tab triggers its own fetch transparently.

---

## Files Created

### 1. `src/components/financial/FinInsightsTab.jsx`

New component. Props: `party`, `partyType`, `ledgerRows`, `outstandingRows`,
`fetchLedger`, `fetchOutstanding`, `onLedgerLoaded`.

**Debtor metrics computed:**
- Last payment received: date + amount (last `credit > 0` ledger row)
- Days since last payment (with colour coding: green ≤30d, warning ≤90d, error >90d)
- Oldest outstanding invoice age (max `daysSince(inv_date)` across outstanding rows)
- Invoices this FY vs last FY (`debit > 0` rows, April–March boundaries)
- Average days to pay (proxy: gap from each debit row to the next credit row chronologically)
- 6-month payment trend (increasing ↑ / decreasing ↓ / stable → based on first-half vs last-half of sparkline)
- Monthly payments received sparkline — 6-bar inline SVG chart coloured with `var(--brand)`

**Creditor metrics computed:**
- Last payment made: date + amount (last `debit > 0` row)
- Days since last payment
- Total paid this FY (sum of debit rows for current financial year)
- Largest single payable (max `remaining` from outstanding rows)

**Loading behaviour:**
- If `ledgerRows` is empty (tab opened directly without visiting Ledger tab first), it calls
  `fetchLedger` itself and calls `onLedgerLoaded` to update FinSlideOver's `cachedLedger`.
- Outstanding rows: if empty, calls `fetchOutstanding` in parallel (non-blocking — tab shows
  ledger metrics while outstanding loads, sub-values say "Loading…" until resolved).
- Syncs in when parent `ledgerRows` prop fills in later (via `useEffect` watching the prop).

**Empty/error states:**
- Full-area "No ledger data to analyse" empty state with icon
- Full-area error state if ledger fetch fails

**UI:**
- Card grid: 2 columns on mobile, 3 on desktop
- Each card: icon + icon background (using CSS vars matching card type) + label + value + sub-text
- Sparkline: inline SVG `viewBox`, uses `var(--brand)` fill, bars with `rx={4}` rounding, month labels below bars
- Section header label: "DEBTOR INSIGHTS" or "CREDITOR INSIGHTS" in muted caps
- All amounts via `fmt()` helper (`₹` + `toLocaleString('en-IN')`)
- Fully dark-mode compatible (all colours via CSS variables)
- No hardcoded hex in JSX (sparkline bar uses `var(--brand)` via SVG fill attribute)

---

## Files Modified

### 2. `src/components/financial/FinSlideOver.jsx`

Changes:
- Added `BarChart2` to lucide-react import
- Added `import FinInsightsTab from './FinInsightsTab'`
- Added `{ id: 'insights', label: 'Insights', Icon: BarChart2 }` to `TABS` array (4th tab)
- Added `cachedOutstanding` state (mirrors `cachedLedger` pattern)
- Resets `cachedOutstanding` to `[]` in the `party?.party_name` effect (alongside `cachedLedger` reset)
- Outstanding tab now passes `onOutstandingLoaded={setCachedOutstanding}` so visiting Outstanding tab
  before Insights populates the cache automatically
- Added `{activeTab === 'insights' && <FinInsightsTab ... />}` panel in tab content area,
  passing `ledgerRows={cachedLedger}`, `outstandingRows={cachedOutstanding}`,
  `fetchLedger`, `fetchOutstanding`, `onLedgerLoaded={setCachedLedger}`

### 3. `src/components/financial/FinOutstandingTab.jsx`

Minor change only:
- Added optional `onOutstandingLoaded` prop (JSDoc updated)
- After fetch resolves, calls `onOutstandingLoaded(data)` if provided
- No visual changes — component looks identical to FIN-6

---

## Files NOT Changed

- `sync/fin_sync_core.py` — no change
- `sync/fin_sync_tool_tab.py` — no change
- `src/components/financial/FinLedgerTab.jsx` — no change
- `src/components/financial/FinPdfExport.jsx` — no change
- `src/components/financial/FinContactTab.jsx` — no change
- `src/components/financial/FinPartyCard.jsx` — no change
- `src/components/financial/FinPartyList.jsx` — no change
- `src/components/financial/FinDashboardCards.jsx` — no change
- `src/components/financial/FinLabelPicker.jsx` — no change
- `src/components/financial/FinLabelManager.jsx` — no change
- `src/hooks/useFinancial.js` — no change (no new Supabase queries needed)
- `src/pages/AdminFinancial.jsx` — no change (hooks already destructure fetchLedger + fetchOutstanding)
- All non-financial files — never touched

---

## Non-Obvious Decisions

1. **No new Supabase queries.** All metrics are computed client-side from `fin_ledger` and `fin_outstanding`
   data already available. This keeps the implementation simple and avoids rate-limit concerns.

2. **`cachedOutstanding` in FinSlideOver.** The Outstanding tab already had its own internal state.
   Rather than refactoring it to lift state up, we added a lightweight `onOutstandingLoaded` callback
   (same pattern as `onLedgerLoaded` from FIN-6). The cache fills if the user visits Outstanding tab
   before Insights. If they go straight to Insights, the tab fetches on its own.

3. **`onLedgerLoaded` called from Insights tab too.** If the user opens Insights without first visiting
   Ledger, FinInsightsTab fetches the ledger and calls `onLedgerLoaded`. This means `cachedLedger` in
   FinSlideOver stays fresh — going back to the Ledger tab will still benefit from the cache even if
   Insights was opened first.

4. **Average days to pay: proxy calculation.** Tally's ledger doesn't expose explicit invoice↔receipt
   links. We approximate by pairing each `debit` row (invoice) with the chronologically next `credit`
   row (receipt). This is a useful heuristic for parties with regular billing cycles, but may give
   slightly skewed results for parties with very irregular patterns. The sub-text explains the metric
   plainly. If Tally adds explicit linkage in a future export format, a more accurate version can be
   swapped in without changing the UI.

5. **Sparkline uses inline SVG `fill="var(--brand)"`** instead of a hardcoded hex. SVG `fill` attributes
   accept CSS variables in all modern browsers (Chrome 49+, Firefox 31+, Safari 9.1+). This correctly
   renders differently in light vs dark mode without any extra logic.

6. **Financial year boundary is April–March (Indian FY).** Function `financialYear(date)` returns the
   April-start year: months 0–2 (Jan–Mar) belong to the *previous* year's FY; months 3–11 (Apr–Dec)
   belong to the *current* year's FY. E.g. Feb 2026 → FY 2025 (Apr 2025 – Mar 2026).

---

## What the Next Phase (FIN-8) Must Know

- All 6 bugs from FIN-5 are fixed; FEATURE-1 (labels) from FIN-6 is complete; FEATURE-3 (insights)
  from FIN-7 is now complete.
- The `cachedLedger` + `cachedOutstanding` pattern in FinSlideOver works well for read-only data
  sharing across tabs — reuse this pattern if any future tab needs ledger/outstanding access.
- No new Supabase tables were added in FIN-7. The DB schema is unchanged from FIN-6.
- The `FinInsightsTab` can be extended with more metrics by adding to the `metrics` useMemo block
  and adding more `<MetricCard>` elements — no structural changes needed.

---

## Supabase Setup for FIN-7

**No new migrations required.** FIN-7 adds no new tables, RLS policies, or Edge Functions.

The existing tables used are:
- `fin_ledger` (read) — ledger rows per party
- `fin_outstanding` (read) — outstanding invoices per party

Both already have public read RLS from earlier phases.
