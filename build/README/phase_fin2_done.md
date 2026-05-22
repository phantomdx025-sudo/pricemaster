# Phase FIN-2 Done — Search + Slide-Over + Party Statement

## What Was Built

Phase FIN-2 adds global search, a slide-over panel, and all three party-detail tabs (Ledger, Outstanding, Contact). Tapping any party from the list or search results now opens a full party statement.

---

## Files Created

### `src/components/financial/FinSearch.jsx`
- Full-screen overlay (same pattern as catalogue `SearchBox.jsx`)
- Fuse.js index built from `debtors + creditors` merged with `addressMap` data, so GSTIN, mobile, and state fields are searchable even though they live in `fin_address`
- Search fields: `party_name`, `gstin`, `mobile`, `state_name`; threshold 0.35, minMatchCharLength 2
- Results dropdown: party name + status badge + state + closing balance (colour-coded)
- Recent searches: last 5 opened parties stored in `sessionStorage` (clears on tab close)
- Keyboard: `Escape` closes, `ArrowUp`/`ArrowDown` navigate results, `Enter` selects focused item
- Mobile: full-screen overlay with `animate-slide-up`; desktop: same (centered modal)
- Opened via "Search" button in page header (hidden when no data)

### `src/components/financial/FinSlideOver.jsx`
- Desktop: right-panel, `animate-slide-in-right`, 480px wide, `inset-y-0 right-0`
- Mobile: bottom-sheet, `animate-slide-up`, `max-h-[92dvh]`, `rounded-t-2xl`
- Backdrop overlay (click to close)
- Mobile drag handle bar at top
- Header: status badge + party type chip + party name + Pin star button + Close button
- Sub-header: closing balance (large, `font-mono`) + "closing balance" label
- 3 tabs: Ledger | Outstanding | Contact — each lazy-fetches on first open
- Pin button: optimistic (updates immediately); error reverts + shows toast
- Body scroll locked when open (restored on close/unmount)

### `src/components/financial/FinLedgerTab.jsx`
- Fetches `fin_ledger ORDER BY txn_date ASC, id ASC`
- First + last rows highlighted with `var(--brand-light)` tint (opening/closing balance pinning)
- **Desktop**: full table with columns: Date | Type | Vch No | Narration | Debit | Credit | Balance
  - Narration truncated at 40 chars with "… more" expand toggle
  - Debit = red (`var(--error)`), Credit = green (`var(--success)`), Balance = red if negative
- **Mobile**: card layout — date + vch on top row, narration below, amounts row at bottom
  - Narration truncated at 60 chars with expand
- Footer: transaction count
- Skeleton (8 rows) while loading; inline error state; "No transactions found" empty state

### `src/components/financial/FinOutstandingTab.jsx`
- Fetches `fin_outstanding ORDER BY inv_date ASC`
- Summary bar at top: "Total outstanding ₹X across N invoices" (red tinted background)
- Per-invoice card: date, vch type/no, original/paid/remaining amounts in a 3-col grid
- **Aging badge** computed client-side from `inv_date` to today:
  - 0–30d: green, 31–60d: brand/amber, 61–90d: warning/orange, 90+d: red
- **Settled state** (rows empty + balance ≥ 0): green checkmark illustration "All invoices cleared ✓"
- **Credit balance state** (closing_bal < 0): warning illustration "Excess receipt of ₹X — pending adjustment or refund"
- Skeleton while loading; inline error state

### `src/components/financial/FinContactTab.jsx`
- Fetches `fin_address` via case-insensitive `ilike` match
- Displays: Group, Address (address + state + pincode combined), Contact Person, Phone (tap-to-call), Mobile (tap-to-call + WhatsApp button), Email (tap-to-mailto), GSTIN, PAN, Reg Type
- WhatsApp button: green pill `https://wa.me/91{mobile}` — only shown if mobile present
- "No contact info synced for this party" card if no address book match
- **Notes section** below contact:
  - Lists `fin_party_notes` newest first (fetched lazily alongside contact)
  - Textarea + "Add Note" button; Ctrl+Enter / Cmd+Enter keyboard shortcut to submit
  - Delete: first tap shows red confirm state on trash icon; second tap deletes
  - Loading skeleton for notes list while fetching
  - "No notes yet" empty state
- Uses regular `supabase` client (admin session has `authenticated` role → RLS write policies pass)

---

## Files Modified

### `src/hooks/useFinancial.js`
Added 7 new exported functions (lazy, not called on mount):
- `fetchLedger(partyType, partyName)` — queries `fin_ledger`
- `fetchOutstanding(partyType, partyName)` — queries `fin_outstanding`
- `fetchContact(partyName)` — queries `fin_address` with `ilike`
- `fetchNotes(partyType, partyName)` — queries `fin_party_notes` descending
- `addNote(partyType, partyName, text)` — inserts to `fin_party_notes`, returns new row
- `deleteNote(noteId)` — deletes from `fin_party_notes`
- `togglePin(partyType, partyName)` — optimistic insert/delete on `fin_pinned`, reverts on error

All existing FIN-1 logic (fetchParties, fetchAddress, fetchSyncLog, fetchPinned, loadAll, clearCache, setPinned) is unchanged.

### `src/pages/AdminFinancial.jsx`
Minimal additions only:
- Imported `FinSearch`, `FinSlideOver`, `Search` icon
- Added `searchOpen`, `selectedParty`, `slideOverOpen` state
- `handlePartyClick` — sets selectedParty + opens slide-over + closes search
- `handleSlideOverClose` — closes slide-over, clears party after 350ms for exit animation
- Added Search button in page header (visible only when `hasData`)
- `onPartyClick` prop on both FinPartyList instances now calls `handlePartyClick`
- `<FinSearch>` and `<FinSlideOver>` rendered at bottom (outside scroll container)
- `slideOverHooks` object passed to slide-over

---

## Files NOT Changed
- `src/components/financial/FinDashboardCards.jsx` — untouched
- `src/components/financial/FinPartyList.jsx` — untouched
- `src/components/financial/FinPartyCard.jsx` — untouched
- `src/pages/AdminPanel.jsx` — untouched
- All other hooks, pages, components — untouched
- `supabase/migrations/002_fin_init.sql` — untouched (tables already created in FIN-1)
- `package.json` — no new dependencies (Fuse.js already present)

---

## Non-obvious Decisions

1. **`supabase` (anon client) used for note/pin writes** — The `supabaseAdmin.js` in `src/lib/` is a Deno-only file for Edge Functions. In the browser, the regular `supabase` client carries the admin's authenticated session JWT, which satisfies the `authenticated` RLS policies for `fin_party_notes` and `fin_pinned`. No new client file needed.

2. **`fetched` guard in tab components** — Each tab component tracks `fetched` as `"partyType:partyName"`. This prevents duplicate fetches if the component re-renders (e.g. parent state update) and avoids refetching when switching tabs back to one already loaded. The guard resets when `party.party_name` changes (new party opened).

3. **Slide-over rendered conditionally `{slideOverOpen && selectedParty}`** — Prevents the tabs from mounting and fetching until the slide-over is actually open. On close, `slideOverOpen` goes false first (hiding it instantly), then `selectedParty` is cleared after 350ms to allow the CSS animation to complete before unmount.

4. **Body scroll lock** — `document.body.style.overflow = 'hidden'` set when slide-over opens, restored on close and on unmount. This prevents the background list from scrolling through the overlay on mobile.

5. **WhatsApp number normalization** — `contact.mobile.replace(/\D/g, '')` strips any non-digit characters before building the `wa.me/91{mobile}` URL, since Tally exports may include spaces or dashes.

6. **Delete note two-tap confirmation** — Rather than a modal (heavier), the trash icon turns red on first tap and `confirmDeleteId` tracks which note is pending confirmation. Clicking anywhere else (or a different note) resets it implicitly on next render.

7. **Aging badge uses amber/brand for 31–60 days** — The masterplan says "yellow" for this range; the project uses `var(--brand)` (amber) as its warning-adjacent colour since there is no separate yellow token. `var(--warning)` maps to the same amber value; using `var(--brand)` for 31–60 and `var(--warning)` for 61–90 creates a distinct visual step.

---

## Supabase Setup Steps Required

None — all tables were created in FIN-1 (`002_fin_init.sql`). The new write operations (notes, pins) use existing RLS policies.

---

## What FIN-3 Must Know

1. **`FinSlideOver.jsx` header** — Phase FIN-3 adds a share icon button to the slide-over header (top-right, next to pin+close buttons). Wire it into the existing header `div.flex.items-center.gap-1.flex-shrink-0` alongside the Star and X buttons.

2. **`FinPartyList.jsx` toolbar** — Phase FIN-3 adds a bulk PDF export button visible when filter = "Outstanding only".

3. **Party data shape available in slide-over**: `{ party_name, party_type, closing_bal, status, opening_bal, synced_at }` — from `fin_parties`.

4. **Ledger + outstanding rows** — already fetched lazily in the tabs. FIN-3's `generatePartyPDF` will need to call `fetchLedger` and `fetchOutstanding` directly (or receive them as props from the slide-over).

5. **`jsPDF` + `jsPDF-autotable`** must be added to `package.json` as new dependencies. `JSZip` also needed for bulk export.

6. **PDF business name**: read from `import.meta.env.VITE_BUSINESS_NAME ?? 'PriceMaster'`.
