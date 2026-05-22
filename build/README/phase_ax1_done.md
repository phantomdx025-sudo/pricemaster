# Phase AX-1 — Rebrand to ANKxIOUS + Entity Name Setting ✅

## What Was Built

Full rebrand of all visible "PriceMaster" strings to "ANKxIOUS", PWA manifest updated, new space-themed SVG icon added, entity name made configurable via admin panel + Supabase.

---

## Files Created

| Path | Description |
|---|---|
| `supabase/migrations/005_app_settings.sql` | New `app_settings` table — key/value, RLS enabled, seeded with `entity_name = 'ANKxIOUS'` |
| `src/hooks/useAppSettings.js` | `fetchEntityName()` (anon read) and `setEntityName(name)` (admin upsert via supabaseAdmin) |
| `src/pages/AdminSettings.jsx` | Admin settings page — single "Entity Name" card with input + save button |
| `scripts/gen_icons.mjs` | Node.js script to generate PNG icons from the SVG using `sharp`. Run once after install. |
| `public/icons/icon.svg` | Space-themed "A" logomark SVG — deep navy background, electric violet geometric "A", 5 star dots |

---

## Files Modified

### `src/components/layout/Sidebar.jsx`
- Brand chip: `PM` → `AX`
- Brand text: `PriceMaster` → `ANKxIOUS`

### `src/pages/AdminPanel.jsx`
- Mobile header chip: `PM` → `AX`
- Mobile header label: `Admin` → `ANKxIOUS`
- Added `Settings` to lucide imports
- Added `{ id: 'settings', label: 'Settings', icon: <Settings size={16} /> }` to `NAV_ITEMS`
- Added `import AdminSettingsContent from './AdminSettings'`
- Added `{activeSection === 'settings' && <AdminSettingsContent />}` in content area

### `src/components/layout/Navbar.jsx`
- Brand text: `PriceMaster` → `ANKxIOUS`

### `src/pages/Home.jsx`
- Landing page `<h1>`: `PriceMaster` → `ANKxIOUS`
- Install banner "Install PriceMaster" → "Install ANKxIOUS"
- Footer text: `PriceMaster · ...` → `ANKxIOUS · ...`
- Background radial glow colours: amber `rgba(212,132,42,…)` → violet `rgba(124,111,247,…)`
- Logo box shadow: amber `rgba(212,132,42,0.4)` → violet `rgba(124,111,247,0.4)`

### `public/manifest.json`
- `name`, `short_name` → `"ANKxIOUS"`
- `description` → `"Business admin panel by ANKxIOUS"`
- `orientation` → `"any"` (was `"portrait-primary"` — needed for AX-5)
- `background_color` → `"#080b14"` (deep space, matches new palette)
- `theme_color` → `"#7c6ff7"` (violet)
- Added SVG icon entry `{ src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }`

### `index.html`
- `<title>` → `ANKxIOUS`
- `<meta name="apple-mobile-web-app-title">` → `ANKxIOUS`
- `<meta name="description">` → `"Business admin panel by ANKxIOUS"`
- `theme-color` meta tags → `#7c6ff7` for both light/dark (dark-first app)
- `apple-mobile-web-app-status-bar-style` → `black-translucent` (suits dark app)
- Added `<link rel="icon" type="image/svg+xml" href="/icons/icon.svg">`

### `src/components/financial/FinPdfExport.jsx`
- Removed `const BUSINESS_NAME = import.meta.env.VITE_BUSINESS_NAME ?? 'PriceMaster'`
- Function signature: `generatePartyPDF(partyData, ledgerRows, outstandingRows, addressData, entityName)`
- All `BUSINESS_NAME` usages → `(entityName ?? 'ANKxIOUS')`

### `src/components/financial/FinSlideOver.jsx`
- Added `import { fetchEntityName } from '../../hooks/useAppSettings'`
- Added `const [entityName, setEntityNameState] = useState('ANKxIOUS')` state
- Added `useEffect(() => { fetchEntityName().then(setEntityNameState) }, [])` on mount
- Updated `generatePartyPDF(...)` call to pass `entityName` as 5th argument

---

## Files NOT Changed

- `src/pages/Catalogue.jsx` — no PriceMaster text found
- `src/App.jsx` — no PriceMaster text found
- All `src/components/financial/` files except FinPdfExport and FinSlideOver
- All hooks except useAppSettings (new)
- All `sync/` Python files
- All Supabase edge functions
- `src/index.css` — palette unchanged from AX-0

---

## Non-Obvious Decisions

1. **SVG icon + gen_icons.mjs approach.** `canvas` npm package is less reliable in some Node environments; `sharp` is more universally available and is likely already in the project as a Vite dep. The SVG is committed directly and works as a favicon/PWA icon natively in modern browsers. Run the script to regenerate PNGs if the SVG design is tweaked.

2. **`orientation: "any"` in manifest.** Set now (AX-1) not AX-5 — per masterplan note. No visual change yet; required for landscape mode to work later.

3. **Home.jsx amber glows replaced.** Three inline `rgba(212,132,42,…)` values in background radial gradients and logo shadow were hardcoded amber — replaced with violet equivalents. This was outside the strict AX-1 rebrand spec but was the right call to avoid amber bleed-through on the landing page after the AX-0 palette change.

4. **`setEntityNameState` naming.** State setter named `setEntityNameState` (not `setEntityName`) to avoid shadowing the imported `setEntityName` function from the hook.

---

## Supabase Setup Required ⚠️

Run in Supabase SQL editor:
```
supabase/migrations/005_app_settings.sql
```

This creates the `app_settings` table, enables RLS, sets policies, and seeds `entity_name = 'ANKxIOUS'`.

---

## Icon Generation (One-Time)

```bash
npm install sharp --save-dev
node scripts/gen_icons.mjs
```

Commit the updated PNGs in `public/icons/`. Until the script is run, the existing old PNGs remain — the app still functions fine (icon just won't show the new design).

---

## What the Next Phase (AX-2) Must Know

- `AdminPanel.jsx` now has 4 nav items: Catalogue, Staff, Financial, Settings.
- AX-2 adds a 5th: Reports. Add it to `NAV_ITEMS` in the same pattern.
- `src/pages/AdminSettings.jsx` exists and is wired up.
- The `app_settings` table is live after running the migration.
- No routing changes — AdminPanel handles all sub-views internally via `activeSection` state.
