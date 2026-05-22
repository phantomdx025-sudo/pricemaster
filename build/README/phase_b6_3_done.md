# Phase B6-3 — Themes + Report Insights (Done)

**Baseline:** `pricemaster_b6_2_done.zip` (B6-2 complete — BX-5, BX-6, BX-7 done)
**Covers:** BX-8, BX-10 (10A, 10B, 10C, 10D, 10E)

---

## What Was Built

### BX-8 — Multiple Full Colour Themes

**What was needed:** 5 colour themes selectable via swatches in Settings. Selection applies immediately across the whole app AND saves to the database so every user (admin + staff) loads the same theme on their next page open.

**How themes work:**
- Themes are applied by setting `data-theme` attribute on `<html>`. The existing `:root` and `.dark` blocks remain the default Space Dark palette. Each additional theme is a `[data-theme="X"]` block that overrides all CSS variables.
- 5 themes implemented:
  - `space` — Space Dark (default, current palette — electric violet)
  - `emerald` — Emerald Night (dark green base, emerald accent `#3ecf74`)
  - `rose` — Rose Dark (warm dark base, rose accent `#f06884`)
  - `ocean` — Ocean Depth (deep teal base, cyan accent `#00d4ff`)
  - `amber` — Amber Classic (cream/warm light theme, amber accent `#d4842a`)

**`src/index.css` changes:**
- Added 4 new `[data-theme="X"]` blocks after the `.dark` block: `emerald`, `rose`, `ocean`, `amber`. Each defines all 20 CSS variables matching the Space Dark coverage exactly. Amber is the one light theme — its shadows are much softer (rgba 0.10–0.18 vs 0.45–0.72).

**`src/hooks/useAppSettings.js` changes:**
- Appended `fetchTheme()` — reads `app_settings` where `key = 'theme'`, returns value string (default: `'space'`). Uses `supabase` anon client. Returns `'space'` gracefully if key doesn't exist yet or on error.
- Appended `setTheme(themeId)` — upserts `{ key: 'theme', value: themeId }` with `onConflict: 'key'`. Uses same `supabase` client (same pattern as `setEntityName`).

**`src/App.jsx` changes:**
- Added `import { useState, useEffect }` (was only `useState` before).
- Added `import { fetchTheme } from './hooks/useAppSettings'`.
- Added a `useEffect` inside `App()` that calls `fetchTheme()` on mount and sets `document.documentElement.setAttribute('data-theme', theme)`. This runs on every page load for both admin and staff, ensuring the saved theme is always applied.

**`src/pages/AdminSettings.jsx` changes (full rewrite of the file):**
- Added `Palette` to lucide-react imports.
- Added `fetchTheme, setTheme` to `useAppSettings` imports.
- Added `THEMES` constant (array of 5 `{ id, name, swatch }` objects — swatch is the hex brand accent colour for each theme).
- Added `activeTheme` + `themeLoading` state.
- `useEffect` on mount loads current theme from DB via `fetchTheme()`.
- `handleThemeChange(themeId)` — immediately updates local state, sets `data-theme` on `<html>` (instant visual feedback), then calls `setTheme(themeId)` and shows `toast.success`/`toast.error`.
- New "Colour Theme" card below the PDF Settings card: shows 5 swatch buttons in a `flex flex-wrap gap-4` row. Each swatch is a `w-10 h-10 rounded-xl` with the theme's accent colour as background. Active theme gets `scale(1.15)`, a white/primary border, and a ring shadow. Label below each swatch shows the theme name, bolder + primary colour when active.
- Loading state shows a pulse skeleton for the theme picker area.

**Note on dark mode toggle:** The `data-theme` system is now the primary theming mechanism. The `applySystemTheme()` in `App.jsx` that adds/removes the `.dark` class still runs (it wasn't touched), but because all `[data-theme]` blocks override `:root` without relying on `.dark`, the `.dark` class has no visual effect when any theme is set. The `.dark` block still serves as a fallback if `data-theme` is never set (e.g. first-ever load before DB responds). This is intentional — no code was removed, just layered on top.

---

### BX-10 — Additional Report Insights (5 sub-features)

All 5 features are in `src/pages/AdminReports.jsx` only.

#### BX-10A — Top 10 Debtors by Outstanding (Overview Tab)

A new `TopDebtorsList` component placed at the bottom of the Overview tab. It reads from `debtorOutstandingList` — a new state variable in `AdminReports` that is fetched alongside the existing period data using `fetchOutstandingPerParty('debtor')`.

- Shows an expandable/collapsible panel (collapsed by default for screen discipline).
- Header shows "Top 10 Debtors by Outstanding" with a count badge and ChevronDown/Up toggle.
- When expanded: lists up to 10 parties sorted descending by outstanding. Each row shows rank number, party name (tappable — navigates to their ledger), the outstanding amount in `var(--error)` colour, and a mini bar below showing relative width as a percentage of the top party's outstanding.
- Zero-outstanding parties are filtered out before ranking.
- The `navigate` function is passed in as a prop from `OverviewTab` (which calls `useNavigate()`).

`AdminReports.load()` and `loadAllTime()` both now fetch `fetchOutstandingPerParty('debtor')` in parallel with the other fetches.

#### BX-10B — Collection Efficiency Card (Overview Tab)

New `CollectionEfficiencyCard` component placed above TopDebtorsList in a 2-column grid alongside the Net Position card. Shows:
- "Collection Efficiency" label with a `Zap` icon.
- Large percentage: `Math.min(100, Math.round(receivableCollected / totalTurnover * 100))`. Capped at 100% (edge case: if credit > debit due to advances).
- Colour changes: >75% = `var(--success)` (green), >50% = `var(--warning)` (amber), ≤50% = `var(--error)` (red).
- A linear progress bar below the percentage using the same colour.
- Sub-text: "{collected} collected of {billed} billed".
- Returns 0% (no errors) when `totalTurnover` is 0.

#### BX-10C — Net Position Card (Overview Tab)

New `NetPositionCard` component placed beside the Collection Efficiency card in the same 2-column grid. Shows:
- "Net Position" label with a `Scale` icon.
- `debtorOutstanding - creditorPayable`. Uses `+` prefix when positive, `−` prefix when negative (absolute value displayed).
- Green when positive (net receivable), amber when negative (net payable).
- Sub-text clarifies what the figure means and the two components used.

#### BX-10D — Most Active Month Callout (Period Breakdown Tab)

`getMostActiveMonth(rows)` helper function counts transactions per `YYYY-MM` month from raw ledger rows, finds the month with the highest count, and returns `{ month, label, count }` or `null` if no data.

- `mostActiveMonth` is memoised from `rawRows` (the rows for the current tab — debtors or creditors).
- Rendered as a branded callout strip at the **bottom** of the tab content, after Load more. Appears when data exists, disappears when the tab is empty.
- Layout: `BarChart2` icon + "Most Active Month" heading + "{Month Year} — {N} transactions" subtitle.
- Uses `var(--brand-light)` background with `var(--brand-border)` border — same style as the All Time badge.
- Updates automatically when switching between Debtors/Creditors tabs.

#### BX-10E — Export CSV Button (Period Breakdown Tab)

`exportCSV(data, filename)` client-side helper: builds a CSV string from the breakdown data array (Party Name, Total Debited, Total Credited, Closing Balance, Txns). Party names are double-quote escaped. Uses `Blob + URL.createObjectURL` — no dependencies.

- Export button placed in the toolbar row beside the search input.
- Only shown when `sorted.length > 0` (no empty export).
- `Download` icon from lucide-react + "Export CSV" label.
- Exports ALL sorted rows (not just the current `showCount` paginated slice) — so the user always gets the full dataset even if they haven't clicked "Load more".
- Filename: `debtors_breakdown.csv` or `creditors_breakdown.csv` depending on active tab.
- The search input was pulled into the same `flex items-center gap-2 flex-wrap` container as the export button for tidy layout.

---

## Files Created

| File | Purpose |
|---|---|
| `README/phase_b6_3_done.md` | This file |

## Files Modified

| File | Changes |
|---|---|
| `src/index.css` | BX-8: Added 4 new `[data-theme]` blocks (emerald, rose, ocean, amber) after the `.dark` block |
| `src/hooks/useAppSettings.js` | BX-8: Appended `fetchTheme()` and `setTheme()` exports |
| `src/App.jsx` | BX-8: Added `useEffect` + `fetchTheme` import to apply DB theme on every load; added `useEffect` import |
| `src/pages/AdminSettings.jsx` | BX-8: Full rewrite — added Palette import, THEMES constant, theme state, `handleThemeChange`, theme picker card |
| `src/pages/AdminReports.jsx` | BX-10: Added `Download, Scale, Zap` lucide imports; `fetchOutstandingPerParty` to hook destructure; `debtorOutstandingList` state; updated `load()` + `loadAllTime()` to fetch outstanding per party; added `TopDebtorsList`, `CollectionEfficiencyCard`, `NetPositionCard` components; updated `OverviewTab` signature + render; added `exportCSV` helper, `getMostActiveMonth` helper; updated `PeriodBreakdownTab` with CSV button + most active month callout |

## Files NOT Changed

AdminFinancial, AdminLedger, AdminStaff, AdminCatalogue, AdminPanel,
FinPaymentPeriodsTab, FinPartyList, FinDashboardCards, FinPdfExport (themes intentionally don't affect PDF),
Sidebar, all other UI components, all hooks except useAppSettings and useFinancialReports (the latter not modified — only its existing `fetchOutstandingPerParty` was used),
tailwind.config.js, vite.config.js, postcss.config.js, public/*, supabase/*, scripts/*.

---

## Non-Obvious Decisions

**BX-8 — `[data-theme]` overrides `:root` not `.dark`:** Each theme block is `[data-theme="X"]` on `<html>`, not `.dark`. This means themes always win regardless of the `.dark` class, and the Amber (light) theme works correctly without needing to remove the `.dark` class first. The precedence in CSS is: `[data-theme]` > `.dark` > `:root` — exactly what we want.

**BX-8 — `useAppSettings.js` uses `supabase` (anon) for setTheme:** Not `supabaseAdmin`. The note in the file explicitly says `supabaseAdmin` uses Deno.env and is browser-incompatible. The existing `setEntityName` and `setPdfBreakdownSetting` both use anon `supabase` with RLS upsert — `setTheme` follows the same pattern.

**BX-10A — TopDebtorsList collapsed by default:** Keeps the Overview tab from becoming overwhelmingly long on first load. The expand/collapse is a single boolean state with ChevronDown/Up indicator — standard pattern in this codebase.

**BX-10A — debtorOutstandingList fetched globally not inside OverviewTab:** The outstanding data is fetched in `AdminReports`'s `load()` / `loadAllTime()` functions so it's available even if the user switches to the Period Breakdown tab. If it were fetched inside OverviewTab, it would re-fetch on every render. One fetch per "Apply Period" click is the correct pattern.

**BX-10E — Exports all sorted rows, not just visible:** The "Load more" pagination is a UI affordance only — the user shouldn't have to click 10 times to export all 500 parties. `exportCSV(sorted, ...)` exports the entire sorted+filtered dataset regardless of `showCount`.

**BX-10E — CSV party names are double-quote escaped:** `"${name.replace(/"/g, '""')}"` ensures party names with commas or quotes don't corrupt the CSV. Essential for Indian business names which can contain unusual characters.

---

## What Next Phase Must Know

- B6-3 is the final planned phase of the B6 upgrade series. The masterplan is complete.
- `app_settings` keys now in use: `entity_name` (AX-1), `pdf_breakdown` (BX-7), `theme` (BX-8).
- The `data-theme` attribute on `<html>` is now the primary styling mechanism. Any future theming must add a new `[data-theme="X"]` block in `index.css` and add the theme to the `THEMES` array in `AdminSettings.jsx`.
- `src/App.jsx` runs `fetchTheme()` on mount — this adds one Supabase call per page load for all users. It's a single lightweight select on a small table — acceptable.
- The `BarChart2` icon is now imported in `AdminReports.jsx` (was previously imported but not used for any new elements in B6-1/2 — now used for the Most Active Month callout).

## Supabase Setup

No migrations needed. `app_settings` table already exists. The `theme` key is created on first theme selection via upsert. Default before first save: `fetchTheme()` returns `'space'` — the original Space Dark palette — so newly deployed instances look exactly as before until a theme is chosen.
