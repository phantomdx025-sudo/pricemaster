# Financial Reports — Master Plan v2
## PriceMaster Admin Panel Extension — Bug Fixes + Feature Additions

> This document is the **updated single source of truth** for all Claude sessions after Phase FIN-4.
> It supersedes the original masterplan for all phases numbered FIN-5 and above.
> Every session must read this file completely before writing a single line of code.
>
> **Never guess, never invent.** If something is unclear, stop and ask.
> Match existing code quality, CSS variables, component patterns, and file structure exactly.

---

## Project State (as of this document)

All 4 original FIN phases are complete. The app is live at `pricemaster-ivory.vercel.app/admin`.
The current zip is `CURRENTLY_ACTIVE.zip` (`pricemaster_fin4/fin4_build`).

| Item | Detail |
|---|---|
| Framework | React 18 + Vite + Tailwind (class dark mode) |
| Backend | Supabase (Postgres + RLS + Edge Functions) |
| Auth | Supabase Auth for admin; custom bcrypt edge fn for staff |
| Sync tool | Python CTk desktop app (`sync/sync_tool.pyw` + `sync/sync_core.py` + `sync/fin_sync_core.py` + `sync/fin_sync_tool_tab.py`) |
| Styling | CSS variables in `src/index.css`, warm amber/cream palette |
| Icons | `lucide-react@0.383.0` only |
| PDF | `jspdf` + `jspdf-autotable` (installed) |
| Routing | `react-router-dom` v6, admin lives at `/admin/*` |
| PWA | Service worker + manifest in `public/` |
| Deploy | Vercel (`vercel.json` present) |

---

## Known Bugs Diagnosed (Root Causes Confirmed by Reading Real Excel + Code)

### BUG-1 — CRITICAL: Outstanding tab always shows "All invoices cleared" (sync parser bug)

**File:** `sync/fin_sync_core.py` → `_parse_outstanding_sheet()`

**Root cause (confirmed):**
The Outstanding Breakdown sheet structure is:
```
Row N:   "  Aadinath Textiles"  (party name row — all other cols None)
Row N+1: "Total outstanding ₹30,735 = 2 invoice(s) never touched..."  (summary text — all other cols None)
Row N+2: "#" "Date" "Vch Type" ...   (column header row)
Row N+3: 1, date, type, vch#, orig, paid, remaining, reason   (invoice row)
```

The function `_is_party_name_row()` checks: "is col 0 a non-empty string AND all other cols None?"
The "Total outstanding ₹..." summary text rows ALSO pass this check — they are strings with all other cols None.
So `current_party` gets overwritten by `"Total outstanding ₹30,735 = 2 invoice(s)..."` after every real party name.

Result: all 204 invoice rows in the debtors outstanding sheet are stored in `fin_outstanding` under
`party_name = "Total outstanding ₹30,735 = ..."` — not under the actual party name.
When the app fetches `fin_outstanding WHERE party_name = 'Aadinath Textiles'` → 0 rows → shows "All invoices cleared".

**Verified counts:** 204 real party names detected, 204 false-positive "Total outstanding..." names detected.
Every single party's outstanding is broken.

**Fix (exact):** In `_parse_outstanding_sheet()`, add a guard to skip rows where the string
starts with `"Total outstanding"` BEFORE the `_is_party_name_row` check:

```python
for raw_row in ws.iter_rows(min_row=2, values_only=True):
    row = tuple(raw_row) + (None,) * 8
    row = row[:8]

    if _is_all_none(row):
        continue

    # ← ADD THIS GUARD FIRST, before _is_party_name_row
    if isinstance(row[0], str) and row[0].strip().startswith("Total outstanding"):
        continue

    if _is_party_name_row(row):
        current_party = row[0].strip()
        continue
    # ... rest of function unchanged
```

After this fix, the sync must be re-run. The existing bad data in `fin_outstanding` must be deleted
and re-inserted with correct party names. The fix is in the Python sync tool only — no frontend changes needed.

**Also fix the same pattern in `_parse_ledger_sheet()`** — the ledger sheet has a similar "Total outstanding..."
row between parties in some exports (less likely but defensive). Add the same guard there too.

---

### BUG-2 — Desktop Ledger Requires Horizontal Scroll

**File:** `src/components/financial/FinLedgerTab.jsx`

**Root cause:** The `FinSlideOver` panel is `md:w-[480px]`. Inside it, the desktop ledger table
renders 7 columns: Date (20), Type (18), Vch No (18), Narration (auto), Debit (22), Credit (22), Balance (26).
The fixed column widths alone sum to 126px + margins + narration = easily exceeds 480px.
The table has `overflow-x-auto` which adds a scrollbar, but the slide-over itself is only 480px wide
and those fixed column widths leave narration with almost no space, plus headers like "Vch No" truncate.

**Fixes:**
1. Widen the desktop slide-over from `md:w-[480px]` to `md:w-[600px]` in `FinSlideOver.jsx`.
2. In `FinLedgerTab.jsx`, reduce column widths to fit 600px:
   - Date: 22, Type: 20 → but label `"Type"` truncates → use full width in header
   - Remove the `overflow-x-auto` wrapper and instead make the table `table-fixed w-full`
   - Use `min-w-0` + `truncate` on text cells rather than fixed px widths
   - This lets the table fill the panel width naturally.
3. Fix desktop header row so "Vch No." and "Vch Type" are fully visible — use `whitespace-nowrap` on `<th>`.

---

### BUG-3 — PDF: Dates / Vch No. / Vch Type Truncated; Narration Column Wastes Space

**File:** `src/components/financial/FinPdfExport.jsx`

**Root cause:** The PDF ledger table has 7 columns including Narration at `cellWidth: 'auto'`.
Narration cells contain long text (e.g. "Receipt 6713 on 24-Mar-2026 applied ₹9,035 against...").
`overflow: 'ellipsize'` cuts it, but the auto-width narration column greedily takes space,
pushing Date (20mm), Type (18mm), and Vch No (18mm) too narrow → text ellipsizes.

The user wants narration REMOVED from the PDF entirely.

**Fix:**
1. Remove narration column from PDF ledger table completely.
2. Remove narration from data mapping (`lRows`).
3. Redistribute the freed width to Date, Type, Vch No so they never truncate:
   - Date: 26mm (was 20mm)
   - Type: 40mm (was 18mm — vch_type values like "Sudam Nagar GST SALES (25-26)" are long)
   - Vch No: 32mm (was 18mm — vch_no values like "S/MB/0200/26-27")
   - Debit: 26mm (was 22mm)
   - Credit: 26mm (was 22mm)
   - Balance: 32mm (was 26mm)
   - Total = 26+40+32+26+26+32 = 182mm = exactly the content width. Perfect.
4. Update `head` array: remove `'Narration'`
5. Update `body` mapping: remove `r.narration` from row array
6. Remove `columnStyles` entry for col index 3 (Narration), and renumber cols 4→3, 5→4, 6→5

---

### BUG-4 — WhatsApp Share Only Works for Party's Own Number

**File:** `src/components/financial/FinSlideOver.jsx` → `handleWhatsApp`

**Root cause:** The WhatsApp button fetches `contact.mobile` for the party and opens
`wa.me/91{mobile}`. If the party has no mobile, it shows an error. There is no way to
send to a custom number (e.g. your own phone, a colleague, or a different contact for the same party).

**Fix:** When WhatsApp is tapped, show a small inline input within the share sheet asking:
- "Send to:" with a pre-filled value of the party's mobile (if known), or empty
- A "Send" button that opens WhatsApp with whatever number is in the field
- A cancel link to dismiss
- The PDF is generated and downloaded regardless of the number entered

This replaces the direct `handleWhatsApp` → `wa.me` open. The input should appear inline
inside the share popover/sheet, not in a separate modal.

---

### BUG-5 — Mobile UI Messy in Financial Section

**Files:** `src/components/financial/FinPartyCard.jsx`, `src/components/financial/FinPartyList.jsx`,
`src/pages/AdminFinancial.jsx`, `src/components/financial/FinDashboardCards.jsx`

**Symptoms (from screenshot + code review):**
- Dashboard cards: amount values truncate with `truncate` class on a `text-base` element in a 2-col grid.
  On mobile (375px), each card is ~175px wide. `₹1,43,458` is fine but `₹12,34,56,789` truncates.
- Party list filter strip overflows on mobile — too many filters in one line.
- Slide-over on mobile has tab labels cramped (3 tabs with icons).

**Fixes:**
1. Dashboard cards: replace `truncate` with `break-all` or `text-sm` for very large amounts.
   Better: use `text-sm` on amounts >7 chars, `text-base` otherwise. Or just always `text-sm` on mobile.
   Add `md:text-base` so desktop is unchanged. Remove `truncate` class.
   Also increase card `p-3` on mobile for breathing room.
2. Party filter strip: wrap filters into 2 rows on mobile using `flex-wrap` instead of `overflow-x-auto`.
   Or keep horizontal scroll but add a visual fade-right indicator so user knows it scrolls.
3. Tab labels in slide-over: on mobile (bottom sheet) the 3 tabs are full-width split equally.
   Current `text-xs` + icon is fine at 375px. If any label is still cramped, remove icons on mobile
   (show icons on desktop, text-only on mobile).

---

### BUG-6 — Dashboard Card Values Truncate with "..."

**File:** `src/components/financial/FinDashboardCards.jsx`

**Root cause:** The `Card` component uses `truncate` (CSS `text-overflow: ellipsis`) on the value `<p>`.
Large Indian currency amounts like `₹12,34,56,789` (12.3 crore) overflow the card width and get cut off.

**Fix:** Remove `truncate` from the value `<p>`. Instead use `text-sm` always (not `text-base`) — this
ensures even large amounts fit. The `sub` line also has `truncate` — keep that one since dates/counts
are usually short. Add `leading-tight` if not already present. The amount should wrap to 2 lines if needed.

---

## New Features Required

---

### FEATURE-1 — Ledger Row Labelling System

**What it does:** When viewing any party's Ledger tab in the slide-over, each transaction row gets
a status label. Labels persist across syncs (stored in Supabase, not derived from Excel).

**Labels available:**
1. System labels (always available, cannot be deleted):
   - `Checked ✓` — reviewed and confirmed correct
   - `Make Receipt` — needs a receipt to be created
   - `Send for Checking` — flagged to send to someone for verification
   - `Not Reviewed Yet` — default/initial state (visually subtle, like a grey dot)
2. Custom labels — admin can create their own label names + pick a colour from a preset palette.
   Custom labels are global (apply across all parties, all ledger entries).

**How it looks:**
- Each ledger row (both mobile card and desktop table) has a small label pill on the right.
- Tap the pill → opens a small dropdown/popover with all available labels. Tap one to apply.
- Tap the same label again → removes it (toggle).
- A row can have only ONE label at a time (not multi-label).
- Rows with `Not Reviewed Yet` label show a subtle grey indicator (no text pill — just a dot or nothing).
- Rows with other labels show a coloured pill with label text.

**Filtering:** In the Ledger tab header, add a filter row:
- "All" / "Checked" / "Make Receipt" / "Send for Checking" / "Not Reviewed Yet" / + any custom labels
- Selecting a filter shows only rows with that label (within this party's ledger)
- "All" shows everything

**Data model — new Supabase table** `fin_ledger_labels`:
```sql
CREATE TABLE IF NOT EXISTS fin_ledger_labels (
  id           SERIAL PRIMARY KEY,
  ledger_id    INTEGER NOT NULL,   -- references fin_ledger.id
  party_type   TEXT NOT NULL,
  party_name   TEXT NOT NULL,
  label_key    TEXT NOT NULL,      -- 'checked' | 'make_receipt' | 'send_for_checking' | 'not_reviewed' | custom UUID
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ledger_id)                -- one label per ledger row
);

CREATE TABLE IF NOT EXISTS fin_custom_labels (
  id         SERIAL PRIMARY KEY,
  label_key  TEXT NOT NULL UNIQUE,   -- UUID generated client-side
  label_name TEXT NOT NULL,
  color_hex  TEXT NOT NULL,          -- e.g. '#e74c3c'
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**RLS:**
```sql
ALTER TABLE fin_ledger_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_custom_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin public read ledger_labels"  ON fin_ledger_labels FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "fin admin write ledger_labels"  ON fin_ledger_labels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fin admin update ledger_labels" ON fin_ledger_labels FOR UPDATE TO authenticated USING (true);
CREATE POLICY "fin admin delete ledger_labels" ON fin_ledger_labels FOR DELETE TO authenticated USING (true);

CREATE POLICY "fin public read custom_labels"  ON fin_custom_labels FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "fin admin write custom_labels"  ON fin_custom_labels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fin admin delete custom_labels" ON fin_custom_labels FOR DELETE TO authenticated USING (true);
```

**Sync safety:** Labels are stored by `ledger_id` (the Supabase `fin_ledger.id`). The sync tool
does DELETE + re-insert for `fin_ledger`. After re-insert, the `id` values will be different.
**This means labels keyed on `ledger_id` will become orphaned after every sync.**

**Solution — composite key instead of `ledger_id`:** Use `(party_type, party_name, txn_date, vch_no)`
as the stable identity for a ledger row. These values come from Tally and don't change between syncs.
Rename the table approach:

```sql
CREATE TABLE IF NOT EXISTS fin_ledger_labels (
  id           SERIAL PRIMARY KEY,
  party_type   TEXT NOT NULL,
  party_name   TEXT NOT NULL,
  txn_date     DATE,
  vch_no       TEXT,
  label_key    TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(party_type, party_name, txn_date, vch_no)  -- stable identity
);
```

When loading ledger rows, fetch labels for the party in one query:
```js
supabase.from('fin_ledger_labels')
  .select('*')
  .eq('party_type', partyType)
  .eq('party_name', partyName)
```

Then join client-side: match `(txn_date, vch_no)` to attach label to each row.
Rows with no matching label entry = `Not Reviewed Yet` implicitly.

**Colour palette for custom labels** (preset, user picks from these):
`#e74c3c` (red), `#e67e22` (orange), `#f1c40f` (yellow), `#2ecc71` (green),
`#3498db` (blue), `#9b59b6` (purple), `#1abc9c` (teal), `#95a5a6` (grey)

**Components to create/modify:**
- New: `src/components/financial/FinLabelPicker.jsx` — dropdown with all labels + "Manage labels" link
- New: `src/components/financial/FinLabelManager.jsx` — small panel to add/delete custom labels (accessible from Contact tab or a settings icon in ledger)
- Modified: `src/components/financial/FinLedgerTab.jsx` — add label pill to each row, filter strip at top
- Modified: `src/hooks/useFinancial.js` — add `fetchLabels(partyType, partyName)`, `setLabel(...)`, `fetchCustomLabels()`, `addCustomLabel(...)`, `deleteCustomLabel(...)`

---

### FEATURE-2 — WhatsApp to Custom Number

Already described in BUG-4. This is both a bug fix and a feature enhancement.

When user taps WhatsApp in the share sheet:
1. An inline input appears within the share popover: "Mobile number:" pre-filled with party's number (if known), empty otherwise.
2. Country code `+91` is prepended as a fixed label (non-editable), user enters 10-digit number.
3. "Open WhatsApp" button and a "Cancel" link.
4. PDF downloads simultaneously regardless.
5. If field is empty when "Open WhatsApp" is tapped → toast error "Enter a mobile number".

---

### FEATURE-3 — Party Financial Insights Panel (Extra Feature)

**What:** A 4th tab in the slide-over: `Insights`. Shows auto-computed analytics for the party.

**Shown for Debtors (Receivable):**
- Average days to pay (computed from ledger: avg gap between invoice date and receipt date)
- Last payment date + amount
- Longest outstanding invoice age (from outstanding tab data)
- Total invoices this year vs last year
- Payment trend: "Payments increasing ↑ / decreasing ↓ / stable →" based on last 6 months

**Shown for Creditors (Payable):**
- Total paid this year
- Last payment made (date + amount)
- Largest single payable outstanding

**Implementation:** All computed client-side from `fin_ledger` and `fin_outstanding` data already fetched.
No new Supabase queries needed.

**Component:** `src/components/financial/FinInsightsTab.jsx`

Add `{ id: 'insights', label: 'Insights', Icon: BarChart2 }` to `TABS` in `FinSlideOver.jsx`.

---

### FEATURE-4 — Sync: Additive Labels/Notes (Never Overwrite)

**What:** The sync tool already does DELETE + re-insert for `fin_parties`, `fin_ledger`, `fin_outstanding`.
This is correct for financial data (always fresh from Tally). However `fin_party_notes`, `fin_pinned`,
`fin_ledger_labels`, and `fin_custom_labels` must NEVER be deleted during sync.

**Current state:** The sync tool already doesn't touch `fin_party_notes` or `fin_pinned` — they are
written only by the app, never by the sync tool. This is correct and must stay that way.

**New requirement:** `fin_ledger_labels` and `fin_custom_labels` (from FEATURE-1) must also never
be touched by the sync tool. The sync tool's DELETE operations on `fin_ledger` do NOT cascade to
`fin_ledger_labels` (no FK). Confirm this in the SQL migration — do NOT add a CASCADE foreign key.

**Documentation only** — no code change needed for sync tool itself, just confirm the new tables
don't have CASCADE delete. This is a constraint to verify during FEATURE-1 implementation.

---

## Phases

---

## Phase FIN-5 — Critical Bug Fixes

**Goal:** Fix all 6 bugs listed above. No new features. After this phase the app must work correctly:
outstanding tab shows real data, desktop ledger fits without scrollbar, PDF has no narration and
all columns fully visible, WhatsApp can use a custom number, mobile UI is clean, dashboard values untruncated.

### Deliverables

1. **`sync/fin_sync_core.py`** — Fix BUG-1:
   - In `_parse_outstanding_sheet()`: add guard before `_is_party_name_row` to skip rows where
     `row[0].strip().startswith("Total outstanding")`.
   - Same guard in `_parse_ledger_sheet()` as a defensive measure.
   - After this fix, re-sync is required (instructions in README).

2. **`src/components/financial/FinSlideOver.jsx`** — Fixes for BUG-2, BUG-4:
   - Change `md:w-[480px]` to `md:w-[600px]` (BUG-2).
   - Replace direct WhatsApp open with inline number input within share sheet (BUG-4).
     - When WhatsApp option is clicked, the share popover shows an input row instead of immediately opening.
     - Input is pre-filled with party's mobile (fetched from contact, if available).
     - `+91` prefix shown as fixed text, 10-digit input field, "Open WhatsApp" button, "← Back" link.
     - On "Open WhatsApp": validate non-empty, download PDF, open `wa.me/91{number}?text=...`
     - On "← Back": return to main share options list.

3. **`src/components/financial/FinLedgerTab.jsx`** — Fix BUG-2:
   - Remove `overflow-x-auto` wrapper.
   - Make table `table-fixed w-full`.
   - Columns use percentage widths: Date 12%, Type 18%, Vch No 16%, Debit 16%, Credit 16%, Balance 22%.
   - All cells `truncate` (last resort) but with generous widths.
   - `<th>` elements use `whitespace-nowrap` so headers never truncate.

4. **`src/components/financial/FinPdfExport.jsx`** — Fix BUG-3:
   - Remove Narration column entirely from ledger table.
   - New column widths (total = 182mm): Date 26, Type 40, VchNo 32, Debit 26, Credit 26, Balance 32.
   - Update `head`, `body`, `columnStyles` accordingly.
   - Remove narration from `lRows` mapping.
   - Renumber columnStyles: 0=Date, 1=Type, 2=VchNo, 3=Debit, 4=Credit, 5=Balance.

5. **`src/components/financial/FinDashboardCards.jsx`** — Fix BUG-5, BUG-6:
   - Remove `truncate` from value `<p>`. Replace with `text-sm md:text-base leading-tight break-words`.
   - Add `min-w-0` to the text container div.
   - Sub label: keep `truncate` (it's fine for short strings like "123 parties").

6. **`src/components/financial/FinPartyList.jsx`** — Fix BUG-5:
   - Filter strip: change from `flex overflow-x-auto` to `flex flex-wrap gap-2` so filters wrap
     to a second line on mobile instead of requiring horizontal scroll.
   - Each filter pill: `flex-shrink-0` min touch target 36px height.

### Files NOT Changed in FIN-5
- `src/pages/AdminFinancial.jsx` — no change
- `src/components/financial/FinPartyCard.jsx` — no change
- `src/components/financial/FinContactTab.jsx` — no change
- `src/components/financial/FinOutstandingTab.jsx` — no change (the bug was in sync, not here)
- `src/hooks/useFinancial.js` — no change (fetchOutstanding query is correct)
- All non-financial files — never touch

### Session Handoff After FIN-5
- Write `README/phase_fin5_done.md` with full detail.
- The most important post-FIN-5 action: **run the sync tool again** (delete old fin_outstanding data,
  re-sync debtors and creditors) to get correct data into the database. The session cannot do this
  (it has no Supabase credentials) but must document it clearly.
- Include a SQL snippet for manual cleanup if needed:
  ```sql
  DELETE FROM fin_outstanding WHERE party_type = 'debtor';
  DELETE FROM fin_outstanding WHERE party_type = 'creditor';
  -- Then re-run sync tool for debtors and creditors.
  ```

---

## Phase FIN-6 — Ledger Label Feature

**Goal:** Add the ledger row labelling system. Every ledger row can be tagged with a status label.
Labels survive syncs. Admin can create custom labels. Filters work per-party in the ledger tab.

### Deliverables

1. **`supabase/migrations/003_fin_labels.sql`** — Create `fin_ledger_labels` and `fin_custom_labels`
   with correct structure (composite key on `party_type, party_name, txn_date, vch_no`), RLS policies.
   NO foreign keys with CASCADE to `fin_ledger` — labels must survive ledger re-syncs.

2. **`src/components/financial/FinLabelPicker.jsx`** — Label picker popover:
   - Props: `currentLabel`, `labels` (array of {key, name, colorHex}), `onSelect(labelKey)`
   - System labels: Checked, Make Receipt, Send for Checking, Not Reviewed Yet (key: `'checked'`, `'make_receipt'`, `'send_for_checking'`, `'not_reviewed'`)
   - Custom labels: rendered below a divider
   - Selecting active label removes it (sets to null / `not_reviewed`)
   - "Manage labels" link at bottom → opens FinLabelManager
   - Closes on outside click or Escape
   - Mobile: renders as bottom sheet. Desktop: small popover anchored to trigger element.

3. **`src/components/financial/FinLabelManager.jsx`** — Manage custom labels:
   - Rendered inline inside the ledger tab header area (toggled by a settings/tag icon)
   - OR as a small modal (use existing `Modal.jsx` pattern)
   - Shows list of custom labels (name + colour dot + delete button)
   - "Add label" form: text input + colour picker (8 preset swatches) + "Add" button
   - Delete: confirm before delete, show toast if label is in use (warn but allow deletion)
   - Max 20 custom labels (enforce client-side)

4. **`src/components/financial/FinLedgerTab.jsx`** (modified) — Add label integration:
   - Fetch `fin_ledger_labels` + `fin_custom_labels` when ledger data loads (via `hooks.fetchLabels`)
   - Build a `Map<'txnDate|vchNo', labelKey>` client-side for O(1) lookup
   - Each `LedgerRow` (desktop) and `LedgerCard` (mobile) receives `label` + `onLabelClick` props
   - Desktop: add an 8th column "Label" (narrow, ~70px) at the far right — shows pill or empty dot
   - Mobile: add label pill to bottom-right of each card
   - Tap pill / dot → opens `FinLabelPicker` for that row
   - Filter strip above ledger: tabs for All, Checked, Make Receipt, Send for Checking, Not Reviewed Yet, + custom labels
   - Filter applies client-side to the already-loaded rows array

5. **`src/hooks/useFinancial.js`** (modified) — Add:
   ```js
   fetchLabels(partyType, partyName)           // → { labels: [], customLabels: [] }
   setLabel(partyType, partyName, txnDate, vchNo, labelKey)  // upsert or delete
   fetchCustomLabels()                          // → fin_custom_labels[]
   addCustomLabel(name, colorHex)               // → insert
   deleteCustomLabel(labelKey)                  // → delete
   ```
   All writes use `supabaseAdmin`.

### Label Display Rules
- `not_reviewed`: show a small grey dot only (no text pill) — unobtrusive
- `checked`: green pill "Checked ✓"
- `make_receipt`: amber pill "Make Receipt"
- `send_for_checking`: blue pill "Send for Checking"
- Custom: coloured pill with custom name, colour = the stored `color_hex`

### Filter Persistence
- Store active filter for current party in component state only (resets when slide-over closes).
- Do NOT store filter in URL or localStorage.

### Session Handoff After FIN-6
- Write `README/phase_fin6_done.md`.
- SQL migration `003_fin_labels.sql` must be run in Supabase before testing.

---

## Phase FIN-7 — Financial Insights Tab

**Goal:** Add a 4th "Insights" tab to the slide-over with auto-computed analytics per party.
All computed client-side — no new Supabase queries beyond what's already fetched for Ledger + Outstanding tabs.

### Deliverables

1. **`src/components/financial/FinInsightsTab.jsx`** — New component:
   - Props: `party`, `partyType`, `ledgerRows` (passed from FinSlideOver after ledger is loaded), `outstandingRows`
   - Computes all metrics client-side (no fetch needed if ledger already loaded)
   - If ledger not yet loaded: shows skeleton + triggers load

   **Metrics for Debtors:**
   - Closing balance + status (prominent at top — already in header but repeat here with breakdown)
   - Last payment received: date + amount (last `credit > 0` row in ledger)
   - Days since last payment (from last credit row to today)
   - Oldest outstanding invoice age (max days since `inv_date` from outstanding rows)
   - Invoice count this financial year vs last (April-March; count `debit > 0` rows)
   - Monthly payment trend sparkline (last 6 months: total credit per month — simple SVG bar chart using CSS variables)

   **Metrics for Creditors:**
   - Closing balance + status
   - Last payment made: date + amount (last `debit > 0` row)
   - Days since last payment
   - Total paid this financial year (sum of `debit` rows this year)
   - Largest outstanding payable (max `remaining` from outstanding rows)

   **UI:** Card grid (2 cols on mobile, 3 cols on desktop) with icon + label + value.
   Sparkline chart: simple 6-bar chart using inline SVG, bars coloured by `var(--brand)`.

2. **`src/components/financial/FinSlideOver.jsx`** (modified):
   - Add `{ id: 'insights', label: 'Insights', Icon: BarChart2 }` to `TABS` array.
   - Pass `ledgerRows` state from `FinLedgerTab` up to `FinSlideOver` so `FinInsightsTab` can use it.
   - Pattern: `FinSlideOver` maintains `cachedLedger` state, populated when Ledger tab first loads.
     Pass `onLoaded(rows)` callback to `FinLedgerTab`, which calls it after fetch completes.
     Pass `cachedLedger` to `FinInsightsTab` as `ledgerRows` prop.

### Session Handoff After FIN-7
- Write `README/phase_fin7_done.md`.
- No Supabase changes needed.

---

## Cross-Phase Rules (Every Session Must Follow)

### 1. Never Break Existing Features
`AdminCatalogue`, `AdminStaff`, all existing hooks, the existing sync push/pull — untouched unless the
file is explicitly listed in "Files to Modify" for the current phase.

### 2. CSS / Styling
- All colours via CSS variables — never hardcode hex in JSX.
- Exception: PDF generation (`FinPdfExport.jsx`) uses hardcoded RGB arrays because jsPDF doesn't read CSS vars. This is intentional.
- Tailwind only for layout/spacing/flex/grid.
- Test mentally: does it look right in both light AND dark mode?

### 3. Amount Formatting
```js
const fmt = (n) => `₹${Math.abs(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
```

### 4. Loading States
Use existing `Spinner.jsx` for full-area loading, `Skeleton.jsx` for list/table loading.

### 5. Error States
Use existing `toast` from `src/components/ui/Toast.jsx` for transient errors.

### 6. Mobile First
- Every component must work on 375px wide screen.
- Touch targets minimum 44px height.
- No horizontal overflow.

### 7. Supabase Client Usage
- Public reads: `supabase` from `src/lib/supabase.js` (anon key)
- Admin writes: `supabaseAdmin` from `src/lib/supabaseAdmin.js` (service role, only inside admin routes)

### 8. File Naming
React components: PascalCase `.jsx` | Hooks: camelCase `useXxx.js` | Python: snake_case

### 9. Labels Must Survive Sync
`fin_ledger_labels` and `fin_custom_labels` are NEVER touched by the sync tool.
The sync tool only writes: `fin_parties`, `fin_ledger`, `fin_outstanding`, `fin_address`, `fin_sync_log`.

### 10. No Console Logs in Production
Use `if (import.meta.env.DEV) console.log(...)` guard for all debug logs.

---

## Session Handoff — Required Files Every Time

| File | Every Session | Notes |
|---|---|---|
| Current project zip (output of previous phase) | ✅ Always | Must be the output of the immediately preceding phase |
| This masterplan (`FINANCIAL_REPORTS_MASTERPLAN_v2.md`) | ✅ Always | The single source of truth |
| `README/phase_fin{N}_done.md` (most recent) | ✅ Always | What was built and what to know |
| `SUNDRY_DEBTORS_running_balance.xlsx` | ✅ Always | Especially for FIN-5 (sync fix) |
| `SUNDRY_CREDITORS_running_balance.xlsx` | ✅ Always | Same |
| `Address_Book.xlsx` | ✅ Always | For contact info verification |

---

## Opening Prompt Template

```
I am building Phase FIN-{N} of the Financial Reports feature for PriceMaster.

Attached:
1. [zip] — current project state (output of Phase FIN-{N-1})
2. FINANCIAL_REPORTS_MASTERPLAN_v2.md — updated master plan
3. phase_fin{N-1}_done.md — what was built last phase
4. SUNDRY_DEBTORS_running_balance.xlsx — current Tally export
5. SUNDRY_CREDITORS_running_balance.xlsx — current Tally export
6. Address_Book.xlsx — current address book export

Please read all files, then build Phase FIN-{N} exactly as specified.
Deliver a zip of the updated project + README/phase_fin{N}_done.md inside it.
```

---

## Phase README Format (Every Session Must Write)

Each `phase_fin{N}_done.md` must include:
- What was built (component-level detail)
- Files created (with paths)
- Files modified (with exact changes described)
- Files NOT changed
- Any non-obvious decisions made and why
- What the next phase must know
- Any Supabase setup steps needed (migration SQL, RLS)

---

## Handoff Checklist (Before Ending Each Session)

- [ ] All new files created at correct paths
- [ ] Modified files changed minimally and correctly
- [ ] `README/phase_fin{N}_done.md` written with full detail
- [ ] This masterplan copied into zip unchanged as `README/FINANCIAL_REPORTS_MASTERPLAN_v2.md`
- [ ] Zip delivered to user
- [ ] No `console.log` left in production code
- [ ] No hardcoded colours in JSX (exception: FinPdfExport.jsx RGB arrays)
- [ ] Dark mode tested mentally
- [ ] Mobile layout tested mentally (375px)
- [ ] No invented Supabase table names — only tables defined in this document or the original masterplan

---

## Bug-to-Phase Summary

| # | Phase | Severity | File(s) | Problem |
|---|---|---|---|---|
| BUG-1 | FIN-5 | 🔴 CRITICAL | `sync/fin_sync_core.py` | Outstanding always empty — "Total outstanding..." text rows falsely detected as party names |
| BUG-2 | FIN-5 | 🔴 HIGH | `FinSlideOver.jsx`, `FinLedgerTab.jsx` | Desktop ledger needs horizontal scroll — panel too narrow |
| BUG-3 | FIN-5 | 🟠 HIGH | `FinPdfExport.jsx` | PDF columns truncate; narration wastes space — remove narration, widen other cols |
| BUG-4 | FIN-5 | 🟡 MEDIUM | `FinSlideOver.jsx` | WhatsApp only works for party's own number — add custom number input |
| BUG-5 | FIN-5 | 🟡 MEDIUM | `FinPartyList.jsx`, `FinDashboardCards.jsx` | Mobile UI messy — filter overflow, cramped cards |
| BUG-6 | FIN-5 | 🟡 MEDIUM | `FinDashboardCards.jsx` | Dashboard amounts truncate with "..." — remove truncate class |

## Feature-to-Phase Summary

| # | Phase | Feature |
|---|---|---|
| FEATURE-1 | FIN-6 | Ledger row label system with filters (Checked, Make Receipt, Send for Checking, Not Reviewed, Custom) |
| FEATURE-2 | FIN-5 | WhatsApp to custom number (combined with BUG-4 fix) |
| FEATURE-3 | FIN-7 | Financial insights tab (analytics per party, client-side computed) |
| FEATURE-4 | FIN-6 | Additive sync (labels/notes never overwritten — verified, not re-coded) |

---

*Masterplan v2.0 — written after thorough reading of all code, real Excel files, and all phase READMEs.*
*Supersedes FINANCIAL_REPORTS_MASTERPLAN.md for all phases FIN-5 onward.*
*Place this file at `README/FINANCIAL_REPORTS_MASTERPLAN_v2.md` inside the project zip for every phase.*
