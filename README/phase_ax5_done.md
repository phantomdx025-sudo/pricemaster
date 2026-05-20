# Phase AX-5 — Landscape Mode Support

## What Was Built

Landscape mode support for the financial section. The PWA manifest `"orientation": "any"` was already set in AX-1. This phase makes the layout **adapt properly** when the device is rotated to landscape.

---

## Changes Made

### 1. `src/index.css` — Landscape utility classes added

Added at the bottom of the file:

```css
@media (orientation: landscape) and (max-height: 500px) {
  .landscape-compact { --header-height: 40px; }
  .landscape-compact-header { padding-top: 6px; padding-bottom: 6px; }
  .landscape-compact-row    { padding-top: 4px;  padding-bottom: 4px;  }
}
```

- `.landscape-compact` — applied to the outermost div of `AdminLedger` in landscape, sets a CSS variable for header height
- `.landscape-compact-header` / `.landscape-compact-row` — tight vertical padding for header rows when height is constrained

---

### 2. `src/pages/AdminLedger.jsx` — Landscape detection + compressed header

- Added `isLandscape` state computed from `window.innerWidth > window.innerHeight`
- Subscribed to `resize` event with cleanup in a `useEffect`
- Outer wrapper div gets `landscape-compact` class when in landscape
- Header inner row uses `py-1.5 landscape-compact-header` (tighter) vs `py-3` (normal) based on `isLandscape`
- Balance row uses `pb-1.5` (tighter) vs `pb-3` based on `isLandscape`
- `isLandscape` passed as prop to `FinLedgerTab` and `FinOutstandingTab`

---

### 3. `src/components/financial/FinLedgerTab.jsx` — Desktop table in landscape

- Accepts new `isLandscape` prop (default `false`)
- `showTable = isLandscape || isDesktop` computed variable
- Desktop table div: `className={showTable ? 'block' : 'hidden'}` — replaces old `hidden md:block`
- Mobile cards div: `className={showTable ? 'hidden' : 'block'}` — replaces old `md:hidden`

**Effect:** On a ~700px-wide landscape mobile screen, users now see the full desktop table layout instead of the compact mobile cards. Much more data visible in the limited landscape viewport height.

---

### 4. `src/components/financial/FinOutstandingTab.jsx` — Accepts isLandscape prop

- Added `isLandscape = false` to the prop destructuring
- No layout changes yet — outstanding invoices use a fixed card layout that reads fine in both orientations
- Prop accepted for consistency and future extension

---

### 5. `src/pages/AdminReports.jsx` — Landscape-aware Reports layout

**`isLandscape` detection:**
Same pattern as AdminLedger — `useState` + `useEffect` + `resize` listener.

**`PeriodSelector` component updated:**
- Accepts `isLandscape` prop
- In landscape: presets pills + date pickers share a single `flex-row items-center` row — saves vertical space
- In portrait: original stacked layout (presets above, date inputs below)

**`OverviewTab` component updated:**
- Accepts `isLandscape` prop
- Metric cards grid: `grid-cols-3` in landscape vs `grid-cols-2 md:grid-cols-3` in portrait
- Loading skeleton grid: same landscape override

**`isLandscape` passed** to `OverviewTab` and `PeriodSelector` from the main `AdminReports` component.

---

### 6. `src/components/financial/FinPaymentPeriodsTab.jsx` — Landscape table override

- Added `isLandscape` detection (same useState + useEffect + resize pattern)
- Desktop table / mobile cards split updated: `showTable = isLandscape || isDesktop`
- Uses an IIFE pattern (`(() => { ... })()`) inside JSX to compute `showTable` without adding extra state
- Desktop table: `className={showTable ? 'block overflow-x-auto rounded-xl' : 'hidden'}`
- Mobile cards: `className={showTable ? 'hidden' : 'flex flex-col gap-2'}`

---

## Files Created

None (AX-5 is modifications only, as specified).

## Files Modified

| File | Changes |
|---|---|
| `src/index.css` | Added landscape utility classes at bottom |
| `src/pages/AdminLedger.jsx` | isLandscape state, compressed header, passes prop to children |
| `src/components/financial/FinLedgerTab.jsx` | isLandscape prop, showTable logic, replaces md:block/md:hidden |
| `src/components/financial/FinOutstandingTab.jsx` | isLandscape prop (accepted, no layout change) |
| `src/pages/AdminReports.jsx` | isLandscape state, PeriodSelector landscape row, OverviewTab 3-col grid |
| `src/components/financial/FinPaymentPeriodsTab.jsx` | isLandscape state, showTable for table/card split |
| `README/phase_ax5_done.md` | This file |

## Files NOT Changed

Everything else — AdminCatalogue, AdminStaff, AdminFinancial, AdminSettings, AdminPanel, App.jsx, all hooks, sync tool Python files, manifest.json, all other components.

---

## Non-Obvious Decisions

### `AdminFinancial.jsx` party card 2-col grid in landscape — SKIPPED
The masterplan noted this as a "nice-to-have within AX-5: if it risks breaking things, skip it and note in the README." Given that `AdminFinancial` uses `FinPartyList` which has its own complex filter/sort state, adding a landscape prop path through multiple components risked touching too many files. The ledger view (where users spend most time reading rows) is more important for landscape optimization. Skipped as planned.

### IIFE pattern in FinPaymentPeriodsTab
The desktop table/card split in `FinPaymentPeriodsTab` is inside a JSX expression that already uses `(...)` with a conditional render. To avoid restructuring a large JSX block, `showTable` is computed inside an IIFE (`(() => { const showTable = ...; return (<>...</>) })()`). This is valid React and keeps the diff minimal.

### `isDesktop` computed inline
`isDesktop` is intentionally computed inline (not as state) — it's only used at render time to determine initial table visibility, and `isLandscape` state handles the dynamic switching. No need for separate state.

---

## What the Next Phase Must Know

**AX-5 is the final phase of the ANKXIOUS_MASTERPLAN_v1.** All 6 phases complete.

Phase summary:
- AX-0: CSS palette swap
- AX-1: Rebrand + entity name setting + PWA icons
- AX-2: Financial Reports dedicated page
- AX-3: Ledger UX overhaul (full-page, filter strip, mobile fixes)
- AX-4: Payment Periods tab
- AX-5: Landscape mode ✅

---

## Supabase Setup

No Supabase changes. No migrations needed.

---

## Handoff Checklist

- [x] All modified files changed minimally and correctly
- [x] README/phase_ax5_done.md written with full detail
- [x] ANKXIOUS_MASTERPLAN_v1.md preserved in zip
- [x] No console.log left in production code
- [x] No hardcoded colours in JSX (FinPdfExport.jsx exception unchanged)
- [x] Dark mode unaffected (changes are layout-only, no colour touches)
- [x] Mobile portrait layout unchanged (isLandscape = false is the default)
- [x] AdminFinancial 2-col landscape grid skipped and documented above
