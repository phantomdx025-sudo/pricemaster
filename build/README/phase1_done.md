# Phase 1 — Done ✅
## Foundation & Supabase Setup

---

## What Was Built

### Project Scaffold
- Vite + React 18 project, port **9000** (`vite.config.js`)
- All dependencies in `package.json`
- `.gitignore` (node_modules, dist, .env, sync/config.json)

### Design System
- **Fonts**: Playfair Display (display/headings) + DM Sans (body) + JetBrains Mono (mono) — loaded from Google Fonts
- **Theme**: Warm amber/brown textile palette — CSS variables for light **and** dark mode in `src/index.css`
- **Dark mode**: `class`-based Tailwind + system preference auto-applied in `App.jsx`
- **Tailwind**: Custom color tokens (`brand.*`, `surface.*`, `cream.*`), custom shadows, animations, border radii in `tailwind.config.js`
- **Component classes**: `.card`, `.btn-primary`, `.btn-ghost`, `.input-field`, `.label`, `.font-display` defined in `@layer components`

### Supabase
- `src/lib/supabase.js` — anon client (browser-safe)
- `src/lib/supabaseAdmin.js` — service_role client (**Deno only**, never import in React)
- `supabase/migrations/001_init.sql` — all 4 tables + indexes + RLS policies:
  - `inv_categories` — public read, no public write
  - `inv_tabs` — public read, no public write
  - `inv_items` — public read, no public write
  - `staff_users` — **no public access at all** (service_role via Edge Functions only)

### PWA
- `public/manifest.json` — full manifest, all icon sizes declared, theme `#d4842a`
- `public/sw.js` — minimal service worker: install prompt only, **no offline cache**
- `src/components/ui/PWAInstallPrompt.jsx` — custom banner that fires on Android/Chrome (`beforeinstallprompt`) and iOS Safari (manual instructions). 7-day dismiss cooldown stored in localStorage.
- SW registered in `main.jsx`

### Routing Skeleton (`App.jsx`)
| Route | Component | Guard |
|---|---|---|
| `/` | `Home` | None |
| `/catalogue` | `Catalogue` | `RequireStaff` |
| `/admin` | `AdminPanel` | `RequireAdmin` |
| `/admin/catalogue` | `AdminCatalogue` | `RequireAdmin` |
| `/admin/staff` | `AdminStaff` | `RequireAdmin` |
| `*` | Redirect → `/` | — |

Route guards are wired but currently pass-through (no real session yet — Phase 2 fills this in).

### UI Components (production-ready)
- `Button.jsx` — variants: primary, ghost, danger, outline; sizes: sm, md, lg; loading state
- `Modal.jsx` — accessible, scroll-locked, click-outside-to-close
- `Spinner.jsx` — brand-colored
- `Toast.jsx` — re-exports react-hot-toast with theme config; exports `Toaster` for `App.jsx`
- `PWAInstallPrompt.jsx` — see above
- `Navbar.jsx` (stub — Phase 2 fills in)
- `Sidebar.jsx` (stub — Phase 3 fills in)

### Hooks (stubs, Phase 2/3 will flesh out)
- `useAuth.js` — admin Supabase Auth session
- `useStaffAuth.js` — staff custom JWT from localStorage
- `useInventory.js` — categories/tabs/items with in-session cache + `\n` stripping

### Utils
- `src/utils/search.js` — fuse.js search index builder + search function
- `src/utils/auth.js` — bcrypt hash/verify, localStorage staff session helpers

### Edge Functions (Deno, ready to deploy)
- `supabase/functions/staff-login/index.ts` — phone+password → bcrypt verify → approval check → session payload
- `supabase/functions/staff-signup/index.ts` — bcrypt hash → insert staff_users with approved=false

---

## Files Created

```
pricemaster/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .env.example
├── .gitignore
├── public/
│   ├── manifest.json
│   ├── sw.js
│   └── icons/           ← placeholder dir; add actual PNGs before Phase 7
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── lib/
│   │   ├── supabase.js
│   │   └── supabaseAdmin.js
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useStaffAuth.js
│   │   └── useInventory.js
│   ├── pages/
│   │   ├── Home.jsx           (stub)
│   │   ├── Catalogue.jsx      (stub)
│   │   ├── AdminPanel.jsx     (stub)
│   │   ├── AdminCatalogue.jsx (stub)
│   │   └── AdminStaff.jsx     (stub)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.jsx     (stub)
│   │   │   └── Sidebar.jsx    (stub)
│   │   ├── catalogue/
│   │   │   ├── CategoryTabs.jsx (stub)
│   │   │   ├── TabBar.jsx       (stub)
│   │   │   ├── ItemTable.jsx    (stub)
│   │   │   └── SearchBox.jsx    (stub)
│   │   ├── admin/
│   │   │   ├── ItemForm.jsx         (stub)
│   │   │   ├── TabManager.jsx       (stub)
│   │   │   ├── CategoryManager.jsx  (stub)
│   │   │   └── StaffApprovalList.jsx (stub)
│   │   └── ui/
│   │       ├── Button.jsx
│   │       ├── Modal.jsx
│   │       ├── Spinner.jsx
│   │       ├── Toast.jsx
│   │       └── PWAInstallPrompt.jsx
│   └── utils/
│       ├── search.js
│       └── auth.js
├── supabase/
│   ├── migrations/
│   │   └── 001_init.sql
│   └── functions/
│       ├── staff-login/index.ts
│       └── staff-signup/index.ts
└── README/
    └── phase1_done.md
```

---

## Environment Variables

```env
# .env (copy from .env.example)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Supabase Edge Function Secrets (set in Supabase Dashboard)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## What Phase 2 Must Know

1. **Run `npm install`** in the `pricemaster/` folder before starting.
2. **Apply the migration**: Supabase Dashboard → SQL Editor → paste + run `supabase/migrations/001_init.sql`.
3. **Create `.env`** from `.env.example` with real Supabase URL and anon key.
4. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy staff-login
   supabase functions deploy staff-signup
   ```
   Then add `SUPABASE_SERVICE_ROLE_KEY` as a secret in Supabase Dashboard → Edge Functions → Secrets.
5. **Admin user**: Create via Supabase Dashboard → Authentication → Users → "Add user". Phase 2 needs their email + password.
6. **Icons**: `public/icons/` dir exists but PNGs are not generated. Phase 7 handles icon generation. The PWA will work without icons during development.
7. **DB observation**: The real `bills_data.db` has a `sl_no` column in `inv_items` not in the masterplan schema. The Supabase schema matches the masterplan (no `sl_no`). The sync tool (Phase 6) will handle this mapping.
8. **Category 12 (BUTTONS)** has zero tabs — the routing skeleton and future catalogue must handle empty-tab state gracefully.
9. **Fonts** load from Google Fonts CDN — requires internet. This is intentional (app is always-online).
10. **Dark mode** auto-applies from system preference on every load. No manual toggle yet — Phase 7 can add one if desired.

---

## DB Notes (from reference `bills_data.db`)

| Table | Rows | Notes |
|---|---|---|
| `inv_categories` | 12 | No `position` column yet — migration adds it |
| `inv_tabs` | 18 | Category 12 (BUTTONS) has 0 tabs |
| `inv_items` | 301 | Has `sl_no` column (not in Supabase schema — sync tool handles mapping) |
| `bills` | 27 | Must never be touched by sync pull |

Actual categories: CANVAS, BELT AND PATTI ROLL, ELASTIC, THREAD, HOOKS, PRESS BUTTON, NEEDLE, SCISSOR, SCALE, MEASUREMENT TAPE, OIL, BUTTONS
