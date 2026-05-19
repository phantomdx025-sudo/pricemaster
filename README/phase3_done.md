# Phase 3 — Done ✅
## Staff Catalogue View

---

## What Was Built

### `pages/Catalogue.jsx` — Main catalogue page
Full orchestrator. Manages all state: active category, active tab, active items, search overlay, highlight. Layout:
```
<Navbar>          staffUser name + designation (desktop), search icon, logout
<CategoryTabs>    desktop: sticky left sidebar | mobile: horizontal pill strip
  <content area>
    [category title bar — desktop only]
    <TabBar>      horizontal scrollable tabs for the active category
    <ItemTable>   desktop: striped table | mobile: card list
<SearchBox>       full-screen overlay, rendered via portal at root
```

### `components/layout/Navbar.jsx` — Fleshed out for catalogue
- Brand logo (amber pill icon + "PriceMaster")
- Staff name + designation (desktop, hidden on mobile)
- Search icon button (triggers overlay)
- Logout button

### `components/catalogue/CategoryTabs.jsx`
- **Desktop** (`md+`): sticky left sidebar, `w-48/w-56`, vertical list of category buttons with active amber highlight + dot indicator. Loading skeleton via `animate-pulse`.
- **Mobile** (`<md`): horizontally scrollable pill strip. Active pill becomes filled amber. Loading skeleton.
- Handles empty categories gracefully.

### `components/catalogue/TabBar.jsx`
- Horizontally scrollable, `scrollbarWidth: none`
- Active tab scrolls into viewport automatically on change (via `scrollIntoView`)
- Loading skeleton
- Returns `null` when `tabs.length === 0` (avoids empty bar flash)

### `components/catalogue/ItemTable.jsx`
Columns: Sl.No | Item Name | Rate | W/O GST | Unit/Qty | Qty Rate | QTY w/GST
- **Desktop** (`md+`): `<table>` with zebra-striped rows. NULL/empty values render as `—` (muted). Highlighted row gets amber tint + outline.
- **Mobile** (`<md`): card list, each card shows item name prominently then a 3-col rate grid below.
- Loading: centered `Spinner`
- Empty: friendly empty state with emoji icon
- `highlightId` prop: scrolls matching row into view and applies amber highlight (used after search navigation)

### `components/catalogue/SearchBox.jsx`
- Full-screen overlay (`z-50`), click-outside and Escape to close
- Input auto-focuses on open, clears on close
- Fuse.js results update on every keystroke (debounce not needed at this scale)
- Each result shows: icon (Category/Tab/Item), label, type badge
- Selecting a result calls `onNavigate({ categoryId, tabId, itemId })` and closes
- Empty query: "Type to search" prompt. No results: graceful message.

### `hooks/useInventory.js` — Fully implemented
- `fetchCategories()` — orders by `position`, caches in module-level `cache.categories`
- `fetchTabs(categoryId)` — orders by `position`, caches in `cache.tabs[categoryId]`
- `fetchItems(tabId)` — orders by `row_index`, strips trailing `\n` from `item_name`, caches in `cache.items[tabId]`
- `fetchAllTabs()` — used once for search index build (not cached separately)
- `fetchAllItems()` — used once for search index build (selects only `id, tab_id, item_name, row_index`)
- Separate loading flags: `loadingCats`, `loadingTabs`, `loadingItems` + combined `loading`
- `clearCache()` — Phase 4 calls this after any write to Supabase

### `utils/search.js` — Fixed `tabCategoryMap`
`buildSearchIndex` now correctly maps `itemId → categoryId` via a `tabCategoryMap` built from the `allTabs` array, so clicking an item result in SearchBox navigates to the right category.

---

## Files Changed in Phase 3

```
src/
├── pages/
│   └── Catalogue.jsx                ← REPLACED: full catalogue page
├── hooks/
│   └── useInventory.js              ← REPLACED: fully implemented
├── utils/
│   └── search.js                    ← updated: tabCategoryMap fix
├── components/
│   ├── layout/
│   │   └── Navbar.jsx               ← REPLACED: staff name + search + logout
│   └── catalogue/
│       ├── CategoryTabs.jsx         ← REPLACED: desktop sidebar + mobile strip
│       ├── TabBar.jsx               ← REPLACED: scrollable tab bar
│       ├── ItemTable.jsx            ← REPLACED: table (desktop) + cards (mobile)
│       └── SearchBox.jsx            ← REPLACED: full-screen search overlay
README/
└── phase3_done.md                   ← NEW (this file)
```

All other Phase 1 and Phase 2 files are **unchanged**.

---

## BUTTONS Category (id=12) — Empty Tab State
Handled: when `tabs.length === 0` after loading, Catalogue shows a "No tabs in this category" empty state with an icon. `TabBar` returns `null` (no bar rendered). `ItemTable` is not shown.

---

## Search Index Build Timing
The Fuse.js index is built **once** after categories load, using two parallel Supabase queries (`fetchAllTabs` + `fetchAllItems`). This happens in the background — the catalogue is fully usable while it builds. The search icon in the Navbar is always visible; if the user taps it before the index is ready, they see the overlay with an empty-query prompt (not broken).

---

## What Phase 4 Must Know

1. **`clearCache()`** from `useInventory` must be called after any write (add/edit/delete item, tab, or category) so the next read re-fetches fresh data.
2. **`highlightItemId`** in Catalogue — Phase 4's AdminCatalogue does not use this; it's staff-only. But the `ItemTable` component is reusable — Phase 4 may use it in read-only mode.
3. The **Navbar** in Catalogue is staff-specific (shows staffUser name). Admin panel has its own Sidebar/Navbar (Phase 4 builds those separately in AdminPanel.jsx).
4. **`Sidebar.jsx`** is still a stub — Phase 4 will implement it for the AdminPanel layout.
5. All catalogue components are **read-only** — no edit buttons. Phase 4 builds admin variants in `src/components/admin/`.
