# ANKxIOUS — Upgrade Masterplan v1
## Rebranding + Financial UX Overhaul

> **This document is the single source of truth for all Claude sessions in this upgrade series.**
> Every session must read this file entirely before writing a single line of code.
> Never guess. Never invent. Match existing code quality, CSS variables, and patterns exactly.
> Current codebase baseline: `pricemaster_fin6_fix.zip` (FIN-7 complete, FIN-6 label fix applied).

---

## Project State at Baseline

| Item | Detail |
|---|---|
| App name | PriceMaster (being renamed to ANKxIOUS) |
| Framework | React 18 + Vite + Tailwind (class dark mode) |
| Backend | Supabase (Postgres + RLS + Edge Functions) |
| Auth | Supabase Auth for admin; custom bcrypt edge fn for staff |
| Sync tool | Python CTk desktop app (`sync/`) |
| Styling | CSS variables in `src/index.css`, warm amber/cream palette |
| Icons | `lucide-react@0.383.0` only |
| PDF | `jspdf` + `jspdf-autotable` |
| Routing | `react-router-dom` v6, admin lives at `/admin/*` |
| PWA | Service worker + manifest in `public/` |
| Deploy | Vercel |
| Financial phases done | FIN-1 through FIN-7, plus FIN-6 label fix |

### Supabase Tables That Exist
- `fin_parties`, `fin_ledger`, `fin_outstanding`, `fin_address`, `fin_party_notes`, `fin_pinned`, `fin_sync_log`
- `fin_party_labels`, `fin_custom_labels` (from FIN-6 fix)

---

## Overview of All Changes

This masterplan covers **6 phases**:

| Phase | Code | What It Does |
|---|---|---|
| 0 | AX-0 | Full palette swap: warm amber/cream → deep space dark + electric violet. Every CSS variable replaced. FinPdfExport RGB arrays updated. |
| 1 | AX-1 | Rebrand everything: PriceMaster → ANKxIOUS. App name, manifest, icons, all JSX text, PDF footer. Entity name setting in admin panel. |
| 2 | AX-2 | Financial Reports as its own dedicated page (separate from current Financial party list). Period analytics / insights on this new page. |
| 3 | AX-3 | Financial party list UX overhaul: collapsible filter strip, full-page ledger view (no slide-over), invoice numbers always visible on mobile, narrations hidden-by-default. |
| 4 | AX-4 | Payment Periods page (inside Financial Reports): debtors + creditors list with days-since-last-payment, outstanding amount, sort/filter. |
| 5 | AX-5 | Landscape mode support across the financial section. Orientation lock removed from manifest; layout adapts to landscape on mobile. |

---

## Phase AX-0 — Full Colour Palette Swap

### Goal
Replace the existing warm amber/cream palette with a deep space dark theme + electric violet accent. This is a pure CSS + one JSX file change — no component logic touched at all.

### Why a Separate Phase
Doing the palette first means every subsequent phase (AX-1 through AX-5) can test and screenshot in the correct final colours. It also means if the palette needs tweaking it's isolated to one commit.

### The New Palette

#### Design Rationale
- Base: deep navy-black, not pure black — gives perceived depth between layers
- Accent: electric violet `#7c6ff7` — matches the ANKxIOUS energy, space/nebula feeling
- Text: cool off-white, not warm cream — warm text clashes with cool space backgrounds
- Status colours: shifted slightly cooler so they don't look out of place against navy backgrounds
- The app is used for reading financial data for extended sessions — the dark base reduces eye strain

#### Complete CSS Variable Replacement

**`src/index.css`** — replace `:root` and `.dark` blocks entirely.

The app uses `class` dark mode (Tailwind). The current pattern has a light `:root` and a `.dark` override. After this change, **both light and dark mode use dark backgrounds** — the "light mode" is a slightly lighter navy, the "dark mode" is the deepest navy. This is intentional: ANKxIOUS is a dark-first app. There is no cream/white light mode.

```css
:root {
  /* Backgrounds */
  --bg-base:         #080b14;   /* deep space */
  --bg-surface:      #0e1220;   /* card surface */
  --bg-elevated:     #151a2e;   /* elevated panel / sidebar */
  --bg-overlay:      rgba(0, 0, 0, 0.72);

  /* Text */
  --text-primary:    #e8eaf5;   /* cool off-white */
  --text-secondary:  #8b91b8;   /* muted blue-grey */
  --text-muted:      #4a5078;   /* dim */
  --text-inverse:    #080b14;   /* for text on brand-coloured buttons */

  /* Brand / accent — electric violet */
  --brand:           #7c6ff7;
  --brand-hover:     #9d94f9;
  --brand-light:     #1e1a3d;   /* tinted surface for selected states, highlights */
  --brand-border:    #3d3680;   /* border on brand-tinted surfaces */

  /* Borders */
  --border:          #1e2440;   /* default border */
  --border-strong:   #2e3560;   /* stronger border for emphasis */

  /* Status */
  --success:         #3ecf74;
  --success-light:   #0f2a1a;
  --error:           #e05c5c;
  --error-light:     #2a1010;
  --warning:         #f0a832;
  --warning-light:   #2a1e08;

  /* Shadows */
  --shadow-sm:  0 1px 3px rgba(0,0,0,0.40);
  --shadow:     0 4px 12px rgba(0,0,0,0.50);
  --shadow-lg:  0 8px 32px rgba(0,0,0,0.60);
  --shadow-xl:  0 16px 48px rgba(0,0,0,0.70);

  /* Radius — unchanged */
  --radius-sm: 0.375rem;
  --radius:    0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;
}

.dark {
  /* Deeper variant for explicit dark mode toggle */
  --bg-base:         #04060d;
  --bg-surface:      #080b14;
  --bg-elevated:     #0e1220;
  --bg-overlay:      rgba(0, 0, 0, 0.80);

  --text-primary:    #f0f2ff;
  --text-secondary:  #9098c0;
  --text-muted:      #3e4468;
  --text-inverse:    #04060d;

  --brand:           #8f84f9;
  --brand-hover:     #a89ef9;
  --brand-light:     #16133a;
  --brand-border:    #342e80;

  --border:          #141828;
  --border-strong:   #222848;

  --success:         #34b864;
  --success-light:   #0a2016;
  --error:           #d44f4f;
  --error-light:     #220c0c;
  --warning:         #e09820;
  --warning-light:   #221608;

  --shadow-sm:  0 1px 3px rgba(0,0,0,0.60);
  --shadow:     0 4px 12px rgba(0,0,0,0.70);
  --shadow-lg:  0 8px 32px rgba(0,0,0,0.80);
  --shadow-xl:  0 16px 48px rgba(0,0,0,0.88);
}
```

**Important — `@tailwind base` body defaults:** The existing `index.css` likely sets `body { background: var(--bg-base); color: var(--text-primary); }` or uses Tailwind's base layer. Verify after the variable swap that the body background is applying correctly. If the page flash shows white, add explicitly:
```css
html, body {
  background-color: var(--bg-base);
  color: var(--text-primary);
}
```

#### FinPdfExport.jsx — RGB Array Updates

`src/components/financial/FinPdfExport.jsx` has a hardcoded `C` object with RGB arrays. Replace:

```js
// OLD (amber/cream)
const C = {
  brand:        [212, 132, 42],    // #d4842a
  brandLight:   [250, 239, 217],   // #faefd9
  // ... etc
}

// NEW (space/violet)
const C = {
  brand:        [124, 111, 247],   // #7c6ff7 — violet
  brandLight:   [30, 26, 61],      // #1e1a3d — tinted dark surface
  bgBase:       [8, 11, 20],       // #080b14 — deep space
  bgSurface:    [14, 18, 32],      // #0e1220 — card surface
  textPrimary:  [232, 234, 245],   // #e8eaf5 — off-white
  textMuted:    [74, 80, 120],     // #4a5078 — muted
  border:       [30, 36, 64],      // #1e2440 — border
  success:      [62, 207, 116],    // #3ecf74
  error:        [224, 92, 92],     // #e05c5c
  warning:      [240, 168, 50],    // #f0a832
  white:        [255, 255, 255],
  black:        [4, 6, 13],        // near-black for PDF text (use instead of pure 0,0,0)
}
```

The PDF should use a dark background with light text — consistent with the app. However, PDFs sent to clients are often printed or shared externally. Consider whether to keep PDF as light-background (easier to print) or go dark. **Recommendation: keep PDF background white/light for printability, but use the violet brand colour for headers and accents.** The Claude session should use the new `C.brand` for header bars and leave `C.white` as page background — adjust the `C.brandLight` tint accordingly to a very light violet tint `[240, 238, 255]` for alternating rows.

#### Tailwind Config Check

`tailwind.config.js` may reference old colour tokens in `extend.colors`. Check and remove any hardcoded amber/cream hex values if present — they override CSS vars in unexpected ways. The session must read `tailwind.config.js` before writing code.

### Files to Modify
- `src/index.css` — replace `:root` and `.dark` blocks (only those blocks, nothing else)
- `src/components/financial/FinPdfExport.jsx` — replace the `C` object
- `tailwind.config.js` — remove any hardcoded colour overrides if present

### Files NOT to Touch
Everything else. No JSX changes. No component logic. This phase is CSS + one JS object only.

### Verification Checklist (Session Must Mentally Test)
- [ ] Party list cards: background dark, text light, brand pills visible
- [ ] Ledger rows: alternating row tints work with new `--bg-surface` / `--brand-light`
- [ ] Status badges: Receivable (brand violet), Settled (success green), error (red) — all readable
- [ ] Dashboard metric cards: amounts readable, no cream/amber bleeding through
- [ ] Slide-over / ledger page: header, tabs, row colours all consistent
- [ ] Dark mode toggle: `.dark` class deepens things slightly — no jarring jump
- [ ] PDF output: violet brand header, white page body, readable text

### Session Handoff After AX-0
Write `README/phase_ax0_done.md`. No Supabase changes. No new files created.

---

## Phase AX-1 — Rebrand to ANKxIOUS + Entity Name Setting

### Goal
Replace every occurrence of "PriceMaster" in the frontend, PWA manifest, PDF output, and admin panel with "ANKxIOUS". Make the entity name (shown in PDFs) configurable from the admin panel, stored in Supabase, not hardcoded.

### What to Change

#### 1. App name / branding strings
Every visible "PriceMaster" text in JSX → "ANKxIOUS".

Files:
- `src/components/layout/Sidebar.jsx` — brand text "PriceMaster" and "Admin Panel"
- `src/pages/AdminPanel.jsx` — mobile header brand text "PM" logo chip and "Admin"
- `src/pages/Home.jsx` — all brand references
- `src/pages/Catalogue.jsx` — any brand references
- `src/index.css` — no text changes needed, CSS vars unchanged
- `public/manifest.json` — `"name"`, `"short_name"`, `"description"` all updated

**New manifest values:**
```json
{
  "name": "ANKxIOUS",
  "short_name": "ANKxIOUS",
  "description": "Business admin panel by ANKxIOUS",
  "orientation": "any"
}
```
Note: `"orientation": "any"` (not `"portrait-primary"`) — needed for AX-5 landscape mode.

- `index.html` — `<title>` tag and any meta description referencing PriceMaster
- `src/pages/AdminPanel.jsx` — the "PM" chip in mobile header and desktop sidebar should become "AX" or the ANKxIOUS logomark

#### 2. PWA Icons — Space-themed "A" logomark
The current icons are plain PNGs at `public/icons/icon-*.png`.
The Claude session must generate new icons programmatically using a Canvas script or SVG-to-PNG approach (using sharp or canvas npm package in a build script).

**Icon design spec:**
- Background: deep space gradient — radial, dark navy (#0a0e1a) center to near-black (#000308) edge
- Foreground: stylised "A" letterform — sharp geometric, slightly angular/edgy
- "A" colour: bright electric indigo/violet (#7c6ff7) with a subtle glow effect (box-shadow or SVG filter)
- Small accent: 3–5 tiny white dots (stars) scattered asymmetrically around the "A"
- No other text or element
- Render at 512×512, then downscale for other sizes

The session should write a Node.js script `scripts/gen_icons.mjs` that uses the `canvas` npm package to draw and export all required icon sizes. Run it once during development, commit the PNGs.

If canvas is unavailable, produce an SVG `public/icons/icon.svg` and reference it in `manifest.json` as an `"any"` purpose icon — the browser will use it for all sizes. Also set the `<link rel="icon">` in `index.html` to point to the SVG.

#### 3. Entity name in PDF — configurable, not hardcoded

**Current state:** `FinPdfExport.jsx` has:
```js
const BUSINESS_NAME = import.meta.env.VITE_BUSINESS_NAME ?? 'PriceMaster'
```

**Required:** Entity name is stored in Supabase, editable from admin panel.

**New Supabase table (`005_app_settings.sql`):**
```sql
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings public read"
  ON app_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "app_settings admin write"
  ON app_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "app_settings admin update"
  ON app_settings FOR UPDATE TO authenticated USING (true);

-- Seed the default
INSERT INTO app_settings (key, value) VALUES ('entity_name', 'ANKxIOUS')
  ON CONFLICT (key) DO NOTHING;
```

**New hook `src/hooks/useAppSettings.js`:**
```js
fetchEntityName()   // SELECT value FROM app_settings WHERE key='entity_name'
setEntityName(name) // UPSERT via supabaseAdmin
```

**`FinPdfExport.jsx`:** Remove the `VITE_BUSINESS_NAME` env var. Accept `entityName` as a parameter to `generatePartyPDF(partyData, ledgerRows, outstandingRows, addressData, entityName)`. Replace all `BUSINESS_NAME` usages with the param.

**`FinSlideOver.jsx`:** Fetch entity name (or receive as prop from `AdminFinancial`), pass to `generatePartyPDF`.

**New admin panel section — "Settings":**
Add a 4th nav item `{ id: 'settings', label: 'Settings', icon: <Settings size={16} /> }` to `NAV_ITEMS` in `AdminPanel.jsx`.

Create `src/pages/AdminSettings.jsx`:
- Single card: "Entity Name" — text input + save button
- On save: calls `setEntityName(value)` from `useAppSettings`
- Shows current value fetched on mount
- Shows success/error toast
- Keep it minimal — one card, no overdesign

#### 4. Remove `VITE_BUSINESS_NAME` from `.env` files if present.

### Files to Create
- `supabase/migrations/005_app_settings.sql`
- `src/hooks/useAppSettings.js`
- `src/pages/AdminSettings.jsx`
- `scripts/gen_icons.mjs` (icon generation script)

### Files to Modify
- `public/manifest.json`
- `index.html`
- `src/App.jsx` — no route changes needed (AdminPanel handles sub-routes)
- `src/pages/AdminPanel.jsx` — add Settings nav item, import AdminSettings
- `src/components/layout/Sidebar.jsx` — rebrand text
- `src/pages/Home.jsx` — rebrand text
- `src/pages/Catalogue.jsx` — rebrand text (if any)
- `src/components/financial/FinPdfExport.jsx` — accept entityName param, remove env var
- `src/components/financial/FinSlideOver.jsx` — fetch + pass entityName to PDF export

### Files NOT to Touch
All other files. Sync tool Python files. CSS variables (colours unchanged).

### Session Handoff After AX-1
Write `README/phase_ax1_done.md`. Run `005_app_settings.sql` in Supabase SQL editor. Run icon generation script once.

---

## Phase AX-2 — Financial Reports as a Dedicated Page

### Goal
The current "Financial" tab in the admin panel contains both the party list (Debtors / Creditors) and an insights slide-over. This is too dense. Split into two top-level sections:
- **"Financial"** — keeps the party list exactly as before (debtors/creditors, search, labels, slide-over)
- **"Reports"** — brand new page, accessible from the sidebar/tab bar, dedicated to period-based analytics and global insights

### Mental Model

```
Admin Panel
├── Catalogue
├── Staff
├── Financial      ← party list (unchanged content, same as before)
├── Reports        ← NEW: period analytics + insights
└── Settings       ← from AX-1
```

### New Nav Item
In `AdminPanel.jsx`, add:
```js
{ id: 'reports', label: 'Reports', icon: <BarChart2 size={16} /> }
```
This renders `<AdminReports />` in the content area.

### `src/pages/AdminReports.jsx` — New Page

This is the main deliverable of AX-2. It has its own internal tab bar:

```
Reports
├── Overview        ← period-range summary (the main tab)
├── Debtors         ← debtor-specific period breakdown
└── Creditors       ← creditor-specific period breakdown
```

#### Period Selector
At the top of the Reports page, a compact period selector row:
- Two date pickers: "From" and "To" — HTML `<input type="date">` styled with CSS vars
- Quick presets as pills: "This Month" / "Last Month" / "This FY" / "Last FY" / "Custom"
- Selecting a preset auto-fills the From/To dates
- "This FY" = 1 Apr of current financial year to today; "Last FY" = 1 Apr previous year to 31 Mar
- Indian financial year logic: if today's month ≥ 4 (April), FY start = current year Apr 1; else = previous year Apr 1

#### Overview Tab — Metrics Computed from `fin_ledger`

All data is fetched with a date-range filter on `txn_date`. Use a single `fetchPeriodData(from, to)` function that queries:
1. `fin_ledger WHERE txn_date BETWEEN from AND to` — for turnover, sales, purchases
2. `fin_outstanding` — for current outstanding snapshot (not date-filtered — it's always current)

**Metric cards (2-col mobile, 3-col desktop):**

| Metric | Computation | Icon |
|---|---|---|
| Total Turnover | Sum of all `debit` in ledger for debtors in period | TrendingUp |
| Total Receivable Collected | Sum of all `credit` for debtors in period | ArrowDownCircle |
| Total Sales (Debtors Dr) | Sum of `debit` where `vch_type` contains "SALES" (case-insensitive) for debtors | ShoppingBag |
| Total Purchases (Creditors Dr) | Sum of `debit` for creditors in period | Package |
| Total Paid to Creditors | Sum of `credit` for creditors in period | ArrowUpCircle |
| Currently Outstanding (Debtors) | Sum of `remaining` from `fin_outstanding WHERE party_type='debtor'` | AlertCircle |
| Currently Payable (Creditors) | Sum of `remaining` from `fin_outstanding WHERE party_type='creditor'` | AlertTriangle |
| Active Debtors in Period | Count of distinct `party_name` with any ledger entry in period (debtor) | Users |
| Active Creditors in Period | Count of distinct `party_name` with any ledger entry in period (creditor) | Building |

**Amount formatting:** All metric cards must show the full Indian-formatted amount — never abbreviated (no "48.2L", no "1.2Cr"). Use the same `fmt` function used everywhere else in the app:
```js
const fmt = (n) => `₹${Math.abs(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
```
So `₹48,24,310.50` not `₹48.2L`. The numbers are financial — the full figure matters.

Below the cards: a monthly bar chart (inline SVG, same style as existing sparklines in FinInsightsTab) showing:
- X-axis: months in the selected period
- Two bars per month: Debit (brand colour) and Credit (success colour)
- For debtors by default; toggle button to switch to creditors

#### Debtors / Creditors Tabs — Party Period Breakdown

A searchable table showing all parties that had any ledger activity in the selected period:

Columns:
- Party Name
- Opening Balance (balance at start of period — first row's balance minus that row's debit/credit)
- Total Debited in Period
- Total Credited in Period
- Closing Balance (last balance row in period)
- No. of Transactions

Sortable by any column. Searchable by party name (Fuse.js). Show 50 rows, then "Load more" or pagination.

This is read-only — no actions. Tapping a row does nothing (ledger drill-down is in the Financial section).

#### Data Fetching Hook — `useFinancialReports.js`

New hook at `src/hooks/useFinancialReports.js`:
```js
fetchPeriodSummary(from, to)
// → queries fin_ledger with txn_date filter
// → returns { debtorRows, creditorRows } both arrays of all matching rows
// → caller computes metrics client-side from these rows

fetchCurrentOutstanding()
// → SELECT SUM(remaining), party_type FROM fin_outstanding GROUP BY party_type
// → returns { debtorTotal, creditorTotal }
```

Note: the ledger tables can be large (~20k+ rows). Always use a date range filter in the query. Never fetch all rows unfiltered.

### No new Supabase tables needed for AX-2.

### Files to Create
- `src/pages/AdminReports.jsx`
- `src/hooks/useFinancialReports.js`

### Files to Modify
- `src/pages/AdminPanel.jsx` — add Reports nav item + route

### Files NOT to Touch
`AdminFinancial.jsx`, all existing financial components, `useFinancial.js`.

### Session Handoff After AX-2
Write `README/phase_ax2_done.md`. No Supabase changes needed.

---

## Phase AX-3 — Financial Party List UX Overhaul

This phase makes three big UX changes to the existing Financial party list page.

### Change 1 — Collapsible Filter Strip

**Current problem:** The filter strip on mobile is wide and wastes space — multiple rows of pills for Status, Label, Hide Settled, State filter.

**Required:** Replace with 3 "filter group buttons" that each expand on tap:

```
[ Ledger ▾ ]  [ Hide Settled ▾ ]  [ Labels ▾ ]
```

Each button shows how many filters are active as a badge (e.g. "Ledger ①" if one status filter is active). Tapping opens a small dropdown/sheet with that group's options. Tapping outside or selecting closes it.

**Group 1 — Ledger:**
Options: All / Outstanding / Receivable / Payable / Settled / Credit Bal
(These are the existing `STATUS_FILTER_OPTIONS`)

**Group 2 — Hide Settled:**
A single toggle — when active the button shows "Settled Hidden" and all settled parties are excluded from the list. This replaces the current `hideSettled` checkbox.

**Group 3 — Labels:**
Options: All / Checked ✓ / Make Receipt / Send for Checking / Not Reviewed / + custom labels
(These are the existing label filter pills from FIN-6)

**Implementation notes:**
- Use a shared `FilterDropdown` sub-component within `FinPartyList.jsx`
- The dropdown anchors below its trigger button, `position: absolute`, `z-index: 50`
- Close on outside click (use a `useRef` + document click listener)
- On desktop, the existing pill layout can remain but should also become this condensed format for consistency
- State: `openGroup` — `'ledger' | 'settled' | 'labels' | null`
- Animations: simple opacity + translateY transition, ~150ms

### Change 2 — Full-Page Ledger View

**Current problem:** Tapping a party opens `FinSlideOver` — a slide-in panel that only takes 600px width and feels cramped on mobile, especially for the ledger table.

**Required:** When a party is tapped, navigate to a dedicated full-page ledger view instead of the slide-over.

**New route:** `/admin/financial/ledger/:partyType/:partyName`
- `partyType` = `debtor` | `creditor`
- `partyName` = URL-encoded party name

**New page: `src/pages/AdminLedger.jsx`**

This page is a full-screen view of a single party's complete ledger. It contains everything currently in `FinSlideOver` but as a proper page:

- Back button (top-left) → navigates back to `/admin` with `activeSection=financial`
- Party name as page title
- Status chip + balance
- Pin button
- Share button (same PDF/WhatsApp/email functionality from `FinSlideOver`)
- Label pill (same `FinLabelPicker` from FIN-6)
- Internal tabs: Ledger / Outstanding / Contact / Insights (same 4 tabs as current slide-over)
- These tabs reuse the EXACT same components: `FinLedgerTab`, `FinOutstandingTab`, `FinContactTab`, `FinInsightsTab`

**Important:** `FinSlideOver` is NOT deleted. It may still be used in non-mobile contexts or future features. Just stop using it from `AdminFinancial` and route to `AdminLedger` instead.

**`AdminFinancial.jsx` changes:**
- Remove `selectedParty`, `slideOverOpen`, `FinSlideOver` usage
- `onPartyClick` handler now calls `navigate('/admin/financial/ledger/${partyType}/${encodeURIComponent(party.party_name)}')`
- Pass `partyType` context via URL param

**Routing changes in `AdminPanel.jsx`:**
Currently `AdminPanel` renders content sections as `{activeSection === 'financial' && <AdminFinancialContent />}` without URL routing. To support the ledger URL, the admin panel needs to handle sub-routes.

Pattern: Use `react-router-dom`'s nested `<Routes>` inside `AdminPanel`. The `/admin/*` route in `App.jsx` already wildcards, so:
```
/admin                  → AdminPanel (default: catalogue)
/admin/financial/ledger/:partyType/:partyName  → AdminLedger (full page, no sidebar needed, or with minimal back header)
```

`AdminLedger` is a standalone full-screen page — it does NOT use the `AdminPanel` sidebar. It just has its own minimal header with a back button.

In `App.jsx`:
```jsx
<Route path="/admin/financial/ledger/:partyType/:partyName" element={
  <RequireAdmin><AdminLedger /></RequireAdmin>
} />
<Route path="/admin/*" element={
  <RequireAdmin><AdminPanel /></RequireAdmin>
} />
```
The more specific route must come first.

### Change 3 — Mobile Ledger: Invoice Numbers Always Visible + Narrations Hidden

**Current problem (FinLedgerTab.jsx, mobile cards):**
The mobile `LedgerCard` component shows date + `vch_type vch_no` combined in a line, but vch_no often gets truncated because vch_type takes most of the space.

Narrations are always visible on mobile cards (they appear before the debit/credit amounts).

**Required:**

**Invoice number always visible:**
In the mobile `LedgerCard`, give `vch_no` its own dedicated line:
```
Date                          Vch Type
Vch No (full, never truncated, mono font)
Narration (hidden by default — see below)
Debit / Credit / Balance
```

The vch_no line should be: full width, `font-mono text-xs`, `color: var(--text-primary)` (slightly more prominent than muted).

**Narrations hidden by default:**
Remove narration from the default view of mobile `LedgerCard`. Add a single "Show Narrations" toggle button at the top of the mobile ledger list (above the first row) — tapping it reveals narrations for ALL rows simultaneously (state: `showNarrations` boolean in `FinLedgerTab`).

The button should be small and unobtrusive: `text-xs text-muted underline "Show narrations"` / `"Hide narrations"` toggle.

On desktop table view, narrations are already not shown (no narration column since FIN-5). No change needed for desktop.

### Files to Create
- `src/pages/AdminLedger.jsx`

### Files to Modify
- `src/pages/AdminFinancial.jsx` — remove slide-over, add navigate-to-ledger
- `src/pages/AdminPanel.jsx` — no sidebar changes; AdminLedger is standalone
- `src/App.jsx` — add AdminLedger route before /admin/* wildcard
- `src/components/financial/FinPartyList.jsx` — collapsible filter strip
- `src/components/financial/FinLedgerTab.jsx` — invoice # always visible, narration toggle

### Files NOT to Touch
`FinSlideOver.jsx` (keep for potential future use, just not invoked from AdminFinancial anymore), all other components.

### Session Handoff After AX-3
Write `README/phase_ax3_done.md`. No Supabase changes needed.

---

## Phase AX-4 — Payment Periods Page

### Goal
A dedicated sub-section within the Reports page (new tab: "Payment Periods") that shows:
- All debtors: days since last payment received, currently outstanding amount
- All creditors: days since last payment made, currently payable amount
- Sortable + filterable list

This helps answer "who hasn't paid me in a long time?" and "who do I owe the most to?"

### Where It Lives

Add a 3rd tab to `AdminReports.jsx`:
```
Reports
├── Overview
├── Period Breakdown
└── Payment Periods    ← NEW
```

### `PaymentPeriodsTab` Component

Create `src/components/financial/FinPaymentPeriodsTab.jsx`.

Props: `partyType` (controlled by a Debtors/Creditors toggle at the top of the tab).

#### Data Required

From `fin_ledger`: for each party, find the last `credit > 0` row (debtors) or last `debit > 0` row (creditors). The `txn_date` of that row = last payment date.

From `fin_outstanding`: for each party, sum of `remaining` = currently outstanding.

**Fetch strategy (inside `useFinancialReports.js`):**

```js
fetchLastPayments(partyType)
// Queries fin_ledger for all rows where:
//   - party_type = partyType
//   - (if debtor) credit > 0 OR (if creditor) debit > 0
// Returns the LATEST such row per party_name using a GROUP BY + MAX(txn_date) query
// → SELECT party_name, MAX(txn_date) as last_payment_date FROM fin_ledger
//     WHERE party_type = $1 AND (credit > 0 OR debit > 0) [appropriate for type]
//     GROUP BY party_name
// Returns array of { party_name, last_payment_date }

fetchOutstandingPerParty(partyType)
// → SELECT party_name, SUM(remaining) as outstanding FROM fin_outstanding
//     WHERE party_type = $1 GROUP BY party_name
// Returns array of { party_name, outstanding }
```

Merge these two arrays client-side by `party_name`. Compute `days_since = today - last_payment_date`.

#### UI

**Debtors/Creditors toggle** at top of tab (pill toggle, same pattern as Debtors/Creditors tabs in AdminFinancial).

**Filter strip (collapsible, same AX-3 pattern):**
- Days overdue: All / < 30 days / 30–60 days / 60–90 days / > 90 days
- Outstanding: All / Has outstanding / No outstanding (fully settled)

**Sort options:**
- Days since payment ↓ (default — most overdue first)
- Days since payment ↑
- Outstanding amount ↓
- Outstanding amount ↑
- Name A→Z

**List / Table:**

Mobile card per party:
```
[Party Name]                    [Days Badge]
Last payment: DD MMM YYYY       [X days ago]
Outstanding: ₹X,XX,XXX
```

Days badge colour coding:
- 0–29 days: success green
- 30–59 days: warning amber (brand colour)
- 60–89 days: orange (a mid tone)
- 90+ days: error red
- Never paid (no credit row ever): "No payments" in error red

Desktop table columns:
- Party Name | Last Payment | Days Since | Outstanding | Status Badge

Search: Fuse.js on party name (same pattern as elsewhere).

**"Never paid" parties:** Parties in `fin_parties` with no matching row in the last-payments query → show at bottom with "No payments recorded" and their outstanding amount if any.

#### No new Supabase tables needed.

New functions in `useFinancialReports.js`:
- `fetchLastPayments(partyType)`
- `fetchOutstandingPerParty(partyType)`

### Files to Create
- `src/components/financial/FinPaymentPeriodsTab.jsx`

### Files to Modify
- `src/pages/AdminReports.jsx` — add Payment Periods tab
- `src/hooks/useFinancialReports.js` — add two new fetch functions

### Session Handoff After AX-4
Write `README/phase_ax4_done.md`. No Supabase changes needed.

---

## Phase AX-5 — Landscape Mode Support

### Goal
The financial section (ledger especially) gets cramped on mobile in portrait. Allow landscape rotation. The PWA manifest already has `"orientation": "any"` set in AX-1. This phase makes the layout adapt properly.

### Scope
Only the financial section needs landscape-specific handling. Catalogue and Staff look fine in portrait and don't need changes.

### Changes Required

#### 1. Manifest (done in AX-1)
`"orientation": "any"` — already set.

#### 2. `AdminLedger.jsx` (the full-page ledger from AX-3)

In landscape on mobile (window width > window height, width ≥ 568px):
- The header compresses: party name + status chip on one line, tabs below on same line as back button
- The ledger table switches to desktop table mode even at mobile width (since landscape mobile is ~700px wide)
- Use `window.screen.orientation` or a CSS media query `@media (orientation: landscape)` to detect

Implementation approach: pass `isLandscape` boolean computed from `window.innerWidth > window.innerHeight` to layout logic. Update on `resize` event with a `useEffect` + cleanup.

```js
const [isLandscape, setIsLandscape] = useState(
  () => window.innerWidth > window.innerHeight
)
useEffect(() => {
  const handler = () => setIsLandscape(window.innerWidth > window.innerHeight)
  window.addEventListener('resize', handler)
  return () => window.removeEventListener('resize', handler)
}, [])
```

Pass `isLandscape` as prop to `FinLedgerTab`, `FinOutstandingTab`.

#### 3. `FinLedgerTab.jsx`

Accept an `isLandscape` prop (default `false`). When `true`, render the desktop table layout regardless of screen width.

Current pattern: `hidden md:block` for desktop table, `md:hidden` for mobile cards. Replace with:
```jsx
const showTable = isLandscape || isDesktop  // isDesktop = window.innerWidth >= 768
```
No CSS media query changes — keep existing responsive classes, just add a JS override for landscape.

#### 4. `AdminReports.jsx` + `FinPaymentPeriodsTab.jsx`

Apply the same `isLandscape` detection. In landscape, the period selector row wraps differently (presets on same line as date pickers). The metric cards go from 2-col to 3-col layout.

#### 5. `AdminFinancial.jsx` (party list page)

In landscape mode on mobile, the party cards compress to a denser 2-col grid instead of single column.

This is a nice-to-have within AX-5: if it risks breaking things, skip it and note in the README.

#### 6. `src/index.css` — Add landscape utility class

```css
@media (orientation: landscape) and (max-height: 500px) {
  .landscape-compact {
    /* Small header, tighter padding */
    --header-height: 40px;
  }
}
```

### Files to Modify
- `src/pages/AdminLedger.jsx` — isLandscape detection + layout switch
- `src/components/financial/FinLedgerTab.jsx` — accept isLandscape prop
- `src/pages/AdminReports.jsx` — landscape-aware layout
- `src/components/financial/FinPaymentPeriodsTab.jsx` — landscape-aware layout
- `src/components/financial/FinOutstandingTab.jsx` — accept isLandscape prop (minor)
- `src/index.css` — add landscape utility

### Files NOT to Touch
`public/manifest.json` (already updated in AX-1). Catalogue, Staff, Settings.

### Session Handoff After AX-5
Write `README/phase_ax5_done.md`. No Supabase changes needed.

---

## Cross-Phase Rules (Every Session Must Follow)

### 1. Never Break Existing Features
`AdminCatalogue`, `AdminStaff`, all sync tool Python files, all existing hooks — untouched unless explicitly listed in "Files to Modify" for the current phase.

### 2. CSS / Styling
- All colours via CSS variables — never hardcode hex in JSX
- Exception: `FinPdfExport.jsx` uses hardcoded RGB arrays (jsPDF can't read CSS vars) — intentional, unchanged
- Tailwind only for layout/spacing/flex/grid
- Test mentally: correct in both light AND dark mode?

### 3. Amount Formatting
```js
const fmt = (n) => `₹${Math.abs(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
```

### 4. Loading States
Use existing `Spinner.jsx` for full-area loading, `Skeleton.jsx` for list/table loading.

### 5. Error States
Use existing `toast` from `src/components/ui/Toast.jsx` for transient errors.

### 6. Mobile First
- Every component must work on 375px wide screen
- Touch targets minimum 44px height
- No horizontal overflow

### 7. Supabase Client Usage
- Public reads: `supabase` from `src/lib/supabase.js` (anon key)
- Admin writes: `supabaseAdmin` from `src/lib/supabaseAdmin.js` (service role)

### 8. File Naming
React components: PascalCase `.jsx` | Hooks: camelCase `useXxx.js` | Python: snake_case

### 9. No Console Logs in Production
Use `if (import.meta.env.DEV) console.log(...)` guard.

### 10. Screen real estate discipline
Do NOT add new persistent UI elements that push content down or clutter the screen. Every addition must either replace something, be collapsible, or be on its own page. The screens should never feel cramped.

### 11. Labels survive sync
`fin_party_labels`, `fin_custom_labels` are never touched by the sync tool. Do not change this.

---

## Supabase Migrations Summary

| Migration | Phase | File | Description |
|---|---|---|---|
| 005 | AX-1 | `005_app_settings.sql` | `app_settings` table for entity name (and future settings) |

No other migrations needed for any phase.

---

## Session Handoff — Required Files Every Time

| File | Every Session | Notes |
|---|---|---|
| Current project zip (output of previous phase) | ✅ Always | Must be output of immediately preceding phase |
| This masterplan (`ANKXIOUS_MASTERPLAN_v1.md`) | ✅ Always | Single source of truth |
| `README/phase_ax{N}_done.md` (most recent) | ✅ Always | What was built and what to know |
| `SUNDRY_DEBTORS_running_balance.xlsx` | For AX-4 only | Needed to verify query patterns for last-payment logic |
| `SUNDRY_CREDITORS_running_balance.xlsx` | For AX-4 only | Same |

---

## Opening Prompt Template

```
I am building Phase AX-{N} of the ANKxIOUS upgrade for the PriceMaster codebase.

Attached:
1. [zip] — current project state (output of Phase AX-{N-1})
2. ANKXIOUS_MASTERPLAN_v1.md — this master plan
3. phase_ax{N-1}_done.md — what was built last phase
[4. SUNDRY_DEBTORS_running_balance.xlsx — only for AX-4]
[5. SUNDRY_CREDITORS_running_balance.xlsx — only for AX-4]

Please read all files, then build Phase AX-{N} exactly as specified in the masterplan.
Deliver a zip of the updated project + README/phase_ax{N}_done.md inside it.
```

---

## Phase README Format (Every Session Must Write)

Each `phase_ax{N}_done.md` must include:
- What was built (component-level detail)
- Files created (with paths)
- Files modified (with exact changes described)
- Files NOT changed
- Any non-obvious decisions made and why
- What the next phase must know
- Any Supabase setup steps needed

---

## Handoff Checklist (Before Ending Each Session)

- [ ] All new files created at correct paths
- [ ] Modified files changed minimally and correctly
- [ ] `README/phase_ax{N}_done.md` written with full detail
- [ ] This masterplan copied into zip as `README/ANKXIOUS_MASTERPLAN_v1.md`
- [ ] Zip delivered to user
- [ ] No `console.log` left in production code
- [ ] No hardcoded colours in JSX (exception: FinPdfExport.jsx)
- [ ] Dark mode tested mentally
- [ ] Mobile layout tested mentally (375px)
- [ ] No invented Supabase table names — only tables defined in this document or the original masterplan

---

## Phase Summary Quick Reference

| Phase | Code | Key Deliverables | Supabase? |
|---|---|---|---|
| 0 | AX-0 | Full CSS variable palette swap (amber/cream → space dark + violet); FinPdfExport RGB arrays updated | None |
| 1 | AX-1 | Rebrand → ANKxIOUS everywhere; space-themed A logo icons; entity name setting in admin panel; PDF entity name from DB | `005_app_settings.sql` |
| 2 | AX-2 | New "Reports" page with period selector, Overview metrics, monthly bar chart, period breakdown table | None |
| 3 | AX-3 | Collapsible filter strip; full-page ledger via URL routing; invoice # always visible on mobile; narrations hidden by default | None |
| 4 | AX-4 | Payment Periods tab in Reports: last payment date, days since, outstanding per party for debtors + creditors | None |
| 5 | AX-5 | Landscape mode: manifest orientation:any (AX-1), ledger switches to table in landscape, Reports layout adapts | None |

---

*Masterplan v1.0 — written after full review of pricemaster_fin6_fix.zip, FINANCIAL_REPORTS_MASTERPLAN_v2.md, FIN6_LABEL_REDESIGN_BRIEF.md, and all phase READMEs.*
*Place this file at `README/ANKXIOUS_MASTERPLAN_v1.md` inside every project zip going forward.*
