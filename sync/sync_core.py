"""
sync_core.py — PriceMaster bidirectional sync logic.
No GUI code here. Imported by sync_tool.pyw.

Public API:
    push(db_path, supabase_url, service_role_key, log_callback) -> (bool, str)
    pull(db_path, supabase_url, service_role_key, log_callback) -> (bool, str)

All value fields stay TEXT — never coerced to numeric.
Pull only touches inv_* tables — bills and all other tables are untouched.
"""

import sqlite3
import time
from supabase import create_client


# ── Helpers ──────────────────────────────────────────────────────────────────

def _admin_client(supabase_url: str, service_role_key: str):
    """Create a Supabase client with service_role key (bypasses RLS)."""
    return create_client(supabase_url, service_role_key)


def _log(callback, message: str):
    if callback:
        callback(message)


# ── PUSH: local SQLite → Supabase ────────────────────────────────────────────

def push(db_path: str, supabase_url: str, service_role_key: str, log_callback=None) -> tuple[bool, str]:
    """
    Read inv_categories, inv_tabs, inv_items from local SQLite.
    Full-replace the same tables in Supabase (delete FK-safe order, then re-insert).
    Strips trailing whitespace/newlines from item_name.
    Returns (success, summary_message).
    """
    t_start = time.time()

    try:
        _log(log_callback, "🔌 Connecting to local database…")
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        # ── Migrate local schema: add missing columns if they don't exist ──
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

        # ── Read categories ───────────────────────────────────────────────
        cur.execute("SELECT id, name, icon, position FROM inv_categories ORDER BY position, id")
        categories = [dict(r) for r in cur.fetchall()]
        _log(log_callback, f"📂 Read {len(categories)} categories from local DB")

        # ── Read tabs ─────────────────────────────────────────────────────
        cur.execute("SELECT id, category_id, name, position FROM inv_tabs ORDER BY position, id")
        tabs = [dict(r) for r in cur.fetchall()]
        _log(log_callback, f"📑 Read {len(tabs)} tabs from local DB")

        # ── Read items ────────────────────────────────────────────────────
        cur.execute(
            "SELECT id, tab_id, row_index, item_name, rate, rate_without_gst, "
            "unit_qty, qty, qty_with_gst FROM inv_items ORDER BY tab_id, row_index"
        )
        items_raw = cur.fetchall()
        items = []
        for r in items_raw:
            row = dict(r)
            # Strip trailing whitespace / newlines from item_name
            if row["item_name"] is not None:
                row["item_name"] = row["item_name"].rstrip()
            items.append(row)
        _log(log_callback, f"🧵 Read {len(items)} items from local DB")
        conn.close()

        # ── Connect to Supabase ───────────────────────────────────────────
        _log(log_callback, "☁️  Connecting to Supabase…")
        sb = _admin_client(supabase_url, service_role_key)

        # ── Delete in FK-safe order: items → tabs → categories ────────────
        _log(log_callback, "🗑  Clearing cloud data (items)…")
        sb.table("inv_items").delete().neq("id", 0).execute()

        _log(log_callback, "🗑  Clearing cloud data (tabs)…")
        sb.table("inv_tabs").delete().neq("id", 0).execute()

        _log(log_callback, "🗑  Clearing cloud data (categories)…")
        sb.table("inv_categories").delete().neq("id", 0).execute()

        # ── Insert categories ─────────────────────────────────────────────
        if categories:
            # Postgres SERIAL resets after delete — we force our own ids via insert
            # supabase-py v2: insert a list of dicts
            sb.table("inv_categories").insert(categories).execute()
        _log(log_callback, f"✓ {len(categories)} categories pushed")

        # ── Insert tabs ───────────────────────────────────────────────────
        if tabs:
            sb.table("inv_tabs").insert(tabs).execute()
        _log(log_callback, f"✓ {len(tabs)} tabs pushed")

        # ── Insert items in chunks (Supabase has ~500 row limit per request) ──
        CHUNK = 400
        pushed_items = 0
        for i in range(0, len(items), CHUNK):
            chunk = items[i:i + CHUNK]
            sb.table("inv_items").insert(chunk).execute()
            pushed_items += len(chunk)
            _log(log_callback, f"✓ {pushed_items}/{len(items)} items pushed…")

        elapsed = time.time() - t_start
        summary = f"✅ Push complete — {len(categories)} categories, {len(tabs)} tabs, {len(items)} items in {elapsed:.1f}s"
        _log(log_callback, summary)
        return True, summary

    except Exception as exc:
        msg = f"❌ Push failed: {exc}"
        _log(log_callback, msg)
        return False, str(exc)


# ── PULL: Supabase → local SQLite ────────────────────────────────────────────

def pull(db_path: str, supabase_url: str, service_role_key: str, log_callback=None) -> tuple[bool, str]:
    """
    Read inv_categories, inv_tabs, inv_items from Supabase.
    Full-replace only the inv_* tables in local SQLite.
    All other tables (bills, etc.) are untouched.
    All values stored as TEXT exactly as received — no numeric coercion.
    Returns (success, summary_message).
    """
    t_start = time.time()

    try:
        # ── Connect to Supabase ───────────────────────────────────────────
        _log(log_callback, "☁️  Connecting to Supabase…")
        sb = _admin_client(supabase_url, service_role_key)

        # ── Fetch categories ──────────────────────────────────────────────
        resp = sb.table("inv_categories").select("id,name,icon,position").order("position").execute()
        categories = resp.data
        _log(log_callback, f"📂 Fetched {len(categories)} categories from cloud")

        # ── Fetch tabs ────────────────────────────────────────────────────
        resp = sb.table("inv_tabs").select("id,category_id,name,position").order("position").execute()
        tabs = resp.data
        _log(log_callback, f"📑 Fetched {len(tabs)} tabs from cloud")

        # ── Fetch items — paginate to avoid 1000-row default limit ────────
        items = []
        PAGE = 1000
        offset = 0
        while True:
            resp = (
                sb.table("inv_items")
                .select("id,tab_id,row_index,item_name,rate,rate_without_gst,unit_qty,qty,qty_with_gst")
                .order("tab_id")
                .order("row_index")
                .range(offset, offset + PAGE - 1)
                .execute()
            )
            batch = resp.data
            items.extend(batch)
            if len(batch) < PAGE:
                break
            offset += PAGE
        _log(log_callback, f"🧵 Fetched {len(items)} items from cloud")

        # ── Open local DB ─────────────────────────────────────────────────
        _log(log_callback, "🔌 Opening local database…")
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()

        # ── Ensure inv_* tables exist (in case this is a fresh DB) ────────
        cur.executescript("""
            CREATE TABLE IF NOT EXISTS inv_categories (
                id       INTEGER PRIMARY KEY,
                name     TEXT    NOT NULL,
                icon     TEXT,
                position INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS inv_tabs (
                id          INTEGER PRIMARY KEY,
                category_id INTEGER NOT NULL,
                name        TEXT    NOT NULL,
                position    INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS inv_items (
                id               INTEGER PRIMARY KEY,
                tab_id           INTEGER NOT NULL,
                row_index        INTEGER NOT NULL,
                item_name        TEXT,
                rate             TEXT,
                rate_without_gst TEXT,
                unit_qty         TEXT,
                qty              TEXT,
                qty_with_gst     TEXT
            );
        """)

        # ── Delete local inv_* in FK-safe order ───────────────────────────
        _log(log_callback, "🗑  Clearing local inv_items…")
        cur.execute("DELETE FROM inv_items")

        _log(log_callback, "🗑  Clearing local inv_tabs…")
        cur.execute("DELETE FROM inv_tabs")

        _log(log_callback, "🗑  Clearing local inv_categories…")
        cur.execute("DELETE FROM inv_categories")

        # ── Insert categories ─────────────────────────────────────────────
        for c in categories:
            cur.execute(
                "INSERT INTO inv_categories (id, name, icon, position) VALUES (?, ?, ?, ?)",
                (c["id"], str(c["name"]) if c["name"] is not None else None,
                 str(c["icon"]) if c["icon"] is not None else None,
                 c["position"])
            )
        _log(log_callback, f"✓ {len(categories)} categories written")

        # ── Insert tabs ───────────────────────────────────────────────────
        for t in tabs:
            cur.execute(
                "INSERT INTO inv_tabs (id, category_id, name, position) VALUES (?, ?, ?, ?)",
                (t["id"], t["category_id"],
                 str(t["name"]) if t["name"] is not None else None,
                 t["position"])
            )
        _log(log_callback, f"✓ {len(tabs)} tabs written")

        # ── Insert items ──────────────────────────────────────────────────
        for item in items:
            cur.execute(
                "INSERT INTO inv_items "
                "(id, tab_id, row_index, item_name, rate, rate_without_gst, unit_qty, qty, qty_with_gst) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    item["id"],
                    item["tab_id"],
                    item["row_index"],
                    str(item["item_name"]).rstrip() if item["item_name"] is not None else None,
                    str(item["rate"]) if item["rate"] is not None else None,
                    str(item["rate_without_gst"]) if item["rate_without_gst"] is not None else None,
                    str(item["unit_qty"]) if item["unit_qty"] is not None else None,
                    str(item["qty"]) if item["qty"] is not None else None,
                    str(item["qty_with_gst"]) if item["qty_with_gst"] is not None else None,
                )
            )
        _log(log_callback, f"✓ {len(items)} items written")

        conn.commit()
        conn.close()

        elapsed = time.time() - t_start
        summary = f"✅ Pull complete — {len(categories)} categories, {len(tabs)} tabs, {len(items)} items in {elapsed:.1f}s"
        _log(log_callback, summary)
        return True, summary

    except Exception as exc:
        msg = f"❌ Pull failed: {exc}"
        _log(log_callback, msg)
        return False, str(exc)
