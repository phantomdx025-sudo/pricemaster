# Phase AX-4 Done — Payment Periods Page

## What Was Built

### New tab in Reports: "Payment Periods"

Added a 3rd tab to `AdminReports.jsx`:

```
Reports
├── Overview           (AX-2, unchanged)
├── Period Breakdown   (AX-2, unchanged)
└── Payment Periods    ← NEW (AX-4)
```

The tab is completely standalone — it does not use the period selector date range. It always shows the *current* state of payments, not a historical period view. This is correct: the question being answered is "who hasn't paid recently?" not "who paid in a given window?"

### `FinPaymentPeriodsTab.jsx` — New component

Located at `src/components/financial/FinPaymentPeriodsTab.jsx`.

**Data flow:**
1. Calls `fetchLastPayments(partyType)` → latest payment date per party from `fin_ledger`
   - Debtors: latest row where `credit > 0`
   - Creditors: latest row where `debit > 0`
2. Calls `fetchOutstandingPerParty(partyType)` → `SUM(remaining)` per party from `fin_outstanding`
3. Merges both arrays client-side by `party_name`
4. Computes `days_since = today - last_payment_date` for each party
5. Parties in outstanding but not in payments → "Never paid" (days = null)

**Debtors/Creditors toggle:**
Pill toggle at the top (Debtors / Creditors). Switching re-fetches both data sources for the new party type. Previous filter/sort state resets on type switch.

**Filter strip (collapsible — same FilterDropdown pattern as AX-3 FinPartyList):**
- `[ Days Overdue ▾ ]` — All / < 30 days / 30–60 days / 60–90 days / > 90 days / Never paid
- `[ Outstanding ▾ ]` — All / Has outstanding / Fully settled
- `[ Sort ▾ ]` — Days ↓ (default) / Days ↑ / Outstanding ↓ / Outstanding ↑ / Name A→Z
- Each dropdown shows a badge count when a filter is active (same as FinPartyList)
- Close on outside click via `useRef` + `document.addEventListener('mousedown', ...)`

**Search:** Text input (right side of filter strip), filters by party name substring.

**Days badge colour coding:**
| Range         | Background             | Text colour           |
|---------------|------------------------|-----------------------|
| 0–29 days     | `--success-light`      | `--success` (green)   |
| 30–59 days    | `--warning-light`      | `--warning` (amber)   |
| 60–89 days    | orange tint (0.15)     | `#dc8228`             |
| 90+ days      | `--error-light`        | `--error` (red)       |
| Never paid    | `--error-light`        | `--error` (red)       |

**Sort — "Never paid" parties:**
When sorting by days (either direction), parties with `days = null` (never paid) always go to the **bottom** of the list. This keeps the "most overdue recently-paying" parties at the top of the default sort, with never-paid parties as a separate group below.

**Desktop table columns:** Party Name | Last Payment | Days Since | Outstanding | Status Badge

**Mobile cards:** Name + days badge on top row; last payment date, outstanding, days below.

**Result count:** Shows `N debtors / creditors (filtered)` above the list when filters are active.

**Refresh button:** Re-fetches both data sources on demand (top-right of toggle row).

### `useFinancialReports.js` — Functions activated (were stubs)

The AX-2 session had already written `fetchLastPayments` and `fetchOutstandingPerParty` as fully working implementations (not just stubs). AX-4 activates them by building the UI that uses them.

`fetchLastPayments(partyType)`:
- Queries `fin_ledger` with `party_type = partyType` and `credit > 0` (debtor) or `debit > 0` (creditor)
- Orders by `txn_date DESC`, keeps only the first (latest) row per `party_name` client-side
- Returns `[{ party_name, last_payment_date }]`

`fetchOutstandingPerParty(partyType)`:
- Queries `fin_outstanding` with `party_type = partyType`
- Sums `remaining` per `party_name` client-side
- Returns `[{ party_name, outstanding }]`

Both functions were already returning the correct data types and structure; no changes needed to the hook logic.

---

## Files Created
- `src/components/financial/FinPaymentPeriodsTab.jsx` — new component (full implementation)

## Files Modified
- `src/pages/AdminReports.jsx`
  - Added `import FinPaymentPeriodsTab from '../components/financial/FinPaymentPeriodsTab'`
  - Added `{ id: 'payment_periods', label: 'Payment Periods' }` to `TABS` array
  - Added `{activeTab === 'payment_periods' && <FinPaymentPeriodsTab />}` to tab content section
  - Note: `FinPaymentPeriodsTab` is rendered unconditionally (not gated on `loaded`) because it manages its own data fetching independently of the period selector
- `src/hooks/useFinancialReports.js`
  - Updated file header comment to reflect AX-4 complete
  - Removed "placeholder" / "stub" comments from `fetchLastPayments` and `fetchOutstandingPerParty` docblocks

## Files NOT Changed
- All other components, hooks, pages — untouched
- `AdminFinancial.jsx`, `FinPartyList.jsx`, `FinLedgerTab.jsx` — untouched
- Sync tool Python files — untouched
- `index.css`, `tailwind.config.js` — untouched
- Supabase tables, migrations — no changes needed

---

## Non-Obvious Decisions

### 1. Payment Periods is NOT date-range filtered
The period selector (From/To dates) at the top of AdminReports applies to the Overview and Period Breakdown tabs only. Payment Periods always shows the current state. This is intentional per the masterplan spec: the feature answers "who hasn't paid me in a long time?" — which is always a present-tense question, not a historical one.

### 2. "Never paid" sort position
`days = null` parties always sort to the **bottom** regardless of sort direction. This is a UX decision: when sorted "most overdue first", you want to see the parties who paid 120 days ago at the top, not null values. Never-paid parties are a distinct category and visually grouped at the bottom naturally.

### 3. FilterDropdown is re-implemented locally, not extracted
The masterplan says to use "the same AX-3 pattern" for the filter strip. The `FilterDropdown` sub-component is defined locally in `FinPaymentPeriodsTab.jsx` (same code pattern as in `FinPartyList.jsx`). Extracting it to a shared file would be cleaner but the masterplan cross-phase rules say to touch only listed files. Local duplication is acceptable here and keeps the diff minimal.

### 4. Both data sources fetched in parallel
`Promise.all([fetchLastPayments, fetchOutstandingPerParty])` — fetched simultaneously, not sequentially. A party present in outstanding but absent from payments (truly never paid) will appear with `last_payment_date = null` and its outstanding amount shown in error red.

### 5. `fetchLastPayments` queries ALL ledger rows for the party type (no date filter)
This is correct — we want the most recent payment ever, not within a period. The query does use `party_type` and `credit/debit > 0` filters, so it's not a full-table scan. Supabase/Postgres will use the index on `party_type`. The result set is at most one row per party (after client-side deduplication), which is small.

---

## What the Next Phase (AX-5) Must Know
- `FinPaymentPeriodsTab` is a self-contained component with its own data fetching. It accepts no props from AdminReports.
- The `isLandscape` prop that AX-5 introduces to `FinLedgerTab` and `FinOutstandingTab` does **not** need to be passed to `FinPaymentPeriodsTab` — its table/card layout already handles responsiveness via `hidden md:block` / `md:hidden` classes. AX-5 may choose to apply landscape handling here too but it's a nice-to-have.
- `AdminReports.jsx` now has 3 tabs. The tab bar is a simple flex row — it won't overflow on mobile because tab labels are short.

## Supabase Changes
None. No new tables. No new migrations. No RLS changes.
