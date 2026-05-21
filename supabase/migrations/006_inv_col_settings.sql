-- Migration 006: inv_col_settings table
-- Stores per-column label and visibility settings for the catalogue item table.
-- Admin can rename columns and hide them; staff catalogue reflects changes live.

CREATE TABLE IF NOT EXISTS inv_col_settings (
  key      TEXT PRIMARY KEY,
  label    TEXT NOT NULL,
  visible  BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE inv_col_settings ENABLE ROW LEVEL SECURITY;

-- Anyone (anon/authenticated) can read — staff catalogue needs this
CREATE POLICY "inv_col_settings public read"
  ON inv_col_settings FOR SELECT TO anon, authenticated USING (true);

-- Only authenticated (admin) can insert
CREATE POLICY "inv_col_settings admin insert"
  ON inv_col_settings FOR INSERT TO authenticated WITH CHECK (true);

-- Only authenticated (admin) can update
CREATE POLICY "inv_col_settings admin update"
  ON inv_col_settings FOR UPDATE TO authenticated USING (true);

-- Seed defaults
INSERT INTO inv_col_settings (key, label, visible, position) VALUES
  ('rate',             'Rate',       true, 0),
  ('rate_without_gst', 'W/O GST',    true, 1),
  ('unit_qty',         'Unit/Qty',   true, 2),
  ('qty',              'Qty Rate',   true, 3),
  ('qty_with_gst',     'QTY w/GST',  true, 4)
ON CONFLICT (key) DO NOTHING;
