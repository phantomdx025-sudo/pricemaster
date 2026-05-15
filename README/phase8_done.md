# Phase 8 — Bug Fixes

> Session type: Bug-fix only. No new features. All 7 bugs from `BUGS_TO_FIX.md` resolved.

---

## What Was Fixed

### Bug 1 — CRITICAL: Mobile items invisible (`src/pages/Catalogue.jsx`)
- Changed outer body wrapper from `flex flex-1 min-h-0` → `flex flex-col flex-1 min-h-0 md:flex-row`
  - On mobile: CategoryTabs strip now stacks **above** the content column instead of sitting side-by-side
- Removed `overflow-hidden` from the content column div → replaced with `min-h-0`
- Added `min-h-0` to the items scroll container (`flex-1 overflow-y-auto min-h-0`)
  - Without `min-h-0`, the flex child expands to intrinsic height past the viewport, breaking scroll

### Bug 2 — CRITICAL: Staff signup/login crashes with FetchError (`supabase/functions/staff-signup/index.ts`, `staff-login/index.ts`)
- Replaced `import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'` (WASM, fails on cold start)
- With `import bcrypt from 'https://esm.sh/bcryptjs@2.4.3'` (pure JS, reliable in Deno edge env)
- Updated API calls: `bcrypt.hash(password, 10)` → `bcrypt.hashSync(password, 10)`
- Updated: `await bcrypt.compare(...)` → `bcrypt.compareSync(...)`

### Bug 3 — CRITICAL: Push fails "no such column: position" (`sync/sync_core.py`)
- Added `_ensure_column()` helper at start of `push()`, right after DB connection
- Safely adds `inv_categories.position`, `inv_categories.icon`, `inv_tabs.position` if missing
- Uses `PRAGMA table_info` to check before ALTER — idempotent, no-op if columns already exist
- Runs `conn.commit()` after migration before any SELECT

### Bug 4 — HIGH: Null response destructure crash (`src/pages/Home.jsx`)
- Added `if (!res.data) throw new Error('No response from server. Please try again.')` in both:
  - `StaffSignupPanel.handleSubmit` — before `const { user, error: bodyError } = res.data`
  - `StaffLoginPanel.handleSubmit` — before `const { session, error: bodyError } = res.data`

### Bug 5 — HIGH: Skeleton flicker on re-render (`src/components/ui/Skeleton.jsx`, `src/components/catalogue/ItemTable.jsx`)
- Added `const NAME_WIDTHS` fixed array of 10 widths in `Skeleton.jsx`
- `Row` now accepts `index` prop; uses `NAME_WIDTHS[index % NAME_WIDTHS.length]` instead of `Math.random()`
- `ItemTable.jsx`: skeleton render now passes `index={i}` to `<Skeleton.Row key={i} index={i} />`

### Bug 6 — MEDIUM: Logged-in users not redirected from landing (`src/pages/Home.jsx`)
- Added `Navigate` import from `react-router-dom`
- `Home` component now reads `isAdmin` / `loading` from `useAuth()` and `isStaff` / `loading` from `useStaffAuth()`
- Returns `null` while either auth state is loading (prevents flash of login UI)
- Returns `<Navigate to="/admin" replace />` if admin is authenticated
- Returns `<Navigate to="/catalogue" replace />` if staff is authenticated

### Bug 7 — MEDIUM: `* { transition }` breaks skeleton animation (`src/index.css`)
- Replaced `*, *::before, *::after { transition: ... }` with a scoped selector list covering only semantic layout elements (`body`, `header`, `aside`, `main`, `footer`, `nav`, `.card`, `.card-elevated`, `td`, `th`, `tr`, `.input-field`, `.btn-primary`, `.btn-ghost`)
- Added `.animate-pulse, .animate-pulse * { transition: none !important; }` to fully opt animated skeleton elements out of any conflicting transitions

---

## Files Changed

| File | Change |
|---|---|
| `src/pages/Catalogue.jsx` | Bug 1 — flex direction + overflow fix |
| `supabase/functions/staff-signup/index.ts` | Bug 2 — bcryptjs import + hashSync |
| `supabase/functions/staff-login/index.ts` | Bug 2 — bcryptjs import + compareSync |
| `sync/sync_core.py` | Bug 3 — schema migration before push SELECT |
| `src/pages/Home.jsx` | Bug 4 + Bug 6 — null guards + auth redirects |
| `src/components/ui/Skeleton.jsx` | Bug 5 — fixed width array, index prop |
| `src/components/catalogue/ItemTable.jsx` | Bug 5 — pass index to Skeleton.Row |
| `src/index.css` | Bug 7 — scoped transitions, animate-pulse opt-out |
| `README/BUGS_TO_FIX.md` | Added for reference |
| `README/phase8_done.md` | This file |

## Files NOT Changed
Everything else — all other pages, components, hooks, migrations, vercel.json, manifest.json, sw.js, sync_tool.pyw — untouched as per instructions.

---

## Next Session Notes
- All bugs from BUGS_TO_FIX.md are resolved. The app should be fully functional on mobile.
- Staff signup and login via Edge Functions should work reliably (no more WASM cold-start crashes).
- Sync push will no longer fail on older local DBs missing the `position` column.
- If new bugs arise, create a new BUGS_TO_FIX document and a new phase README.
