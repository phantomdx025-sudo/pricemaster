# Phase FIN-4 Done — Sync Tool Extension (Excel → Supabase)

## What Was Built

Phase FIN-4 adds Financial Sync capability to the existing Python CTk sync tool.
The sync tool window now has two tabs: **📦 Inventory** (all existing push/pull content,
unchanged in behaviour) and **💹 Financial** (new, for pushing Tally Excel exports to
Supabase `fin_*` tables).

---

## Files Created

### `sync/fin_sync_core.py`
Standalone parsing + upload module. No GUI code.

**Public API:**
```python
sync_debtors(excel_path, supabase_url, service_role_key, log_callback) → (bool, str)
sync_creditors(excel_path, supabase_url, service_role_key, log_callback) → (bool, str)
sync_address_book(excel_path, supabase_url, service_role_key, log_callback) → (bool, str)
preview_debtors(excel_path) → (party_count, ledger_row_count) | None
preview_creditors(excel_path) → (party_count, ledger_row_count) | None
preview_address_book(excel_path) → entry_count | None
```

**Parsing logic:**
- Party name detection: `_is_party_name_row()` — strip all cols, check rest are all None.
  Does NOT rely on leading-space count (it varies in real exports).
- Summary: reads from row 3+. Columns: `#, Party Name / Vendor Name, Opening Balance,
  Closing Balance/Receivable, Status`.
- Ledger: reads from row 4+. Skips title (row 1), period (row 2), header (row 3), plus
  any repeated header rows that appear between parties.
- Outstanding Breakdown: skips title, summary-text rows, repeated column-header rows.
  Invoice rows are identified by `isinstance(row[0], int)` — the `#` column.
- Dates: `openpyxl` returns `datetime.datetime` objects → converted to `YYYY-MM-DD` ISO strings.
- Amounts: `None → 0.0`. Negative values preserved as-is.
- Cross-validation: after parsing, warns if any party in Summary has non-zero `closing_bal`
  but zero ledger rows were found for it.

**Upload logic:**
- `fin_parties`: DELETE WHERE `party_type=X` then re-insert all (full replace per type).
- `fin_ledger`: DELETE WHERE `party_type=X` then re-insert in chunks of 400.
- `fin_outstanding`: DELETE WHERE `party_type=X` then re-insert in chunks of 400.
- `fin_address`: UPSERT on `party_name` (conflict = update). Not delete-all, to preserve
  data from groups beyond debtors/creditors (e.g. Climax, Redox Group, Expenses Creditors).
- `fin_sync_log`: INSERT one row per sync with `file_type`, `row_count`, `party_count`, `status`.
- On error: attempts to log error row to `fin_sync_log` before returning `(False, msg)`.

**Verified against live Excel exports:**
- Debtors: 246 parties, multiple status values: `Receivable`, `Credit Bal ⚠`
- Creditors: 83 parties, status values: `Payable`, `Settled ✓`, `Overpaid ⚠`
  (NOTE: creditors use `"Overpaid ⚠"` not `"Credit Bal ⚠"` — masterplan docs say
  `"Credit Bal ⚠"` but the actual Tally export uses `"Overpaid ⚠"`. The parser stores
  whatever the file contains — no normalization. The frontend should display as-is.)
- Address Book: 5964 entries, groups including `Sundry Debtors`, `Sundry Creditors`,
  `Interstate Debtors`, `Climax`, `Expenses Creditors`, `Ankush Bhai`, `Naresh`, `Redox Group`

### `sync/fin_sync_tool_tab.py`
`FinancialSyncTab(ctk.CTkFrame)` — the financial sync UI panel.

- Renders inside the "💹 Financial" tab of the `CTkTabview` in `sync_tool.pyw`
- 3 file-picker rows: Debtors Excel, Creditors Excel, Address Book Excel
  - Each has a label, read-only path entry, and Browse button
  - Saves path to `config.json` under `fin_debtors_path`, `fin_creditors_path`, `fin_address_path`
- 3 individual sync buttons: "Sync Debtors", "Sync Creditors", "Sync Address Book"
  - Each calls the corresponding `preview_*` function first and shows a confirmation dialog
  - Preview text: "Found N parties and ~M transactions — proceed?"
  - For Address Book: "Found N address entries — proceed?"
  - Confirmation explains what will happen (DELETE + re-insert for parties/ledger, UPSERT for address)
- 1 "🔄 Sync All 3 Files" button
  - Validates all 3 paths are set before proceeding
  - Shows a combined preview of all 3 in one confirmation dialog
  - Runs all 3 syncs sequentially in one background thread
  - Posts a summary log at the end
- All sync runs on `daemon=True` threads (same pattern as existing push/pull)
- Reuses the parent window's `_log()` callback for output (shared log textbox)
- `_busy` flag prevents concurrent fin syncs
- Amber/orange button colours to visually differentiate from blue (push) and green (pull)

---

## Files Modified

### `sync/sync_tool.pyw`
**Minimal surgical changes only:**

1. **Import added** (1 line after `import sync_core`):
   ```python
   import fin_sync_tool_tab
   ```

2. **`DEFAULT_CONFIG` extended** — 3 new keys back-filled safely:
   ```python
   "fin_debtors_path": "",
   "fin_creditors_path": "",
   "fin_address_path": "",
   ```

3. **Window geometry updated**: `640x700` / minsize `520x560` (was `640x560` / `520x460`)
   — needed to accommodate the tab bar + financial content comfortably.

4. **`_build_ui` refactored**: Wrapped all content in a `CTkTabview` with two tabs:
   - `"📦  Inventory"` — contains all the original DB file picker, Push/Pull buttons, and Log area.
     All existing behaviour preserved verbatim; only the parent container changed from `self`
     to `inv_tab`.
   - `"💹  Financial"` — contains `FinancialSyncTab` instance.
   - Grid row change: `self.grid_rowconfigure(2, weight=1)` (was rows 3 and 4 separately).

   **What did NOT change:** all push/pull methods (`_confirm_push`, `_run_push`,
   `_confirm_pull`, `_run_pull`), validation (`_validate`), log helpers, banner helpers,
   settings, DB browse, window close guard. None of these were touched.

### `sync/requirements.txt`
Added:
```
openpyxl>=3.1.2
```

---

## Files NOT Changed
- All `src/` React files — untouched
- `supabase/migrations/` — untouched (tables already created in FIN-1)
- `sync/sync_core.py` — untouched
- `sync/README.md` — untouched
- `package.json` — untouched

---

## Non-obvious Decisions

1. **CTkTabview over a separator section** — The masterplan said "judge based on current window size".
   The existing window (560px) was already dense with DB picker + Push/Pull + Log. Adding another
   section below the log would push the log area too small. A `CTkTabview` cleanly separates the two
   concerns and lets each tab use the full window area. Inventory users see no change when on that tab.

2. **Creditors status `"Overpaid ⚠"` vs masterplan `"Credit Bal ⚠"`** — The live Tally export uses
   `"Overpaid ⚠"`. The parser stores whatever the file contains, so future Tally exports with different
   labels will also work. The frontend's `FinPartyCard.jsx` status badge logic should be reviewed to
   handle `"Overpaid ⚠"` for creditors (currently it only knows `"Credit Bal ⚠"`).
   
   **Action needed in frontend (minor)**: In `FinPartyCard.jsx` and `FinSlideOver.jsx`, add
   `"Overpaid ⚠"` as a valid status mapped to the warning/amber colour. It is semantically identical
   to `"Credit Bal ⚠"` from the display perspective.

3. **`preview_*` functions use openpyxl read_only** — The preview scan reads only the Summary sheet
   (party count) and counts ledger rows without building the full data list. This makes the preview
   dialog appear quickly (~1-2s for typical files) without the full parse overhead.

4. **Address Book upsert not delete-all** — The address book contains entries from groups beyond
   debtors/creditors (`Climax`, `Redox Group`, `Ankush Bhai`, etc.). A delete-all would wipe these
   on every sync. UPSERT on `party_name` preserves rows not in the latest file (e.g., entries from
   previous exports that are no longer in the current one won't be deleted — this is intentional since
   contact info rarely goes stale). If a full wipe is ever wanted, it must be done manually in Supabase.

5. **`_busy` flag in `FinancialSyncTab` vs parent `_set_buttons_enabled`** — The parent window's
   `_set_buttons_enabled` walks all CTk buttons in the entire window, including the financial tab buttons.
   This means: if an inventory push/pull is running, financial sync buttons are also disabled (correct).
   If a financial sync is running, `_busy=True` prevents a second financial sync. The parent's
   `_set_buttons_enabled` is only called by inventory push/pull — it does not interfere with fin syncs
   that have already started, only blocks new ones from starting while it's disabled.

6. **No changes to existing push/pull flow** — `_validate()` still checks for `db_path`. Financial
   sync has its own validation in `FinancialSyncTab._validate_creds()`. There's no shared validation
   for fin paths at the window level because the fin tab manages its own state.

---

## Supabase Setup Steps Required

None new — all `fin_*` tables were created in FIN-1 (`supabase/migrations/002_fin_init.sql`).

The sync tool uses the service_role key already stored in `config.json` under `service_role_key`.
No new Supabase credentials are needed.

---

## Frontend Note (for future reference)

The `FinancialSyncTab` status badge system in `FinPartyCard.jsx` should handle these actual values
from the live Tally export:

**Debtors:** `"Receivable"`, `"Credit Bal ⚠"`, (and presumably `"Settled ✓"` for paid parties)
**Creditors:** `"Payable"`, `"Settled ✓"`, `"Overpaid ⚠"`

The frontend was built expecting `"Credit Bal ⚠"` for creditors but the live data uses `"Overpaid ⚠"`.
This only affects the status badge colour — everything else (closing_bal, amounts, ledger) is correct.

---

## Installation Instructions (for the end user)

1. Copy `fin_sync_core.py` and `fin_sync_tool_tab.py` into the `sync/` folder alongside `sync_tool.pyw`.
2. Install the new dependency:
   ```
   pip install openpyxl>=3.1.2
   ```
   Or run `pip install -r requirements.txt` to install/refresh all dependencies.
3. Launch `sync_tool.pyw` as usual. The "💹 Financial" tab will appear automatically.
4. Click the Financial tab, browse to each Excel file, and use the sync buttons.
