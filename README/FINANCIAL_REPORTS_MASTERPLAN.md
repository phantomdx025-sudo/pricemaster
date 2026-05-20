# Financial Reports — Master Plan
## PriceMaster Admin Panel Extension

> This document is the single source of truth for all Claude sessions building the
> Financial Reports feature. Each phase produces a working zip + its own
> `README/phase_fin{N}_done.md` inside the project. Hand both to the next session.
>
> **Never guess, never invent.** If something is unclear, stop and ask.
> Match existing code quality, CSS variables, component patterns, and file structure exactly.

---

## Project Snapshot (what exists before Phase FIN-1)

| Item | Detail |
|---|---|
| Framework | React 18 + Vite + Tailwind (class dark mode) |
| Backend | Supabase (Postgres + RLS + Edge Functions) |
| Auth | Supabase Auth for admin; custom bcrypt edge fn for staff |
| Existing admin sections | Catalogue, Staff |
| Sync tool | Python CTk desktop app (`sync/sync_tool.pyw` + `sync/sync_core.py`) |
| Styling | CSS variables in `src/index.css`, warm amber/cream palette |
| Icons | `lucide-react@0.383.0` only |
| Search | `fuse.js` already in `package.json` |
| Routing | `react-router-dom` v6, admin lives at `/admin/*` |
| PWA | Service worker + manifest in `public/` |
| Deploy | Vercel (`vercel.json` present) |

---

## Data Sources

> ⚠️ All party counts, ledger row counts, and address book sizes below are from the
> **sample export used during planning**. The actual numbers will vary with every sync.
> All code must be written to handle any count — never assume a fixed number of parties,
> ledger entries, or address book rows. The sync tool dynamically reads whatever is in
> the Excel at sync time.


### 1. Sundry Debtors Excel
- **Variable number of parties** (1,287 in current export — will change with each sync)
- 3 sheets: `Ledger with Running Balance`, `Summary`, `Outstanding Breakdown`
- Summary columns: `#, Party Name, Opening Balance (₹), Closing Receivable (₹), Status`
- Status values: `Receivable`, `Settled ✓`, `Credit Bal ⚠`
- Ledger columns: `Date, Vch Type, Vch No., Particulars/Narration, Debit (₹), Credit (₹), Running Balance (₹)`
- Ledger structure: party name row (`"  Party Name"` — two leading spaces, rest of cols None) → transactions → blank row → next party
- Outstanding breakdown: only parties with non-zero outstanding. Same party-name-row pattern. Per-invoice: `#, Date, Vch Type, Vch No., Original (₹), Paid So Far (₹), Remaining (₹), Reason`
- **Parties with zero outstanding do NOT appear in Outstanding Breakdown sheet — this is correct and expected**
- ~20,045 ledger rows in sample export — scales with party count and transaction history

### 2. Sundry Creditors Excel
- **Variable number of parties** (200 in sample export — grows with each sync)
- Same 3-sheet structure as Debtors
- Summary columns: `#, Vendor Name, Opening Balance (₹), Closing Balance (₹), Status`
- Status values: `Payable`, `Settled ✓`, `Credit Bal ⚠` (negative = vendor owes you)
- ~5,630 ledger rows in sample export — scales with party count and transaction history

### 3. Address Book Excel
- **Variable number of parties** (5,963 in sample export — grows with each sync) across groups: `Sundry Debtors`, `Sundry Creditors`, `Interstate Debtors`, `Climax`, `Expenses Creditors`, `Ankush Bhai`, `Naresh`, `Redox Group`
- Columns: `Sr No, Party Name, Address, Group, Pincode, State Name, Contact Person, Phone No, Mobile No, Email, Website, PAN No, GSTIN, Reg Type`
- Fill rates: Address 78%, State 80%, Mobile 44%, GSTIN 56%, PAN 13%, Phone 18%, Email 1%
- Matched to debtors/creditors by party name (case-insensitive, trimmed)

---

## Supabase Tables to Create (SQL migration: `002_fin_init.sql`)

```sql
-- Party summary (one row per party per type)
CREATE TABLE IF NOT EXISTS fin_parties (
  id            SERIAL PRIMARY KEY,
  party_type    TEXT NOT NULL CHECK (party_type IN ('debtor','creditor')),
  party_name    TEXT NOT NULL,
  opening_bal   NUMERIC DEFAULT 0,
  closing_bal   NUMERIC DEFAULT 0,
  status        TEXT,
  synced_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (party_type, party_name)
);

-- Full ledger entries
CREATE TABLE IF NOT EXISTS fin_ledger (
  id          SERIAL PRIMARY KEY,
  party_type  TEXT NOT NULL,
  party_name  TEXT NOT NULL,
  txn_date    DATE,
  vch_type    TEXT,
  vch_no      TEXT,
  narration   TEXT,
  debit       NUMERIC DEFAULT 0,
  credit      NUMERIC DEFAULT 0,
  balance     NUMERIC DEFAULT 0
);

-- Outstanding invoice breakdown (only for parties with outstanding)
CREATE TABLE IF NOT EXISTS fin_outstanding (
  id           SERIAL PRIMARY KEY,
  party_type   TEXT NOT NULL,
  party_name   TEXT NOT NULL,
  inv_date     DATE,
  vch_type     TEXT,
  vch_no       TEXT,
  original_amt NUMERIC DEFAULT 0,
  paid_amt     NUMERIC DEFAULT 0,
  remaining    NUMERIC DEFAULT 0,
  reason       TEXT
);

-- Address book
CREATE TABLE IF NOT EXISTS fin_address (
  id             SERIAL PRIMARY KEY,
  party_name     TEXT NOT NULL UNIQUE,
  address        TEXT,
  party_group    TEXT,
  pincode        TEXT,
  state_name     TEXT,
  contact_person TEXT,
  phone          TEXT,
  mobile         TEXT,
  email          TEXT,
  website        TEXT,
  pan_no         TEXT,
  gstin          TEXT,
  reg_type       TEXT
);

-- Admin notes per party (written in the app, not from Excel)
CREATE TABLE IF NOT EXISTS fin_party_notes (
  id          SERIAL PRIMARY KEY,
  party_type  TEXT NOT NULL,
  party_name  TEXT NOT NULL,
  note_text   TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Pinned parties (admin starred)
CREATE TABLE IF NOT EXISTS fin_pinned (
  id          SERIAL PRIMARY KEY,
  party_type  TEXT NOT NULL,
  party_name  TEXT NOT NULL,
  UNIQUE(party_type, party_name)
);

-- Sync log
CREATE TABLE IF NOT EXISTS fin_sync_log (
  id          SERIAL PRIMARY KEY,
  file_type   TEXT NOT NULL, -- 'debtors' | 'creditors' | 'address_book'
  synced_at   TIMESTAMPTZ DEFAULT now(),
  row_count   INTEGER,
  party_count INTEGER,
  status      TEXT
);

-- RLS: all fin_* tables public read (anon+authenticated), service_role writes
ALTER TABLE fin_parties       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_ledger        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_outstanding   ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_address       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_party_notes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_pinned        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_sync_log      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin public read parties"     ON fin_parties     FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "fin public read ledger"      ON fin_ledger      FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "fin public read outstanding" ON fin_outstanding FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "fin public read address"     ON fin_address     FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "fin public read notes"       ON fin_party_notes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "fin public read pinned"      ON fin_pinned      FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "fin public read sync_log"    ON fin_sync_log    FOR SELECT TO anon, authenticated USING (true);

-- Notes + pinned: admin can also write (authenticated = admin session)
CREATE POLICY "fin admin write notes"  ON fin_party_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fin admin delete notes" ON fin_party_notes FOR DELETE TO authenticated USING (true);
CREATE POLICY "fin admin write pinned" ON fin_pinned FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fin admin delete pinned" ON fin_pinned FOR DELETE TO authenticated USING (true);
```

---

## New Files to Create (all phases combined)

```
src/
├── pages/
│   └── AdminFinancial.jsx            ← Main financial reports page (Phase FIN-1)
├── components/
│   └── financial/
│       ├── FinDashboardCards.jsx     ← Summary cards row (Phase FIN-1)
│       ├── FinPartyList.jsx          ← Sortable/filterable party list (Phase FIN-1)
│       ├── FinPartyCard.jsx          ← Single party row/card (Phase FIN-1)
│       ├── FinSearch.jsx             ← Search with instant results dropdown (Phase FIN-2)
│       ├── FinSlideOver.jsx          ← Slide-over panel shell (Phase FIN-2)
│       ├── FinLedgerTab.jsx          ← Full ledger table inside slide-over (Phase FIN-2)
│       ├── FinOutstandingTab.jsx     ← Outstanding invoices tab (Phase FIN-2)
│       ├── FinContactTab.jsx         ← Contact info + notes + pin (Phase FIN-2)
│       └── FinPdfExport.jsx          ← PDF generation + share sheet (Phase FIN-3)
├── hooks/
│   └── useFinancial.js               ← Data fetching + caching hook (Phase FIN-1)
supabase/
└── migrations/
    └── 002_fin_init.sql              ← All fin_* tables (Phase FIN-1)
sync/
├── fin_sync_core.py                  ← Excel parsing + Supabase upsert logic (Phase FIN-4)
└── fin_sync_tool_tab.py              ← New tab/panel added to existing sync_tool.pyw (Phase FIN-4)
README/
├── FINANCIAL_REPORTS_MASTERPLAN.md   ← This file (copy into zip)
├── phase_fin1_done.md                ← Written by Phase FIN-1 session
├── phase_fin2_done.md                ← Written by Phase FIN-2 session
├── phase_fin3_done.md                ← Written by Phase FIN-3 session
└── phase_fin4_done.md                ← Written by Phase FIN-4 session
```

---

## Files Modified (across all phases)

| File | Phase | What Changes |
|---|---|---|
| `src/pages/AdminPanel.jsx` | FIN-1 | Add `financial` to `NAV_ITEMS`, render `AdminFinancial` |
| `src/components/layout/Sidebar.jsx` | FIN-1 | No change needed — driven by `NAV_ITEMS` prop |
| `sync/sync_tool.pyw` | FIN-4 | Add Financial Sync tab/section to existing CTk window |
| `sync/sync_core.py` | FIN-4 | No change — fin sync lives in `fin_sync_core.py` |

---

## Phase FIN-1 — Foundation + Party List

**Goal:** Financial Reports page is accessible in the admin panel. Shows dashboard cards and the full sortable/filterable party list for both Debtors and Creditors. No drill-down yet.

### Deliverables
1. `supabase/migrations/002_fin_init.sql` — all fin_* tables with RLS
2. `src/hooks/useFinancial.js` — fetches `fin_parties` + `fin_address` + `fin_sync_log`, returns loading/error/data
3. `src/pages/AdminFinancial.jsx` — main page shell, tabs (Debtors / Creditors), renders list
4. `src/components/financial/FinDashboardCards.jsx` — 4 cards: Total Receivable, Total Payable, Outstanding Parties, Last Synced
5. `src/components/financial/FinPartyList.jsx` — sort controls + filter strip + party list
6. `src/components/financial/FinPartyCard.jsx` — one card per party: name, closing bal, status badge, state, mobile (tap-to-call), last txn date placeholder
7. `src/pages/AdminPanel.jsx` — add `financial` nav item with `TrendingUp` icon, render `<AdminFinancialContent />`

### Data Flow (Phase FIN-1)
```
Supabase fin_parties + fin_address
    ↓ useFinancial hook
    ↓ AdminFinancial.jsx
    ↓ FinDashboardCards (aggregated totals)
    ↓ FinPartyList (filtered + sorted array)
    ↓ FinPartyCard × N
```

### Sort Options
- Name A→Z (default)
- Name Z→A
- Closing Balance ↑ (lowest first)
- Closing Balance ↓ (highest first)
- Last Transaction Date (newest first) — uses `fin_ledger` max date, computed client-side from loaded data

### Filter Options
- All (default)
- Receivable / Payable only
- Settled ✓ only
- Credit Bal ⚠ only
- Outstanding only (closing_bal > 0)
- **Hide Settled toggle** — one-tap to collapse all settled parties

### State Filter
- Dropdown populated from unique state values in `fin_address` for matched parties

### Empty State
- If `fin_parties` is empty: show "No data synced yet" card with instructions to run sync tool

### Mobile vs Desktop
- Mobile: stacked cards (full width), sort/filter in a scrollable horizontal strip
- Desktop: table-style rows with more columns visible

### Styling Rules (apply to ALL phases)
- Use `var(--bg-base)`, `var(--bg-elevated)`, `var(--bg-surface)`, `var(--border)`, `var(--text-primary)`, `var(--text-muted)`, `var(--brand)`, `var(--brand-light)`, `var(--error)`, `var(--error-light)`, `var(--success)`, `var(--success-light)` — never hardcode colours
- Status badge: Receivable = brand colour, Settled = success, Credit Bal = warning, Payable = error
- `font-display` (Playfair Display) for headings, `font-body` (DM Sans) for body, `font-mono` (JetBrains Mono) for numbers/amounts
- All amounts formatted as `₹` + Indian locale (`toLocaleString('en-IN')`)
- Animations: use existing `animate-fade-in`, `animate-slide-up`, `animate-slide-in-right` from tailwind config
- Match border-radius and shadow tokens from `src/index.css`

### Phase FIN-1 Context for Next Session
After FIN-1, the next session receives:
- Updated zip with all above files
- `README/phase_fin1_done.md` listing every file created/changed, line-level notes on any non-obvious decisions, and what FIN-2 must know

---

## Phase FIN-2 — Search + Slide-Over + Party Statement

**Goal:** Searching works globally (name, GSTIN, mobile, state). Tapping any party (from list or search) opens a slide-over with 3 tabs: Ledger, Outstanding, Contact.

### Deliverables
1. `src/components/financial/FinSearch.jsx`
   - Triggered by search icon button (top of page, same pattern as catalogue `SearchBox.jsx`)
   - Uses `Fuse.js` (already in project) on `fin_parties` array joined with `fin_address`
   - Search fields: `party_name`, `gstin`, `mobile`, `state_name`
   - Results dropdown: party name + closing bal + status badge + state
   - Tap result → opens slide-over for that party
   - Recent searches: last 5 opened parties stored in `sessionStorage` (not localStorage — clears on tab close)
   - Keyboard: `Escape` closes, arrow keys navigate results
   - Works on both mobile (full-screen overlay) and desktop (dropdown below input)

2. `src/components/financial/FinSlideOver.jsx`
   - Slide-in from right on desktop, slide-up from bottom on mobile
   - Uses `animate-slide-in-right` (desktop) / `animate-slide-up` (mobile)
   - Backdrop overlay closes it on click
   - Header: party name + status badge + close button
   - Sub-header: closing balance (large, prominent) + party type chip
   - 3 tabs: Ledger | Outstanding | Contact
   - Tab content lazy-fetches from Supabase when tab is first opened (not all upfront)
   - Loading skeleton while fetching (use existing `Skeleton.jsx` pattern)

3. `src/components/financial/FinLedgerTab.jsx`
   - Fetches `fin_ledger WHERE party_type=X AND party_name=Y ORDER BY txn_date ASC`
   - Opening balance row (pinned top, green/amber tinted)
   - Closing balance row (pinned bottom)
   - Each row: date (DD MMM YYYY), vch type, vch no, narration (truncated, expandable), debit (red), credit (green), running balance
   - Mobile: card layout (date + narration on top, amounts below)
   - Desktop: full table with all columns
   - Empty state: "No transactions found" (shouldn't happen but handle it)

4. `src/components/financial/FinOutstandingTab.jsx`
   - Fetches `fin_outstanding WHERE party_type=X AND party_name=Y`
   - If rows exist: invoice list with aging badge per row
     - Aging computed client-side: days since `inv_date` from today
     - 0–30 days: green badge, 31–60: yellow, 61–90: orange, 90+: red
   - If no rows (party is Settled ✓): show green "All invoices cleared ✓" state with last txn date
   - If closing is negative (Credit Bal ⚠): show "Excess receipt of ₹X — pending adjustment or refund"
   - Summary line at top: "Total outstanding: ₹X across N invoices"

5. `src/components/financial/FinContactTab.jsx`
   - Fetches `fin_address WHERE party_name=Y` (case-insensitive match)
   - Displays: address, state + pincode, contact person, phone (tap-to-call `tel:`), mobile (tap-to-call + tap-to-WhatsApp `https://wa.me/91{mobile}`), email (tap `mailto:`), GSTIN, PAN, reg type
   - If no address book match: "No contact info synced for this party"
   - **Notes section** (below contact):
     - Lists existing notes from `fin_party_notes` for this party (newest first)
     - Text input + Add Note button (POST to `fin_party_notes` via admin supabase client with `supabaseAdmin`)
     - Delete note button per note (trash icon, confirm before delete)
   - **Pin toggle**: star icon button — inserts/deletes from `fin_pinned` table
     - Pinned parties float to top of `FinPartyList`

### useFinancial.js additions (Phase FIN-2)
Add these fetch functions (called lazily, not on mount):
```js
fetchLedger(partyType, partyName)      // → fin_ledger rows
fetchOutstanding(partyType, partyName) // → fin_outstanding rows
fetchContact(partyName)                // → fin_address row
fetchNotes(partyType, partyName)       // → fin_party_notes rows
addNote(partyType, partyName, text)    // → insert to fin_party_notes
deleteNote(noteId)                     // → delete from fin_party_notes
togglePin(partyType, partyName)        // → insert/delete fin_pinned
```

### Phase FIN-2 Context for Next Session
After FIN-2, the next session receives updated zip + `README/phase_fin2_done.md`.

---

## Phase FIN-3 — PDF Generation + Share

**Goal:** Every party ledger can be exported as a branded PDF and shared via WhatsApp, Email, or direct download.

### Library
Use **`jsPDF`** + **`jsPDF-autotable`** — install into `package.json`:
```
jspdf: ^2.5.1
jspdf-autotable: ^3.8.2
```
Client-side only. No server needed. Works offline (PWA-friendly).

### Deliverables
1. `src/components/financial/FinPdfExport.jsx`
   - Not a rendered component — a utility module that exports:
     ```js
     generatePartyPDF(partyData, ledgerRows, outstandingRows, addressData) → Blob
     ```
   - PDF layout:
     - **Page 1 header**: Business name (hardcoded as "PriceMaster" — admin can update in `.env` as `VITE_BUSINESS_NAME`), address placeholder, GSTIN placeholder, date range of statement, "Generated on: DD MMM YYYY HH:MM"
     - **Party block**: Party name, address (from address book), GSTIN, state, mobile
     - **Statement heading**: "ACCOUNT STATEMENT" — Debtor/Creditor
     - **Ledger table**: Date | Vch Type | Vch No | Narration | Debit | Credit | Balance — full auto-table with alternating row colours matching brand palette
     - **Outstanding summary**: below ledger, if applicable — invoice list table
     - **Footer on each page**: "Confidential — generated by PriceMaster" + page X of Y
   - Returns a `Blob` (PDF bytes)

2. Share UI — added inside `FinSlideOver.jsx` header (top-right, share icon button)
   - Opens a small bottom sheet / popover with 4 options:
     - 📥 **Download PDF** — `URL.createObjectURL(blob)` + programmatic `<a>` click
     - 💬 **WhatsApp** — if mobile number available: `https://wa.me/91{mobile}?text=...` (pre-filled message: "Dear {name}, please find your account statement attached.") + triggers download simultaneously. If no mobile: show "No mobile number on file" toast
     - 📧 **Email** — `mailto:{email}?subject=Account Statement — {name}&body=...` + triggers download. If no email: show toast
     - 🖨️ **Print** — `window.print()` on the PDF blob URL in an iframe
   - Share button is disabled + shows spinner while PDF generates
   - On mobile: bottom sheet. On desktop: small popover anchored to share button.

3. **Bulk export button** in `FinPartyList.jsx` toolbar (visible when filter = "Outstanding only")
   - "Export All Outstanding (PDF)" button
   - Generates one PDF per party sequentially, zips them using `JSZip` (add to package.json: `jszip: ^3.10.1`)
   - Progress shown in a modal: "Generating 1 of {total}…" — total is dynamic, computed from filtered list at time of export
   - Downloads as `outstanding_debtors_YYYYMMDD.zip`

### Phase FIN-3 Context for Next Session
After FIN-3, the next session receives updated zip + `README/phase_fin3_done.md`.

---

## Phase FIN-4 — Sync Tool Extension (Excel → Supabase)

**Goal:** The existing Python sync tool (`sync_tool.pyw`) gets a new "Financial Sync" section. Admin can pick the 3 Excel files and push them to Supabase. The Financial Reports page shows live data from that point on.

### Deliverables

1. `sync/fin_sync_core.py` — standalone parsing + upload logic
   ```python
   # Public API:
   sync_debtors(excel_path, supabase_url, service_role_key, log_callback) → (bool, str)
   sync_creditors(excel_path, supabase_url, service_role_key, log_callback) → (bool, str)
   sync_address_book(excel_path, supabase_url, service_role_key, log_callback) → (bool, str)
   ```

   **Parsing logic (robust — handles all 3 pages of Excel):**
   - Party name detection: strip ALL whitespace variants (`str.strip()`), check if all other columns in row are `None` — do NOT rely on leading spaces count
   - Cross-validate parsed parties vs Summary sheet: any party in Summary with non-zero closing but zero ledger rows → log warning, don't silently skip
   - Name matching is case-insensitive + stripped for all lookups
   - Dates: handle `datetime` objects from openpyxl, convert to ISO string `YYYY-MM-DD`
   - Amounts: handle `None` → `0`, handle negative values correctly
   - Outstanding: if party not in Outstanding Breakdown → that's correct (they're settled), do NOT create empty rows for them

   **Upload logic:**
   - `fin_parties`: DELETE WHERE `party_type=X` then re-insert all (full replace per type)
   - `fin_ledger`: DELETE WHERE `party_type=X` then re-insert in chunks of 400
   - `fin_outstanding`: DELETE WHERE `party_type=X` then re-insert in chunks of 400
   - `fin_address`: UPSERT on `party_name` (conflict = update) — don't delete, just refresh
   - `fin_sync_log`: INSERT one row after each successful sync with count + timestamp
   - Chunks of 400 rows per Supabase request (same as existing `sync_core.py` pattern)

2. `sync/sync_tool.pyw` — modified to add Financial Sync section
   - **Do not restructure the existing window** — add a new `CTkTabview` or separator section below existing Push/Pull buttons
   - OR: add a new "Financial" tab if `CTkTabview` feels cleaner — ask the FIN-4 session to judge based on current window size
   - 3 file pickers: Debtors Excel, Creditors Excel, Address Book Excel (each saves path to `config.json` under `fin_debtors_path`, `fin_creditors_path`, `fin_address_path`)
   - 3 sync buttons: "Sync Debtors", "Sync Creditors", "Sync Address Book"
   - 1 "Sync All 3" button
   - Each shows a preview before sync: "Found {N} parties, {M} transactions — proceed?"
   - Reuses existing log area (same `CTkTextbox`) for output
   - Runs in background thread (same `daemon=True` pattern as existing push/pull)

### Dependencies to add to `sync/requirements.txt`
```
openpyxl>=3.1.2
```
(supabase and other deps already present)

### Phase FIN-4 Context / Completion
After FIN-4, the feature is complete. The session writes `README/phase_fin4_done.md`.

---

---

## Session Handoff — What to Provide Every Time

> Every Claude session building a FIN phase must receive ALL of the following.
> Missing any item risks the session guessing, inventing structure, or breaking
> existing code. No exceptions.

### Required Files Per Session

| File | Every Session | Notes |
|---|---|---|
| `222222.zip` (current project state after last phase) | ✅ Always | The live codebase — must be the output zip of the previous phase, not an older one |
| `README/FINANCIAL_REPORTS_MASTERPLAN.md` | ✅ Always | This file — the single source of truth |
| `README/phase_fin{N}_done.md` (most recent completed phase) | ✅ Always | Tells the session exactly what was built last and what to know |
| Debtors Excel (`SUNDRY_DEBTORS_running_balance.xlsx`) | ✅ Always | Parser accuracy — sheet structure, column order, party name row format |
| Creditors Excel (`SUNDRY_CREDITORS_running_balance.xlsx`) | ✅ Always | Same as above |
| Address Book Excel (`Address_Book.xlsx`) | ✅ Always | Column layout, group names, field fill rates |

### Why the Excels Are Required Every Session

- **Column order** — openpyxl reads by position. If a future Tally export shifts a column, the session catches it from the real file instead of trusting old documentation
- **Party name row detection** — the two-leading-spaces pattern, blank rows between parties, the "Total outstanding ₹X = ..." summary text format are all confirmed from the actual file
- **Cross-validation** — the session can verify "Summary sheet says N parties, my parser found N — correct" without the file it cannot do this
- **Edge cases** — new parties, changed formatting, extra sheets, merged cells — only catchable with the real file in hand
- **Data accuracy** — counts, field names, and status label strings (e.g. `"Settled ✓"`, `"Credit Bal ⚠"`, `"Receivable"`, `"Payable"`) must match exactly what Tally exports, not what was documented months ago

### One Partial Exception

**Phase FIN-3 (PDF generation)** — no parser code is written in this phase. The Excels are less critical but still include them so the session can verify field names used in the PDF layout match actual data.

**Phase FIN-4 (Sync Tool)** — most critical phase for the Excels. This is where the parser is written. Always provide the most up-to-date versions of all 3 files at the time of that session.

### Opening Prompt Template for Each Session

Copy-paste this when starting a new phase session:

```
I am building Phase FIN-{N} of the Financial Reports feature for PriceMaster.

Attached:
1. 222222.zip — current project state (output of Phase FIN-{N-1})
2. FINANCIAL_REPORTS_MASTERPLAN.md — master plan
3. phase_fin{N-1}_done.md — what was built last phase
4. SUNDRY_DEBTORS_running_balance.xlsx — current debtors export from Tally
5. SUNDRY_CREDITORS_running_balance.xlsx — current creditors export from Tally
6. Address_Book.xlsx — current address book export from Tally

Please read all files, then build Phase FIN-{N} exactly as specified in the masterplan.
Deliver a zip of the updated project + README/phase_fin{N}_done.md inside it.
```

---

## Cross-Phase Rules (Every Session Must Follow)

### 1. Never Break Existing Features
- `AdminCatalogue`, `AdminStaff`, all existing hooks, the existing sync push/pull — untouched unless the file is in "Files Modified" above
- If a modified file (e.g. `AdminPanel.jsx`) must change, make the minimum surgical change only

### 2. CSS / Styling
- All colours via CSS variables — no Tailwind colour classes like `bg-amber-500`
- Tailwind only for layout/spacing/flex/grid
- Dark mode works automatically via CSS variables (`.dark` class on `<html>`)
- Test mentally: does it look right in both light AND dark mode?

### 3. Amount Formatting
Always use:
```js
const fmt = (n) => `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
// Negative = shown with explicit minus or contextual label, never just ₹-1234
```

### 4. Loading States
- Use existing `Spinner.jsx` for full-area loading
- Use existing `Skeleton.jsx` pattern for list/table loading
- Never show blank white flashes

### 5. Error States
- Use existing `toast` from `src/components/ui/Toast.jsx` for transient errors
- Show inline error UI (not just a toast) for critical data fetch failures

### 6. Mobile First
- Every component must work on 375px wide screen
- Touch targets minimum 44px height
- No horizontal overflow — test with `overflow-x: hidden` on body mentally

### 7. Supabase Client Usage
- Public reads: use `supabase` from `src/lib/supabase.js` (anon key, respects RLS)
- Admin writes (notes, pins): use `supabaseAdmin` from `src/lib/supabaseAdmin.js` (service role, inside admin-only routes — this is fine since the page is behind `RequireAdmin`)

### 8. File Naming
- React components: PascalCase `.jsx`
- Hooks: camelCase `useXxx.js`
- Python: snake_case `.py` / `.pyw`

### 9. Phase README Format
Each `phase_fin{N}_done.md` must include:
- What was built (component-level detail)
- Files created (with paths)
- Files modified (with exact changes described)
- Files NOT changed
- Any non-obvious decisions made and why
- What the next phase must know
- Any Supabase setup steps needed (table creation, RLS, realtime if any)

---

## Handoff Checklist (Before Ending Each Session)

- [ ] All new files created at correct paths
- [ ] Modified files changed minimally and correctly
- [ ] `README/phase_fin{N}_done.md` written with full detail
- [ ] `README/FINANCIAL_REPORTS_MASTERPLAN.md` copied into zip unchanged
- [ ] Zip delivered to user
- [ ] No `console.log` left in production code (dev logs OK with `import.meta.env.DEV` guard)
- [ ] No hardcoded colours
- [ ] Dark mode tested mentally
- [ ] Mobile layout tested mentally (375px)
- [ ] No invented Supabase table names — only the ones defined in this document

---

## Quick Reference: Existing Patterns to Copy

### Hook pattern (copy from `useInventory.js`)
```js
const [data, setData] = useState([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState(null)
useEffect(() => { fetchData() }, [])
```

### Write hook pattern (copy from `useCatalogueWrite.js`)
```js
const [loading, setLoading] = useState(false)
const [error, setError] = useState(null)
const call = async (payload) => { ... }
return { call, loading, error }
```

### Toast usage
```js
import { toast } from '../components/ui/Toast'
toast.success('Done!')
toast.error('Something went wrong')
```

### Admin client (for writes inside admin panel)
```js
import { supabaseAdmin } from '../lib/supabaseAdmin'
await supabaseAdmin.from('fin_party_notes').insert({ ... })
```

### Fuse.js pattern (copy from `src/utils/search.js`)
```js
import Fuse from 'fuse.js'
const fuse = new Fuse(items, { keys: ['party_name', 'gstin', 'mobile'], threshold: 0.3 })
const results = fuse.search(query).map(r => r.item)
```

---

*Masterplan version 1.0 — generated 19 May 2026*
*Place this file at `README/FINANCIAL_REPORTS_MASTERPLAN.md` inside the project zip for every phase.*
