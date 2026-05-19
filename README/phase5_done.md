# Phase 5 — Done ✅
## Admin Panel: Staff Management

---

## What Was Built

### `pages/AdminStaff.jsx` — Full staff management page
Replaces the Phase 4 placeholder. Renders as a flex content pane inside `AdminPanel` — no full-page layout of its own.

**Features:**
- Initial staff list loaded via `staff-write` edge function (`action: 'list'`) using service_role — bypasses RLS on `staff_users`
- Realtime subscription via `supabase.channel('staff-realtime')` on `staff_users` — INSERT/UPDATE/DELETE all handled in local state without re-fetching
- Toast notification when a new signup arrives (INSERT event): `"New signup: {name} ({designation})"`
- Summary chips at top: pending count + active count
- Refresh button for manual reload (silent — no spinner flash)
- Delete confirm modal before permanent deletion

**Mutation handlers:**
| Action | Edge fn action | Local state update |
|---|---|---|
| Approve | `approve` | Updates matching row `approved=true` |
| Revoke | `revoke` | Updates matching row `approved=false` |
| Delete | `delete` | Removes row from list |

Each mutation tracks its own `loadingIds` Set — buttons show spinner and are disabled while in-flight. Other cards stay interactive.

---

### `components/admin/StaffApprovalList.jsx` — Staff list component
Replaces the Phase 4/5 stub.

**Two sections:**
1. **Pending Approval** — orange-bordered cards with Approve + Delete buttons. Badge count shown.
2. **Active Staff** — green-bordered cards with Revoke + Delete buttons. Badge count shown.

**Empty states:**
- No pending: "🎉 No pending requests — you're all caught up."
- No active: "👤 No approved staff yet."

**StaffCard layout:**
- Avatar circle (initial letter, amber for pending / green for approved)
- Name, phone (📞), designation (💼), signup timestamp (formatted en-IN)
- Approve/Revoke button + trash button; spinner during loading

---

### `hooks/useStaffWrite.js` — New hook
Mirror of `useCatalogueWrite`. Calls `staff-write` edge function with Bearer auth.
Returns `{ call, loading, error }`.

---

### `supabase/functions/staff-write/index.ts` — New edge function
Follows exact same pattern as `catalogue-write`.

**Actions:**
| Action | Payload | Effect |
|---|---|---|
| `list` | — | Returns all staff rows ordered by `created_at DESC`, minus `password_hash` |
| `approve` | `{ id }` | Sets `approved=true`, returns updated row |
| `revoke` | `{ id }` | Sets `approved=false`, returns updated row |
| `delete` | `{ id }` | Hard-deletes the row |

Protected by JWT — verifies admin session before any action. Uses service_role for all reads/writes (bypasses RLS on `staff_users`).

---

## Files Changed / Created in Phase 5

```
src/
├── pages/
│   └── AdminStaff.jsx            ← REPLACED: full staff management page
├── hooks/
│   └── useStaffWrite.js          ← NEW: edge function caller for staff actions
├── components/
│   └── admin/
│       └── StaffApprovalList.jsx ← REPLACED: full pending + approved lists
supabase/
└── functions/
    └── staff-write/
        └── index.ts              ← NEW: staff write edge function
README/
└── phase5_done.md                ← NEW (this file)
```

All Phase 1–4 files are **unchanged**.

---

## Edge Function Deployment

```bash
supabase functions deploy staff-write
```

Required secrets (already set from Phase 2):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## Supabase Realtime Setup

The `staff_users` table must have Realtime enabled in the Supabase dashboard:

1. Go to **Database → Replication**
2. Find `staff_users` in the tables list
3. Toggle on **INSERT**, **UPDATE**, **DELETE**

Without this, the channel subscription won't receive events (but the app degrades gracefully — it just won't auto-update without the manual refresh button).

---

## What Phase 6 Must Know

1. **`AdminStaff` is complete.** Phase 6 (Sync Tool) is entirely a Python desktop app — no React changes needed for it.

2. **`useStaffWrite` pattern established.** Any future staff mutations follow the same `{ call, loading, error }` hook → edge function → service_role pattern.

3. **Realtime channel name is `'staff-realtime'`.** If Phase 7 QA adds any realtime tests, use this channel name.

4. **Realtime payload structure:** The `payload.new` object from the postgres_changes event contains the raw DB row fields — including `password_hash`. The `list` action in the edge function returns rows without `password_hash` (only selects safe fields). The realtime INSERT event will include `password_hash` in `payload.new` since it comes directly from Postgres. This is fine — it never leaves the admin's browser session.
