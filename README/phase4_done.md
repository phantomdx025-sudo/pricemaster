# Phase 4 — Done ✅
## Admin Panel: Catalogue Management

---

## What Was Built

### Architecture Change: AdminPanel as Shell
`AdminPanel.jsx` is now a full shell. It embeds `AdminCatalogue` and `AdminStaff` as inline content — no sub-routes needed. Navigation between sections happens via state (`activeSection`), not URL routing. App.jsx now only needs `/admin` and `/admin/*` routes (both render `AdminPanel`).

---

### `pages/AdminPanel.jsx` — Dashboard shell
- Desktop: `Sidebar` on the left, content area on the right
- Mobile: top header + 2-tab bar (`Catalogue` | `Staff`)
- Handles admin logout (calls `useAuth().logout()`, navigates to `/`)
- Shows admin email in desktop sidebar footer
- Embeds `AdminCatalogue` and `AdminStaff` inline (state-driven)

---

### `pages/AdminCatalogue.jsx` — Full admin catalogue editor

Layout mirrors the staff `Catalogue.jsx` but every item is editable:

```
<CategoryTabs>      same component as staff view (read)
  [Manage Categories button — bottom of desktop sidebar, top-right on mobile]
  <content header>  category name + item count + Add Item button
  <TabManager>      replaces plain TabBar — tabs are chips with ✕ delete buttons + inline add form
  <item list>       desktop: table with Edit/Delete actions | mobile: cards with Edit/Delete buttons
<ItemForm>          slide-in drawer from right
<CategoryManager>   modal
```

**State management:** AdminCatalogue uses `localCategories`, `localTabs`, `localItems` on top of `useInventory`. After every mutation, `clearCache()` is called so the next navigation re-fetches fresh data. The local state is updated optimistically — no full re-fetch needed after add/edit/delete.

---

### `components/admin/ItemForm.jsx` — Slide-in drawer
- Slides in from the right (CSS transform, `transition: 0.28s cubic-bezier`)
- Backdrop fades in behind it
- Fields: Item Name (required), Rate, W/O GST, Unit/Qty, Qty Rate, QTY w/GST — all `type="text"`, never number
- Edit mode: pre-fills form from the item object
- Add mode: empty form
- Trailing whitespace stripped from all fields on save
- Save calls parent `onSave(formData)` — parent handles the actual API call

---

### `components/admin/TabManager.jsx` — Inline tab manager
Renders below the category header in AdminCatalogue. Replaces the plain `TabBar`.
- Each tab = chip with name (click to select) + ✕ red trash button
- "Add Tab" = dashed button → expands to inline input + Add/Cancel buttons
- Delete flow: if `isReconfirmed` → cascade warning modal → delete. If not → password reconfirm → cascade warning → delete.
- Cascade warning lists exactly what will be deleted

---

### `components/admin/CategoryManager.jsx` — Modal
- Shows list of all categories with delete button per row
- Active category highlighted with brand color
- "Add New Category" button expands inline form: name (required) + emoji icon (optional)
- Delete flow: same reconfirm + cascade warning as TabManager (categories cascade to tabs + items)

---

### `components/admin/PasswordReconfirm.jsx` — New component
A clean modal that re-runs `supabase.auth.signInWithPassword` with the admin's own email.
- Shows ShieldCheck icon, contextual title + description (set by caller)
- Password input with show/hide toggle
- Error shown inline on wrong password
- On success: calls `onConfirmed()` callback
- The 5-minute cache is managed by `useAuth.isReconfirmed` + `useAuth.reconfirmedAt` (built in Phase 1/2)

---

### `components/layout/Sidebar.jsx` — Fully implemented
- Desktop vertical sidebar: brand logo, nav items with active amber highlight, admin email + logout
- Mobile: not rendered (AdminPanel uses its own mobile tab bar)
- Accepts: `items`, `activeId`, `onSelect`, `onLogout`, `adminEmail`

---

### `components/ui/Spinner.jsx` — Updated
Added `color` prop so spinners inside amber/red buttons can use `var(--text-inverse)` instead of brand orange.

---

### `supabase/functions/catalogue-write/index.ts` — New edge function
All catalogue write operations go through this function. Protected by JWT auth — verifies the caller's Supabase Auth session before proceeding.

Actions dispatched by action string:
| Action | Payload | What it does |
|---|---|---|
| `add-item` | `{ tab_id, item_name, rate, rate_without_gst, unit_qty, qty, qty_with_gst }` | Inserts new item, auto-computes `row_index` |
| `update-item` | `{ id, ...fields }` | Updates all text fields |
| `delete-item` | `{ id }` | Deletes item row |
| `add-tab` | `{ category_id, name }` | Inserts new tab, auto-computes `position` |
| `delete-tab` | `{ id }` | Deletes tab (cascades to items via FK) |
| `add-category` | `{ name, icon? }` | Inserts new category, auto-computes `position` |
| `delete-category` | `{ id }` | Deletes category (cascades to tabs + items) |

All values stored as TEXT — never cast to numeric.

---

### `hooks/useCatalogueWrite.js` — New hook
Thin wrapper for `catalogue-write` edge function.
- Gets current session JWT from `supabase.auth.getSession()`
- POSTs `{ action, payload }` with Bearer auth header
- Returns `{ call, loading, error }` where `call(action, payload)` returns the response JSON

---

## Files Changed / Created in Phase 4

```
src/
├── pages/
│   ├── AdminPanel.jsx           ← REPLACED: full shell with sidebar + mobile tabs
│   ├── AdminCatalogue.jsx       ← REPLACED: full admin catalogue editor
│   └── AdminStaff.jsx           ← UPDATED: placeholder that works as embedded content
├── hooks/
│   └── useCatalogueWrite.js     ← NEW: edge function caller
├── components/
│   ├── layout/
│   │   └── Sidebar.jsx          ← REPLACED: full admin sidebar
│   ├── admin/
│   │   ├── ItemForm.jsx         ← REPLACED: slide-in drawer
│   │   ├── TabManager.jsx       ← REPLACED: full tab manager
│   │   ├── CategoryManager.jsx  ← REPLACED: full category manager
│   │   └── PasswordReconfirm.jsx ← NEW: reconfirm modal
│   └── ui/
│       └── Spinner.jsx          ← UPDATED: color prop added
├── App.jsx                      ← UPDATED: admin sub-routes simplified
supabase/
└── functions/
    └── catalogue-write/
        └── index.ts             ← NEW: admin write edge function
README/
└── phase4_done.md               ← NEW (this file)
```

All Phase 1–3 files are **unchanged** (except Spinner + App.jsx as noted).

---

## Edge Function Deployment

```bash
supabase functions deploy catalogue-write
```

Required secrets (already set from Phase 2):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## What Phase 5 Must Know

1. **`AdminPanel` is the shell.** Phase 5 replaces `AdminStaff.jsx` with real content. It will be embedded inside `AdminPanel` as `{activeSection === 'staff' && <AdminStaff />}` — so it must render as a flex content pane, not a full-page `min-h-dvh` layout.

2. **`useCatalogueWrite` pattern is the template for staff writes.** Phase 5 staff mutations (`approve`, `reject`, `revoke`) should call a similar `staff-write` edge function following the same `{ action, payload }` convention.

3. **`PasswordReconfirm` is reusable.** If Phase 5 needs admin confirmation before revoke/delete, import it directly.

4. **`useAuth.isReconfirmed`** — the 5-minute cache is module-level in `useAuth`. The same instance is shared between `AdminPanel` → `AdminCatalogue` → `TabManager` / `CategoryManager` / `PasswordReconfirm`. Phase 5 can call `reconfirmIdentity` from `useAuth()` in `AdminStaff` the same way.

5. **Supabase Realtime** — Phase 5 adds realtime subscriptions on `staff_users`. Use `supabase.channel()` pattern, subscribe in a `useEffect`, and unsubscribe on cleanup.
