# Phase FIN-6 — Ledger Label System

## What Was Built

A full ledger row labelling system. Every ledger row can be tagged with a status label.
Labels persist in Supabase across syncs (keyed on stable Tally fields, not `fin_ledger.id`).
Admin can create custom labels. Filter strip in the Ledger tab lets you view rows by label.

---

## Files Created

### 1. `supabase/migrations/003_fin_labels.sql`
Creates two new tables:
- **`fin_ledger_labels`** — one label per ledger row, keyed on `(party_type, party_name, txn_date, vch_no)`. No FK to `fin_ledger` — labels survive ledger re-syncs.
- **`fin_custom_labels`** — admin-defined labels with name + hex colour.
Full RLS: public read, authenticated write.

### 2. `src/components/financial/FinLabelPicker.jsx`
Popover/bottom-sheet for picking a label on a ledger row.
- System labels: Checked ✓ (green), Make Receipt (orange), Send for Checking (blue), Not Reviewed Yet (grey).
- Custom labels rendered below a divider.
- Tapping the active label removes it (toggle off to `not_reviewed`).
- "Manage labels…" link opens FinLabelManager.
- Closes on outside click or Escape.
- Desktop: absolute popover. Mobile: fixed bottom sheet.
- Exports `SYSTEM_LABELS` constant (consumed by FinLedgerTab for display lookups).

### 3. `src/components/financial/FinLabelManager.jsx`
Modal (uses existing `Modal.jsx`) for creating and deleting custom labels.
- List of existing custom labels with colour dot + delete button.
- Delete flow: `window.confirm` then toast on error. Warns user rows revert to Not Reviewed.
- Add form: text input + 8 colour swatches (live preview pill) + Add button.
- Max 20 custom labels enforced client-side.
- Accepts `onAdd(name, colorHex)` and `onDelete(labelKey)` callbacks from parent.

---

## Files Modified

### 4. `src/components/financial/FinLedgerTab.jsx`
Major update adding label integration. Key changes:
- New props: `fetchLabels`, `setLabel`, `addCustomLabel`, `deleteCustomLabel`, `onLedgerLoaded`.
- `labelMap` state: `Map<'txnDate|vchNo', labelKey>` built from fetched `fin_ledger_labels`.
- After ledger rows load, `fetchLabels` is called to populate `labelMap` and `customLabels`.
- **Desktop table**: added 7th column "Label" (~10% width) at far right. Column widths adjusted to fit.
- **Mobile cards**: label pill added to bottom-right of each card.
- **LabelPill component**: shows coloured pill for labelled rows; shows a small grey dot for unlabelled rows.
- **Filter strip** at top: horizontal scroll row of filter pills (All, Checked, Make Receipt, Send for Checking, Not Reviewed, + custom labels that have at least one row assigned). Manage labels icon (Tag) on the right.
- **Filter active banner**: when a filter is active, shows count + "Clear filter" link.
- **FinLabelPicker** rendered conditionally for the row whose pill was tapped.
- **Optimistic updates**: label changes update UI immediately, revert on error.
- `onLedgerLoaded` callback fires after ledger fetch — wires up `cachedLedger` in FinSlideOver for future FIN-7 Insights tab.

### 5. `src/hooks/useFinancial.js`
Added 5 new functions:
```js
fetchLabels(partyType, partyName)           // parallel fetch of fin_ledger_labels + fin_custom_labels
setLabel(partyType, partyName, txnDate, vchNo, labelKey)  // upsert (or delete if null/'not_reviewed')
fetchCustomLabels()                          // fin_custom_labels[] ordered by created_at
addCustomLabel(name, colorHex)               // inserts with crypto.randomUUID() as label_key
deleteCustomLabel(labelKey)                  // deletes label + all fin_ledger_labels using that key
```
All use `supabase` anon client (RLS allows authenticated write). `crypto.randomUUID()` used (no external package needed — available in all modern browsers).
All 5 exposed in the hook return value.

### 6. `src/components/financial/FinSlideOver.jsx`
- Updated JSDoc comment to mention FIN-6.
- Added `cachedLedger` state (initially `[]`, populated via `onLedgerLoaded`, reset when party changes). This will be used by FIN-7's Insights tab.
- `cachedLedger` reset in the `party.party_name` effect.
- `FinLedgerTab` now receives `fetchLabels`, `setLabel`, `addCustomLabel`, `deleteCustomLabel`, `onLedgerLoaded={setCachedLedger}`.

### 7. `src/pages/AdminFinancial.jsx`
- Added `fetchLabels, setLabel, addCustomLabel, deleteCustomLabel` to the `useFinancial` destructure.
- Added all four to `slideOverHooks` object passed to `FinSlideOver`.

---

## Files NOT Changed

- `sync/fin_sync_core.py` — no change (sync never touches labels)
- `sync/fin_sync_tool_tab.py` — no change
- `src/components/financial/FinPdfExport.jsx` — no change
- `src/components/financial/FinOutstandingTab.jsx` — no change
- `src/components/financial/FinContactTab.jsx` — no change
- `src/components/financial/FinPartyCard.jsx` — no change
- `src/components/financial/FinPartyList.jsx` — no change
- `src/components/financial/FinDashboardCards.jsx` — no change
- All non-financial files — never touched

---

## Non-Obvious Decisions

1. **`crypto.randomUUID()` instead of a uuid package.** All modern browsers and Node 14.17+ support `crypto.randomUUID()` natively. No dependency needed.

2. **No FK from `fin_ledger_labels` to `fin_ledger`.** This is intentional. The sync tool does `DELETE + re-insert` on `fin_ledger` after every sync. A CASCADE FK would delete all labels every sync. The composite unique key `(party_type, party_name, txn_date, vch_no)` is stable — these values come from Tally and don't change between syncs.

3. **`not_reviewed` is implicit, not stored.** Rows with no entry in `fin_ledger_labels` are implicitly "not reviewed". Selecting `not_reviewed` in the picker calls `setLabel(..., null)` which deletes the row. This keeps the table small and avoids inserting a row for every transaction in the system.

4. **Filter strip uses horizontal scroll (not wrapping) on the filter row itself.** The masterplan specified wrapping for the *party list* filter (BUG-5, FIN-5). The *ledger* filter strip is different — it's inside the slide-over panel which already has limited height, and the filter options are many (up to ~25 with custom labels). Horizontal scroll is intentional here and has `scrollbarWidth: none` to keep it clean.

5. **`FinLabelPicker` is positioned as a fixed bottom sheet on mobile and an absolute popover on desktop.** The absolute positioning is `right-0 top-full` of the LabelPill button's parent cell. On desktop the table row provides enough context. On mobile the full-screen approach is used because table cells are too small to anchor a popover.

6. **`cachedLedger` in FinSlideOver is populated but not yet used.** It is wired up now (via `onLedgerLoaded` prop on FinLedgerTab) so FIN-7 can simply pass `cachedLedger` to `FinInsightsTab` without any additional prop drilling refactor.

---

## What the Next Phase (FIN-7) Must Know

- `FinSlideOver` now has `cachedLedger` state. FIN-7 should add an `Insights` tab (4th tab) and pass `cachedLedger` as `ledgerRows` prop to `FinInsightsTab`.
- Add `{ id: 'insights', label: 'Insights', Icon: BarChart2 }` to the `TABS` array in `FinSlideOver.jsx`.
- `FinInsightsTab` should also accept `outstandingRows` — it will need to trigger its own fetch if outstanding data isn't cached yet.
- The label system tables (`fin_ledger_labels`, `fin_custom_labels`) must never be touched by the sync tool. This is already correct — the sync tool was never modified to touch them.

---

## Supabase Setup for FIN-6

**Run the migration before testing:**
```sql
-- Run the contents of: supabase/migrations/003_fin_labels.sql
```

This creates `fin_ledger_labels`, `fin_custom_labels`, and their RLS policies.

**Verify no CASCADE:**
The migration intentionally does NOT add a foreign key from `fin_ledger_labels` to `fin_ledger`.
Confirm this is the case — running `\d fin_ledger_labels` in psql should show no FK constraints.

**No re-sync required for FIN-6.** This phase only adds new tables — existing data is unaffected.
