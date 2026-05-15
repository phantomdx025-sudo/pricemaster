# Phase 2 — Done ✅
## Authentication (Admin + Staff)

---

## What Was Built

### `pages/Home.jsx` — Full landing page
Five panels rendered in a single page component (no route changes):

| Panel | Shown when |
|---|---|
| `landing` | App opens — two entry cards: Staff Login + Admin Login |
| `admin-login` | Admin card clicked |
| `staff-login` | Staff card clicked |
| `staff-signup` | "Sign Up" link on Staff Login |
| `pending` | After successful staff signup submission |

Design details:
- Warm amber/cream palette from Phase 1 design system, fully dark-mode aware
- Subtle dual radial-gradient background glow (amber tones)
- Playfair Display headings, DM Sans body — no Inter/Roboto
- Password fields have show/hide toggle
- Smooth `animate-slide-up` / `animate-fade-in` transitions between panels
- Mobile-first, single-column, `max-w-sm` centered layout

### Admin Login flow
1. Email + password form → `supabase.auth.signInWithPassword`
2. On success → `navigate('/admin')`
3. Errors surface as toasts via `react-hot-toast`

### Staff Login flow
1. Phone + password form → `supabase.functions.invoke('staff-login')`
2. Edge function verifies bcrypt hash + `approved=true` check
3. On success → `useStaffAuth.login(session)` saves session to localStorage → `navigate('/catalogue')`
4. Pending/unapproved error surfaced as toast (403 response)

### Staff Signup flow
1. Name + phone + designation + password + confirm → `supabase.functions.invoke('staff-signup')`
2. Client-side check: passwords match + min 6 chars
3. Edge function bcrypt-hashes password, inserts `approved=false`
4. On success → `pending` panel shown with user's name

### `hooks/useAuth.js` — Admin session
- Reads Supabase Auth session on mount via `getSession()` + `onAuthStateChange`
- Exports: `session`, `loading`, `isAdmin`, `login()`, `logout()`
- `reconfirmIdentity(password)` — re-runs `signInWithPassword` with the admin's email. Returns `{ success, error }`. Sets `reconfirmedAt` timestamp.
- `isReconfirmed` — `true` if `reconfirmedAt` is within the last 5 minutes. Phase 4 uses this to gate destructive actions.

### `hooks/useStaffAuth.js` — Staff session
- Reads `pm_staff_session` from localStorage on mount
- Validates against `expiresAt` in the session payload (falls back to 7-day TTL from `loginAt` for old sessions)
- Exports: `staffUser`, `loading`, `isStaff`, `login(payload)`, `logout()`

### `supabase/functions/staff-login/index.ts` — Updated
- Now includes `expiresAt` (7 days from now) in the session payload alongside `loginAt`
- `useStaffAuth` uses `expiresAt` for expiry checks

### Route guards (`App.jsx`) — Updated
- `RequireStaff` and `RequireAdmin` now show a centered brand `Spinner` while `loading=true` instead of returning `null` — eliminates blank flash on refresh

---

## Files Changed in Phase 2

```
src/
├── App.jsx                          ← updated: spinner in guards instead of null
├── pages/
│   └── Home.jsx                     ← REPLACED: full auth UI (5 panels)
├── hooks/
│   ├── useAuth.js                   ← REPLACED: real admin auth + reconfirmIdentity
│   └── useStaffAuth.js              ← REPLACED: real expiry check + login/logout
supabase/functions/
└── staff-login/index.ts             ← updated: adds expiresAt to session payload
README/
└── phase2_done.md                   ← NEW (this file)
```

All other Phase 1 files are **unchanged**.

---

## Environment Variables Required

```env
# .env (same as Phase 1)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Supabase Edge Function Secrets (set in Supabase Dashboard → Edge Functions → Secrets)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## Supabase Setup Checklist (before testing Phase 2)

1. **Migration applied**: `supabase/migrations/001_init.sql` run in Supabase SQL Editor
2. **Admin user created**: Supabase Dashboard → Authentication → Users → "Add user" (email + password)
3. **Edge functions deployed**:
   ```bash
   supabase functions deploy staff-login
   supabase functions deploy staff-signup
   ```
4. **`SUPABASE_SERVICE_ROLE_KEY` secret set** in Supabase Dashboard → Edge Functions → Secrets

---

## What Phase 3 Must Know

1. **Staff session shape** stored in localStorage:
   ```json
   {
     "id": "uuid",
     "name": "Staff Name",
     "phone": "9876543210",
     "designation": "Sales Staff",
     "loginAt": "2024-01-01T00:00:00.000Z",
     "expiresAt": "2024-01-08T00:00:00.000Z"
   }
   ```
2. `useStaffAuth()` is the source of truth for staff session — import it in Catalogue.jsx for the logged-in user's name/designation if needed.
3. `useAuth()` is the source of truth for admin session — `session.user.email` is the admin email.
4. `reconfirmIdentity(password)` and `isReconfirmed` in `useAuth` are ready for Phase 4 to use — no changes needed there.
5. The `Navbar.jsx` stub needs to be fleshed out in Phase 3 (shows in catalogue). It should show the staff user's name + logout button.
6. `Catalogue.jsx` is still a stub — Phase 3 builds it.
