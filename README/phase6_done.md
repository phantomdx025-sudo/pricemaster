# Phase 6 — Done ✅
## Sync Tool (CTk Desktop GUI, Bidirectional)

---

## What Was Built

### `sync/sync_tool.pyw` — GUI desktop app

Built with `customtkinter`. Runs as `.pyw` — no terminal window on Windows when double-clicked.

**Window:** Title "PriceMaster Sync", resizable, minimum size 520×460, `set_appearance_mode("system")` so it follows the OS dark/light preference.

**First-run setup:** If `config.json` doesn't exist or Supabase credentials are missing, `SetupScreen` modal opens automatically after a 200ms delay (gives the main window time to render). Fields: Supabase URL + service role key (password-masked with show/hide toggle). Validates that URL starts with `https://` and key is non-trivial before saving. Settings can be re-opened at any time via the ⚙ gear button top-right.

**Main layout (grid-based):**
- Header row: "PriceMaster Sync" title + tagline + ⚙ gear button
- Banner row: hidden by default, shows green (success) or red (error) banner after sync completes
- DB selector row: read-only entry showing current path + Browse… button (filters `.db` files, saves to `config.json`)
- Action buttons row: two side-by-side cards — Push (blue) and Pull (green)
  - Pull card has an ⚠️ warning label underneath
- Log area: `CTkTextbox` (monospace Courier New 12pt), scrollable, state-toggled disabled/normal during writes. Clear button in header.

**Push flow:**
1. Validates config (URL, key, db path + file exists) — shows `messagebox.showerror` if incomplete
2. `messagebox.askyesno` confirm dialog
3. Calls `sync_core.push()` in a `daemon=True` background thread — GUI never freezes
4. All `log_callback` calls route through `self.after(0, ...)` for thread-safe UI updates
5. Buttons disabled during sync, re-enabled when done
6. Banner shown with success/failure summary

**Pull flow:**
1. Same validation + confirm dialog
2. `shutil.copy2` backup to `{stem}_backup_{YYYYMMDD_HHMMSS}.db` in same folder as DB — logged immediately
3. Calls `sync_core.pull()` in background thread
4. Same banner behaviour

**Window close guard:** `WM_DELETE_WINDOW` intercepted — if sync is running, shows "are you sure?" dialog before destroying.

---

### `sync/sync_core.py` — Pure sync logic

No GUI imports. Fully unit-testable standalone.

#### `push(db_path, supabase_url, service_role_key, log_callback) → (bool, str)`

1. Reads `inv_categories`, `inv_tabs`, `inv_items` from SQLite via `sqlite3.Row` dicts
2. Strips `item_name.rstrip()` on every item (removes trailing `\n` and whitespace)
3. Creates `supabase.create_client(url, service_role_key)` — bypasses RLS
4. Deletes Supabase tables in FK-safe order: `inv_items` → `inv_tabs` → `inv_categories` (using `.neq("id", 0)` to satisfy Supabase's "must have a filter" requirement)
5. Re-inserts categories, tabs as full list inserts
6. Inserts items in chunks of 400 to stay under Supabase's request size limits
7. Returns `(True, "✅ Push complete — N categories, N tabs, N items in X.Xs")` or `(False, error_message)`

#### `pull(db_path, supabase_url, service_role_key, log_callback) → (bool, str)`

1. Fetches `inv_categories`, `inv_tabs` from Supabase
2. Paginates `inv_items` in batches of 1000 (in case dataset grows)
3. Opens local SQLite; ensures `inv_*` tables exist (safe for fresh DBs)
4. Deletes local `inv_items` → `inv_tabs` → `inv_categories`
5. Inserts all rows — all values explicitly cast to `str()` or `None` to prevent any numeric coercion
6. `conn.commit()` then `conn.close()`
7. **Never touches** any table outside `inv_*` — `bills` and all other tables are untouched

**Error handling:** Both functions wrap everything in `try/except Exception`, call `log_callback` with the error message, and return `(False, error_string)`. The GUI shows this in the banner.

---

### `sync/requirements.txt`

```
customtkinter>=5.2.0
supabase>=2.0.0
pillow>=10.0.0
```

`pillow` is required as an indirect dependency of `customtkinter` for icon rendering on some platforms.

---

### `sync/README.md`

Plain English setup guide for a non-technical owner. Covers:
- Installing Python (with the "Add to PATH" gotcha called out explicitly)
- `pip install` command to copy-paste
- How to double-click to open the tool
- How to handle the first-run setup screen
- How to browse for the DB file
- How to push and pull, with what each does in plain language
- What the auto-backup is and where it goes
- Troubleshooting section (won't open, DB not found, invalid key, partial error)

---

## Files Created in Phase 6

```
sync/
├── sync_tool.pyw     ← NEW: CTk GUI app
├── sync_core.py      ← NEW: pure push/pull logic
├── requirements.txt  ← NEW: pip dependencies
└── README.md         ← NEW: non-technical setup guide
README/
└── phase6_done.md    ← NEW (this file)
```

All Phase 1–5 files are **unchanged**.

---

## How to Run (developer)

```bash
cd sync
pip install -r requirements.txt
python sync_tool.pyw   # or double-click on Windows
```

On Windows, `.pyw` files run via `pythonw.exe` (no console window). On Mac/Linux, double-click support depends on file manager settings — running `python sync_tool.pyw` from terminal works fine.

---

## What Phase 7 Must Know

1. **Sync tool is complete and self-contained** — no changes needed to the React app for Phase 7.

2. **`config.json` must be gitignored.** Add `sync/config.json` to `.gitignore` — it contains the service_role key. The `.env.example` pattern already exists for the web app; same concept applies here.

3. **The `.neq("id", 0)` delete pattern** — Supabase's Python client requires at least one filter on delete operations. `neq("id", 0)` matches all rows (since IDs are always positive) and satisfies this requirement.

4. **Pull pagination** — items are fetched in pages of 1000. At 301 items this is one request, but the code handles growth gracefully.

5. **Phase 7 QA checklist** should include: running the sync tool on Windows, verifying the backup file is created before pull, verifying non-`inv_*` tables in the local DB are untouched after pull, and verifying the push correctly replaces cloud data.
