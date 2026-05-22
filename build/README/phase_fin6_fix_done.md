# Phase FIN-6 Fix — Per-Party Label System (Correction)

## What Was Wrong

FIN-6 implemented labels **per transaction row** inside the ledger slide-over:
- `fin_ledger_labels` table keyed on `(party_type, party_name, txn_date, vch_no)`
- Label pills and filter strip were inside `FinLedgerTab`
- `FinPartyList` had no label UI at all

## What Was Fixed

Labels are now **per-party** (per entire ledger account):

### Mental model
- "Bluesquad Fashion Pvt Ltd" as a whole is labelled **"Make Receipt"**
- The party list can be filtered to show only "Make Receipt" parties
- Opening a party's slide-over lets you **change** that party's label
- Zero label UI inside the ledger tab

---

## Files Changed

### `supabase/migrations/004_fin_party_labels.sql` — NEW
- Drops `fin_ledger_labels` (per-row, wrong)
- Creates `fin_party_labels (id, party_type, party_name, label_key, created_at, updated_at)` with `UNIQUE(party_type, party_name)`
- RLS policies: public read, authenticated write
- `fin_custom_labels` unchanged

### `src/hooks/useFinancial.js`
- Removed: `fetchLabels`, `setLabel` (per-row)
- Added: `fetchPartyLabel(partyType, partyName)` → labelKey | null
- Added: `fetchAllPartyLabels(partyType)` → Map<partyName, labelKey>
- Added: `setPartyLabel(partyType, partyName, labelKey)` — upsert or delete
- `deleteCustomLabel` now cleans `fin_party_labels` instead of `fin_ledger_labels`
- Kept: `fetchCustomLabels`, `addCustomLabel`, `deleteCustomLabel`

### `src/components/financial/FinLedgerTab.jsx`
- Stripped all label code: `fetchLabels`, `setLabel`, `LabelPill`, `LabelRow`, `LabelCard`, filter strip, `FinLabelPicker`, `FinLabelManager`, label column (7→6 columns)
- Kept: `onLedgerLoaded` prop (used by FIN-7 Insights tab)

### `src/components/financial/FinPartyCard.jsx`
- Added `labelKey`, `customLabels`, `onLabelClick` props
- Mobile: label pill shown below StatusBadge (not shown for "not_reviewed")
- Desktop: new "Label" column between Status and State columns
- Tapping label pill calls `onLabelClick(party)` — parent handles picker

### `src/components/financial/FinPartyList.jsx`
- Added `hooks`, `labelMap`, `onLabelChange` props
- Fetches `customLabels` on mount via `hooks.fetchCustomLabels`
- Label filter strip below status filter: All / Checked ✓ / Make Receipt / Send for Checking / Not Reviewed / + used custom labels
- Label filter is ADDITIVE with status filter (both apply)
- Label filter resets to "All" when `partyType` changes
- Each `FinPartyCard` receives `labelKey` and `onLabelClick`
- Tapping a label pill opens `FinLabelPicker` inline for that party
- `FinLabelManager` accessible via ⚙ button in label filter strip
- Desktop column headers updated (added "Label" column)

### `src/components/financial/FinSlideOver.jsx`
- Added label pill button in the header (near closing balance)
- Shows current party label; tapping opens `FinLabelPicker`
- Calls `hooks.setPartyLabel(...)` on selection
- Calls `hooks.onLabelChange(...)` to propagate back to `AdminFinancial` labelMap
- `hooks.partyLabelKey` passed in from `AdminFinancial` (resolved per selected party)
- `FinLedgerTab` now only receives `fetchLedger` + `onLedgerLoaded`
- `FinLabelManager` modal accessible from the header label picker

### `src/pages/AdminFinancial.jsx`
- `debtorLabelMap` and `creditorLabelMap` state (Map<partyName, labelKey>)
- `fetchAllPartyLabels` called on mount for both debtor + creditor
- `handleLabelChange(partyType, partyName, labelKey)` — updates the correct map optimistically
- `currentPartyLabelKey` resolved from the active labelMap for the open slide-over party
- `slideOverHooks` updated: new label functions + `partyLabelKey` + `onLabelChange`
- Both `FinPartyList` instances receive `hooks`, `labelMap`, `onLabelChange`

## Files Unchanged
- `FinLabelPicker.jsx` — reused as-is
- `FinLabelManager.jsx` — reused as-is
- `FinInsightsTab.jsx` — FIN-7, untouched
- `FinOutstandingTab.jsx`, `FinContactTab.jsx`, `FinPdfExport.jsx`, `FinDashboardCards.jsx`, `FinSearch.jsx`
- `sync/` — never touched

## Supabase Action Required

Run `supabase/migrations/004_fin_party_labels.sql` in the SQL Editor before testing.
`fin_ledger_labels` will be dropped (it had no real data since FIN-6 was just deployed).
`fin_custom_labels` is unchanged.
