# Phase FIN-5 — Critical Bug Fixes

## What Was Built

All 6 bugs from the masterplan were fixed. No new features were added.

---

## Files Created

*(none — this phase only modifies existing files)*

---

## Files Modified

### 1. `sync/fin_sync_core.py` — BUG-1 (CRITICAL)

**Problem:** The `_parse_outstanding_sheet()` function was falsely detecting "Total outstanding ₹30,735 = 2 invoice(s) never touched..." summary text rows as party name rows. Both the real party name row AND the summary text row have a string in col 0 and all other columns None — so `_is_party_name_row()` returned `True` for both. After the summary row, `current_party` was overwritten with the summary text. All 204+ outstanding invoice rows were stored under `party_name = "Total outstanding ₹..."`, so every query like `WHERE party_name = 'Aadinath Textiles'` returned 0 rows.

**Fix in `_parse_outstanding_sheet()`:** Added a guard **before** `_is_party_name_row`:
```python
if isinstance(row[0], str) and row[0].strip().startswith("Total outstanding"):
    continue
```

**Defensive fix in `_parse_ledger_sheet()`:** Same guard added defensively — some Tally export variants may include this row in the ledger sheet too.

**⚠️ IMPORTANT — Action Required After Deploying This Fix:**
The existing data in `fin_outstanding` was inserted with corrupted party names. You must delete and re-sync:
```sql
DELETE FROM fin_outstanding WHERE party_type = 'debtor';
DELETE FROM fin_outstanding WHERE party_type = 'creditor';
-- Then re-run the sync tool for both Debtors and Creditors.
```
After re-sync, all Outstanding tabs will show real data.

---

### 2. `src/components/financial/FinSlideOver.jsx` — BUG-2 + BUG-4

**BUG-2 fix:** Changed `md:w-[480px]` to `md:w-[600px]` on the panel div. This gives the desktop ledger table enough space to display all columns without needing a horizontal scrollbar.

**BUG-4 fix (WhatsApp custom number):** Replaced the direct `handleWhatsApp → wa.me` flow with a two-step inline flow:
- Tapping "WhatsApp" in the share sheet now calls `handleWhatsAppClick`, which pre-fetches the party's mobile number and sets `waMode = true`.
- The share popover switches to a number-input view showing:
  - "← Back" link to return to main options
  - "+91" fixed prefix + 10-digit number input (pre-filled with party's mobile if available)
  - "Open WhatsApp" button (validates non-empty, generates + downloads PDF simultaneously, then opens `wa.me/91{number}?text=...`)
  - Loading state while PDF is generating
- Input restricted to digits only, max 10 characters.
- Empty or short number shows toast error "Enter a valid 10-digit mobile number".
- Added `ArrowLeft` to imports from lucide-react.

---

### 3. `src/components/financial/FinLedgerTab.jsx` — BUG-2

**Problem:** 7-column table inside a 480px panel required horizontal scroll. Narration column greedily consumed space.

**Fix:**
- Removed `overflow-x-auto` wrapper from desktop table.
- Changed table to `table-fixed w-full` — fills panel width naturally.
- Removed Narration column from desktop table entirely (narration is still shown on mobile cards where there's more vertical room).
- Column widths as percentages: Date 13%, Type 22%, Vch No. 18%, Debit 16%, Credit 16%, Balance 15%.
- All `<th>` headers use `whitespace-nowrap` — "Vch No." and other headers never truncate.
- Type and Vch No cells use `truncate` with `title` attribute for overflow tooltip.
- Renamed parameter `pinned` → `highlighted` (more accurate — it highlights first and last rows).

---

### 4. `src/components/financial/FinPdfExport.jsx` — BUG-3

**Problem:** Narration column used `cellWidth: 'auto'` and consumed most of the 182mm content width, leaving Date (20mm), Type (18mm), Vch No (18mm) too narrow — values truncated with ellipsis.

**Fix:**
- Removed Narration column from PDF ledger table entirely.
- New column widths (total = 182mm = exact content width):
  - Date: 26mm (was 20mm)
  - Type: 40mm (was 18mm — Tally vch_type values like "Sudam Nagar GST SALES (25-26)" are long)
  - Vch No.: 32mm (was 18mm — values like "S/MB/0200/26-27" need space)
  - Debit: 26mm (was 22mm)
  - Credit: 26mm (was 22mm)
  - Balance: 32mm (was 26mm)
- Updated `head` array: `['Date', 'Type', 'Vch No.', 'Debit', 'Credit', 'Balance']`
- Updated `body` mapping: removed `r.narration`
- Updated `lRows` mapping: removed `narration` field
- Removed `columnStyles` entry for old index 3 (Narration), renumbered: Debit=3, Credit=4, Balance=5
- `willDrawCell` balance colour now checks `data.column.index === 5` (was 6)

---

### 5. `src/components/financial/FinDashboardCards.jsx` — BUG-5, BUG-6

**Problem:** Value `<p>` had `truncate` class. Large Indian currency amounts like ₹12,34,56,789 got cut off with "..." on narrow 2-column mobile grid cards.

**Fix:**
- Removed `truncate` from the value `<p>`.
- Replaced with `text-sm md:text-base leading-tight break-words` — `text-sm` on all screens ensures even large amounts fit; `md:text-base` restores the original desktop size; `break-words` lets the value wrap to a second line if truly needed rather than clipping.
- `min-w-0` already present on the container div — no change needed there.
- Sub label `truncate` left unchanged (dates/counts are short enough).

---

### 6. `src/components/financial/FinPartyList.jsx` — BUG-5

**Problem:** Filter chip strip used `overflow-x-auto` on mobile. Users couldn't see that additional filters existed off-screen and had to scroll horizontally to find them.

**Fix:**
- Changed `overflow-x-auto scrollbar-hide` to `flex-wrap` on the filter chip container.
- Filters now wrap to a second line on mobile (375px) instead of requiring horizontal scroll.
- Added `minHeight: '36px'` to each filter pill to ensure comfortable touch targets.
- `flex-shrink-0` kept on each pill so they don't compress.

---

## Files NOT Changed

Per the masterplan spec, these files were untouched:
- `src/pages/AdminFinancial.jsx`
- `src/components/financial/FinPartyCard.jsx`
- `src/components/financial/FinContactTab.jsx`
- `src/components/financial/FinOutstandingTab.jsx`
- `src/hooks/useFinancial.js`
- All non-financial files (AdminCatalogue, AdminStaff, hooks, sync_core.py, etc.)

---

## Non-Obvious Decisions

1. **Narration removed from desktop table but kept on mobile cards.** On mobile, each row is a card with its own vertical space — narration reads naturally. On desktop, the horizontal table layout was the source of the overflow bug, so removing narration was the correct fix there. The PDF also had narration removed (BUG-3) for the same reason.

2. **LedgerRow `pinned` prop renamed to `highlighted`.** The first and last rows being visually highlighted has nothing to do with the pinning feature (which pins entire parties). The rename avoids confusion with the party-pin system built in FIN-3.

3. **WhatsApp back navigation uses state (`waMode`) not a separate component.** Keeping it within the share popover state machine avoids prop-drilling and keeps the UI in one place. The share popover conditionally renders either the options list or the number input based on `waMode`.

4. **`+91` country prefix is a static `<span>`, not part of the input.** This avoids users accidentally deleting the country code. The actual `wa.me` URL is built by prepending `91` to the validated 10-digit input, so no parsing needed.

---

## What the Next Phase (FIN-6) Must Know

- FIN-5 introduces no new Supabase tables or migrations — no DB setup needed for FIN-5.
- The most important post-FIN-5 action is **re-running the sync tool** after deploying the `fin_sync_core.py` fix. The corrupted `fin_outstanding` data must be cleared first with the SQL snippet above.
- FIN-6 adds `fin_ledger_labels` and `fin_custom_labels` tables. These must NOT have CASCADE foreign keys to `fin_ledger` (labels must survive ledger re-syncs). The sync tool must never delete from these tables.
- The `FinLedgerTab` component no longer has a Narration column on desktop — FIN-6's label column should be added as the 7th column at the far right of the desktop table.

---

## Supabase Setup for FIN-5

**No migrations needed.** FIN-5 is all frontend + Python sync tool changes.

**Required manual action — run after deploying:**
```sql
-- Clear corrupted outstanding data (party names were wrong before the BUG-1 fix)
DELETE FROM fin_outstanding WHERE party_type = 'debtor';
DELETE FROM fin_outstanding WHERE party_type = 'creditor';
-- Then open the sync tool and re-sync both Debtors and Creditors Excel files.
```

After re-sync, the Outstanding tab will show real invoice data for all parties.
