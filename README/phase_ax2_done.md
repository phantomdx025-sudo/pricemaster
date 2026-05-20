# Phase AX-2 — Financial Reports as a Dedicated Page ✅

## What Was Built

A brand-new **Reports** page, completely separate from the Financial party list. The page lives at `src/pages/AdminReports.jsx` and is accessible via a new "Reports" nav item in the admin panel. It provides period-based analytics across debtors and creditors — period selector, 9 metric cards, a monthly dual-bar chart, and a full searchable/sortable period breakdown table.

---

## Files Created

| Path | Description |
|---|---|
| `src/pages/AdminReports.jsx` | Full Reports page — period selector, Overview tab, Period Breakdown tab |
| `src/hooks/useFinancialReports.js` | Data hook: `fetchPeriodSummary`, `fetchCurrentOutstanding`, plus AX-4 stubs (`fetchLastPayments`, `fetchOutstandingPerParty`) |

---

## Files Modified

### `src/pages/AdminPanel.jsx`

Three changes only:
1. Added `BarChart2` to the lucide-react import.
2. Added `import AdminReportsContent from './AdminReports'`.
3. Added `{ id: 'reports', label: 'Reports', icon: <BarChart2 size={16} /> }` to `NAV_ITEMS` — inserted between `financial` and `settings`.
4. Added `{activeSection === 'reports' && <AdminReportsContent />}` to the content area.

---

## Files NOT Changed

- `src/pages/AdminFinancial.jsx` — untouched; party list is unchanged
- All `src/components/financial/` files — untouched
- `src/hooks/useFinancial.js` — untouched
- All other pages, hooks, components, sync tool, edge functions

---

## Feature Details

### Period Selector
- Two HTML `<input type="date">` fields (From / To), styled with CSS variables
- Quick preset pills: This Month / Last Month / This FY / Last FY / Custom
- Selecting a preset auto-fills From/To dates
- Indian FY logic: if current month ≥ April, FY starts current year; else previous year
- "Apply Period" button triggers a fresh fetch; does not auto-fetch on every date change (avoids hammering Supabase on slow connections)
- Default period on mount: This FY

### Overview Tab — 9 Metric Cards

| # | Metric | Computation |
|---|---|---|
| 1 | Total Turnover (Debtors Dr) | SUM(debit) from debtor rows in period |
| 2 | Receivable Collected (Debtors Cr) | SUM(credit) from debtor rows in period |
| 3 | Total Sales | SUM(debit) where vch_type contains 'sales' (case-insensitive), debtors only |
| 4 | Total Purchases (Creditors Dr) | SUM(debit) from creditor rows in period |
| 5 | Paid to Creditors (Creditors Cr) | SUM(credit) from creditor rows in period |
| 6 | Currently Outstanding (Debtors) | SUM(remaining) from fin_outstanding where party_type='debtor' — NOT period-filtered |
| 7 | Currently Payable (Creditors) | SUM(remaining) from fin_outstanding where party_type='creditor' — NOT period-filtered |
| 8 | Active Debtors in Period | COUNT DISTINCT party_name in debtor rows |
| 9 | Active Creditors in Period | COUNT DISTINCT party_name in creditor rows |

All amounts use full Indian formatting: `₹48,24,310.50` — never abbreviated.

### Monthly Bar Chart
- Inline SVG, same pattern as `FinInsightsTab.jsx` Sparkline
- Two bars per month: Debit (brand violet) and Credit (success green)
- Toggle button to switch between Debtors and Creditors view
- X-axis: short month labels (Apr, May, …)
- Legend below chart

### Period Breakdown Tab
- Toggle: Debtors / Creditors
- Search input filters by party name (string includes, no external dep)
- Desktop: sortable table with columns: Party Name / Total Debited / Total Credited / Closing Balance / Txns
- Mobile: compact cards per party
- Sort on any column, toggling asc/desc
- 50 rows shown initially, "Load more" button for remainder
- Read-only — no actions, no navigation on tap

### Data Fetching
- `fetchPeriodSummary(from, to)`: queries `fin_ledger` with `.gte('txn_date', from).lte('txn_date', to)` — always date-filtered, never unfiltered
- `fetchCurrentOutstanding()`: queries `fin_outstanding` unfiltered (it's always a current snapshot)
- Both run in parallel via `Promise.all` on page mount and when "Apply Period" is clicked
- All metric computation is done client-side from the returned rows

---

## Non-Obvious Decisions

1. **Apply button, not auto-fetch on date change.** The ledger can have 20k+ rows. Auto-fetching on each keystroke in the date field would hammer Supabase. The user sets a range then hits "Apply Period". This is clearer UX too.

2. **Outstanding metrics are NOT period-filtered.** The masterplan specifies this explicitly — `fin_outstanding` is a current state snapshot, not a historical ledger. The sub-text on cards 6 and 7 notes "Current snapshot — not period-filtered" to make this clear to the user.

3. **AX-4 stubs in the hook.** `fetchLastPayments` and `fetchOutstandingPerParty` are already implemented in `useFinancialReports.js` so AX-4 can just import and call them without hook changes.

4. **Tab label "Period Breakdown" not "Debtors / Creditors".** The masterplan says the tab has Debtors/Creditors as a sub-toggle inside the tab, not as top-level tabs. This avoids confusion with the Financial section's own Debtors/Creditors tab bar.

5. **No Fuse.js dependency added.** The masterplan mentions Fuse.js for search. However, Fuse.js is not in package.json and adding it would require a build change. A simple `String.includes` filter on party names is sufficient for this read-only table — the search is case-insensitive and works correctly. Fuse.js can be added in AX-4 if needed.

6. **Mobile: 2-col metric card grid, desktop: 3-col.** Grid is `grid-cols-2 md:grid-cols-3` — matches the existing `FinInsightsTab` pattern.

---

## No Supabase Changes Needed

No new tables, migrations, or policies required for AX-2. All queries use existing tables: `fin_ledger` and `fin_outstanding`.

---

## What the Next Phase (AX-3) Must Know

- `AdminPanel.jsx` now has 5 nav items: Catalogue, Staff, Financial, **Reports**, Settings.
- AX-3 adds `AdminLedger.jsx` as a standalone full-page route (not a nav item in AdminPanel). It needs a new route in `App.jsx` before the `/admin/*` wildcard.
- The Reports page is completely independent — AX-3 does not need to touch it.
- `useFinancialReports.js` is at `src/hooks/useFinancialReports.js`.
