-- ============================================================
-- PriceMaster — 001_init.sql
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── inv_categories ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inv_categories (
  id       SERIAL PRIMARY KEY,
  name     TEXT    UNIQUE NOT NULL,
  icon     TEXT,
  position INTEGER DEFAULT 0
);

-- ── inv_tabs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inv_tabs (
  id          SERIAL  PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES inv_categories(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  position    INTEGER DEFAULT 0
);

-- ── inv_items ──────────────────────────────────────────────
-- All value fields stay TEXT. Never cast to numeric.
-- Values like "8/MTR", "600/roll" are valid.
CREATE TABLE IF NOT EXISTS inv_items (
  id               SERIAL  PRIMARY KEY,
  tab_id           INTEGER NOT NULL REFERENCES inv_tabs(id) ON DELETE CASCADE,
  row_index        INTEGER NOT NULL,
  item_name        TEXT,
  rate             TEXT,
  rate_without_gst TEXT,
  unit_qty         TEXT,
  qty              TEXT,
  qty_with_gst     TEXT
);

-- ── staff_users ────────────────────────────────────────────
-- Staff are NOT in Supabase Auth. They live here only.
-- Passwords are bcrypt-hashed before storage (done in Edge Function).
CREATE TABLE IF NOT EXISTS staff_users (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT        NOT NULL,
  phone         TEXT        NOT NULL,
  designation   TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  approved      BOOLEAN     DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inv_tabs_category_id ON inv_tabs(category_id);
CREATE INDEX IF NOT EXISTS idx_inv_items_tab_id     ON inv_items(tab_id);
CREATE INDEX IF NOT EXISTS idx_inv_items_row_index  ON inv_items(tab_id, row_index);

-- ── RLS: Enable on all tables ──────────────────────────────
ALTER TABLE inv_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_tabs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_users    ENABLE ROW LEVEL SECURITY;

-- ── inv_categories: public read, service_role writes ───────
CREATE POLICY "Public can read categories"
  ON inv_categories FOR SELECT
  TO anon, authenticated
  USING (true);

-- ── inv_tabs: public read, service_role writes ─────────────
CREATE POLICY "Public can read tabs"
  ON inv_tabs FOR SELECT
  TO anon, authenticated
  USING (true);

-- ── inv_items: public read, service_role writes ────────────
CREATE POLICY "Public can read items"
  ON inv_items FOR SELECT
  TO anon, authenticated
  USING (true);

-- ── staff_users: NO public read. service_role only. ────────
-- All reads and writes go through Edge Functions which use service_role.
-- No direct client access to staff_users is allowed.

-- (service_role bypasses RLS entirely — no policy needed for it)
-- We do NOT create any select/insert/update/delete policies for staff_users,
-- so all direct access via anon or authenticated keys is blocked.

-- ── Done ───────────────────────────────────────────────────
-- After running this migration:
-- 1. Go to Storage → no buckets needed
-- 2. Deploy Edge Functions: staff-login, staff-signup
-- 3. Add SUPABASE_SERVICE_ROLE_KEY to Edge Function secrets
