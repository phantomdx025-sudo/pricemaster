-- Migration 005: app_settings table
-- Stores key/value settings editable from the admin panel.
-- Used by AX-1 for entity_name (displayed in PDF headers).

CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone (anon/authenticated) can read settings — needed for PDF generation from client
CREATE POLICY "app_settings public read"
  ON app_settings FOR SELECT TO anon, authenticated USING (true);

-- Only authenticated (admin) can insert
CREATE POLICY "app_settings admin insert"
  ON app_settings FOR INSERT TO authenticated WITH CHECK (true);

-- Only authenticated (admin) can update
CREATE POLICY "app_settings admin update"
  ON app_settings FOR UPDATE TO authenticated USING (true);

-- Seed default entity name
INSERT INTO app_settings (key, value) VALUES ('entity_name', 'ANKxIOUS')
  ON CONFLICT (key) DO NOTHING;
