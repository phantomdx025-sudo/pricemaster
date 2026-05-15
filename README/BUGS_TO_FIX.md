# PriceMaster — Bug Report for Next Session
> Read this fully before touching any code. Fix every bug listed. Do not fix anything not listed here. Deliver one complete ZIP with all phases included.

---

## Project Structure Reminder

```
pricemaster_phase5_build/
  index.html
  vercel.json
  vite.config.js
  public/
    manifest.json
    sw.js
    icons/
  src/
    main.jsx
    App.jsx
    index.css
    pages/
      Home.jsx               ← staff signup + login forms
      Catalogue.jsx          ← staff catalogue view
      AdminPanel.jsx
      AdminCatalogue.jsx
      AdminStaff.jsx
    components/
      catalogue/
        ItemTable.jsx        ← mobile items bug is HERE
        CategoryTabs.jsx
        TabBar.jsx
        SearchBox.jsx
      layout/
        Navbar.jsx
        Sidebar.jsx
      ui/
        Skeleton.jsx
        Spinner.jsx
        Toast.jsx
        PWAInstallPrompt.jsx
        ErrorBoundary.jsx
        Button.jsx
    hooks/
      useInventory.js
      useStaffAuth.js
      useAuth.js
    lib/
      supabase.js
    utils/
      auth.js
      search.js
  supabase/
    functions/
      staff-signup/index.ts  ← signup edge function
      staff-login/index.ts
      staff-write/index.ts
      catalogue-write/index.ts
    migrations/
      001_init.sql
  sync/
    sync_core.py             ← push/pull logic
    sync_tool.pyw            ← CTk GUI
  README/
    phase7_done.md
```

---

## Bug 1 — CRITICAL: Mobile items are completely invisible

**File:** `src/pages/Catalogue.jsx`

**Symptom:** On any phone (< 768px), after logging in as staff, the item list area is completely blank. Categories and tabs display fine. Desktop works perfectly.

**Root cause — two separate issues working together:**

**Issue A — Wrong flex direction on outer body wrapper.**
The body layout in Catalogue.jsx is:
```jsx
<div className="flex flex-1 min-h-0">        ← always horizontal flex
  <CategoryTabs ... />                         ← desktop: sidebar | mobile: strip
  <div className="flex-1 flex flex-col ...">
```

On desktop `CategoryTabs` renders `<aside className="hidden md:flex ...">` (sidebar) — correctly inside the horizontal flex row. But on mobile, `CategoryTabs` renders `<div className="md:hidden flex gap-2 px-4 ...">` (horizontal strip). This strip is STILL inside the horizontal flex row parent, so on mobile it sits side-by-side with the content column instead of stacking above it. The content column gets squeezed and the items div collapses to zero height.

**Issue B — `overflow-hidden` kills flex height resolution on mobile.**
The content column div has `overflow-hidden`:
```jsx
<div className="flex-1 flex flex-col min-w-0 overflow-hidden">
```
On mobile this clips the entire content area before flex can distribute height, causing the `flex-1 overflow-y-auto` items container to resolve to 0 height.

**Fix — change the outer body wrapper to stack vertically on mobile:**

In `Catalogue.jsx`, change this:
```jsx
{/* ── Body: sidebar + content ───────────────────────── */}
<div className="flex flex-1 min-h-0">
  <CategoryTabs ... />
  <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
```

To this:
```jsx
{/* ── Body: sidebar + content ───────────────────────── */}
<div className="flex flex-col flex-1 min-h-0 md:flex-row">
  <CategoryTabs ... />
  <div className="flex-1 flex flex-col min-w-0 min-h-0">
```

Key changes:
- `flex flex-col` on mobile, `md:flex-row` on desktop — makes CategoryTabs stack above content on mobile
- Remove `overflow-hidden` from the content column — replace with `min-h-0` (allows flex to shrink properly without clipping)

Also update the items scroll container from:
```jsx
<div className="flex-1 overflow-y-auto">
```
To:
```jsx
<div className="flex-1 overflow-y-auto min-h-0">
```

`min-h-0` is required on flex children that need to scroll — without it, the browser uses the content's intrinsic height and the div expands past the viewport, breaking scroll.

---

## Bug 2 — CRITICAL: Staff signup crashes with "unable to fetch staff data" / FetchError

**Files:** `supabase/functions/staff-signup/index.ts` and `src/pages/Home.jsx`

**Symptom:** When a new staff member fills out the signup form and taps "Request Access", they see a toast error like "Failed to fetch" or "Unable to fetch staff data" or a generic network error. The signup never completes.

**Root cause — the `bcrypt` import from deno.land is broken/slow.**

The edge function uses:
```ts
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'
```

`deno.land/x/bcrypt@v0.4.1` uses WASM internally. In Supabase Edge Functions (Deno Deploy environment), this WASM module either fails to load or times out on cold start, causing the function to throw before it even hashes the password. The error surfaces as a network/fetch error on the client because the function crashes at import time or during the hash call.

**Fix — replace the bcrypt import with the esm.sh version which works reliably in Supabase Edge Functions:**

In `supabase/functions/staff-signup/index.ts`, replace:
```ts
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'
```
With:
```ts
import bcrypt from 'https://esm.sh/bcryptjs@2.4.3'
```

Also update the hash and compare calls (bcryptjs API is slightly different):

Replace:
```ts
const password_hash = await bcrypt.hash(password, 10)
```
With:
```ts
const password_hash = bcrypt.hashSync(password, 10)
```

Do the same fix in `supabase/functions/staff-login/index.ts`:

Replace:
```ts
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'
```
With:
```ts
import bcrypt from 'https://esm.sh/bcryptjs@2.4.3'
```

Replace:
```ts
const valid = await bcrypt.compare(password, user.password_hash)
```
With:
```ts
const valid = bcrypt.compareSync(password, user.password_hash)
```

**Note:** `bcryptjs` is pure JS (no WASM), so it works reliably in all Deno/edge environments. The sync versions are fine here because Edge Functions are not long-running servers — the extra few ms for a synchronous hash doesn't matter.

---

## Bug 3 — CRITICAL: Push fails with "no such column: position"

**File:** `sync/sync_core.py`

**Symptom:**
```
📤 Starting push  [14:19:48]
🔌 Connecting to local database…
❌ Push failed: no such column: position
```

**Root cause:** The local SQLite database (`bills_data.db`) has `inv_categories` and `inv_tabs` tables that were created **before** the `position` column was added to the schema. The push reads:
```python
cur.execute("SELECT id, name, icon, position FROM inv_categories ORDER BY position, id")
```

If the existing local tables were created without the `position` column (they may have been auto-created by an older version of the billing app, or the column was added later), this SELECT crashes immediately.

**Fix — add a migration step at the start of `push()` that adds missing columns before reading:**

In `sync_core.py`, inside the `push()` function, right after `conn.row_factory = sqlite3.Row` and before the first `SELECT`, add:

```python
# ── Migrate local schema: add missing columns if they don't exist ──
# Safe to run every time — ALTER TABLE IF NOT EXISTS is idempotent in SQLite 3.37+
# For older SQLite, we check via PRAGMA first.
def _ensure_column(cursor, table, column, col_def):
    cursor.execute(f"PRAGMA table_info({table})")
    cols = [row[1] for row in cursor.fetchall()]
    if column not in cols:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_def}")

_ensure_column(cur, "inv_categories", "position", "INTEGER DEFAULT 0")
_ensure_column(cur, "inv_categories", "icon",     "TEXT")
_ensure_column(cur, "inv_tabs",       "position", "INTEGER DEFAULT 0")
conn.commit()
_log(log_callback, "✓ Local schema verified/migrated")
```

Place this block right after the connection is established and before the first SELECT. This safely adds the `position` (and `icon`) columns if they're missing, defaulting existing rows to `0` / `NULL`. It's a no-op if the columns already exist.

---

## Bug 4 — Signup error handling crashes on null response

**File:** `src/pages/Home.jsx` — `StaffSignupPanel.handleSubmit`

**Symptom:** If the Edge Function returns a 500 with no JSON body (e.g., WASM crash before response is written), `res.data` is `null`. The destructure:
```js
const { user, error: bodyError } = res.data
```
throws `TypeError: Cannot destructure property 'user' of null`, which is caught by the outer try/catch but shows as a generic unhandled error instead of a useful message.

**Fix:** Add a null guard before destructuring:

Replace:
```js
if (res.error) throw new Error(res.error.message || 'Signup failed')

const { user, error: bodyError } = res.data
if (bodyError) throw new Error(bodyError)

onPending(form.name.trim())
```

With:
```js
if (res.error) throw new Error(res.error.message || 'Signup failed')
if (!res.data) throw new Error('No response from server. Please try again.')

const { user, error: bodyError } = res.data
if (bodyError) throw new Error(bodyError)

onPending(form.name.trim())
```

Apply the same fix to `StaffLoginPanel.handleSubmit` — same pattern:

Replace:
```js
if (res.error) throw new Error(res.error.message || 'Login failed')

const { session, error: bodyError } = res.data
```

With:
```js
if (res.error) throw new Error(res.error.message || 'Login failed')
if (!res.data) throw new Error('No response from server. Please try again.')

const { session, error: bodyError } = res.data
```

---

## Bug 5 — Skeleton.Row uses Math.random() in render — flickers on every re-render

**File:** `src/components/ui/Skeleton.jsx`

**Symptom:** While items are loading, the skeleton item-name column widths visibly flicker/change on every React re-render (e.g., when any parent state updates). This looks broken and jittery.

**Root cause:**
```jsx
function Row() {
  return (
    <tr>
      ...
      <td><Base className="h-3 rounded" style={{ width: `${55 + Math.random() * 30}%` }} /></td>
```

`Math.random()` is called on every render producing a new width each time.

**Fix:** Use a fixed array of widths, indexed by row position. The `Row` component should accept an `index` prop:

```jsx
const NAME_WIDTHS = ['62%', '78%', '55%', '83%', '67%', '71%', '59%', '74%', '64%', '70%']

function Row({ index = 0 }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td className="px-4 py-3 w-12">
        <Base className="h-3 w-6 rounded ml-auto" />
      </td>
      <td className="px-4 py-3">
        <Base className="h-3 rounded" style={{ width: NAME_WIDTHS[index % NAME_WIDTHS.length] }} />
      </td>
      {[...Array(5)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Base className="h-3 w-14 rounded ml-auto" />
        </td>
      ))}
    </tr>
  )
}
```

And in `ItemTable.jsx` where skeletons are rendered, pass the index:
```jsx
{[...Array(10)].map((_, i) => <Skeleton.Row key={i} index={i} />)}
```

---

## Bug 6 — Home page shows login screen to already-authenticated users

**File:** `src/pages/Home.jsx`

**Symptom:** A staff member who is already logged in navigates to `/` (e.g., taps the browser back button) and sees the landing screen again instead of being redirected to `/catalogue`. Same for admin navigating to `/` — they see the landing instead of `/admin`.

**Fix:** Add redirect logic at the top of the `Home` component:

```jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useStaffAuth } from '../hooks/useStaffAuth'

export default function Home() {
  const { isAdmin, loading: adminLoading } = useAuth()
  const { isStaff, loading: staffLoading } = useStaffAuth()

  // Wait for both auth states to resolve before deciding
  if (adminLoading || staffLoading) return null

  if (isAdmin) return <Navigate to="/admin" replace />
  if (isStaff) return <Navigate to="/catalogue" replace />

  // ... rest of component (panel state, forms, etc.)
```

---

## Bug 7 — Phase 7 global CSS transition breaks skeleton animation

**File:** `src/index.css`

**Symptom:** The skeleton pulse animation looks sluggish or doesn't animate smoothly because the Phase 7 addition applies `transition: background-color 0.15s ease` to `*`, which fights with the `animate-pulse` keyframe animation on skeleton elements.

**Root cause:** This block in index.css (added Phase 7):
```css
*, *::before, *::after {
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.1s ease;
}
```

Applies to every element including skeleton divs, table cells, and SVGs. The forced CSS transition on `background-color` conflicts with Tailwind's `animate-pulse` which also changes opacity.

**Fix:** Scope the transition to semantic layout elements only, not `*`. Replace the `*, *::before, *::after` block with:

```css
body, header, aside, main, footer, nav,
.card, .card-elevated,
td, th, tr,
.input-field, .btn-primary, .btn-ghost {
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.1s ease;
}
```

And add an explicit opt-out for animated elements:
```css
.animate-pulse, .animate-pulse * {
  transition: none !important;
}
```

---

## Summary Table

| # | Severity | File(s) | Problem |
|---|---|---|---|
| 1 | 🔴 CRITICAL | `src/pages/Catalogue.jsx` | Mobile items invisible — wrong flex direction + overflow-hidden |
| 2 | 🔴 CRITICAL | `supabase/functions/staff-signup/index.ts` + `staff-login/index.ts` | bcrypt WASM crashes Edge Function — replace with bcryptjs |
| 3 | 🔴 CRITICAL | `sync/sync_core.py` | Push fails "no such column: position" — SQLite missing columns |
| 4 | 🟠 HIGH | `src/pages/Home.jsx` | Null response destructure crash in signup + login handlers |
| 5 | 🟠 HIGH | `src/components/ui/Skeleton.jsx` | `Math.random()` in render causes skeleton flicker |
| 6 | 🟡 MEDIUM | `src/pages/Home.jsx` | Already-logged-in users not redirected away from landing |
| 7 | 🟡 MEDIUM | `src/index.css` | `* { transition }` breaks skeleton animation |

---

## What NOT to change

- All other pages and components not mentioned above
- `supabase/migrations/001_init.sql` — the SQL is correct as-is
- `vercel.json` — correct
- `public/manifest.json` and `public/sw.js` — correct
- `src/components/catalogue/ItemTable.jsx` — only the Skeleton.Row call needs `index` prop passed, the rest is fine
- `sync/sync_tool.pyw` — GUI is not broken, only `sync_core.py` needs the schema migration

## Delivery

One ZIP: `pricemaster_phase8_bugfix.zip` containing the full project with all phases. No partial zips.
