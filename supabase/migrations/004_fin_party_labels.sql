-- Migration 004: Replace per-row fin_ledger_labels with per-party fin_party_labels
-- FIN-6 correction: labels are per-party (per ledger account), not per transaction row.

-- Drop the wrong per-row table
DROP TABLE IF EXISTS fin_ledger_labels;

-- Create correct per-party label table
CREATE TABLE IF NOT EXISTS fin_party_labels (
  id          SERIAL PRIMARY KEY,
  party_type  TEXT NOT NULL,   -- 'debtor' | 'creditor'
  party_name  TEXT NOT NULL,
  label_key   TEXT NOT NULL,   -- 'checked' | 'make_receipt' | 'send_for_checking' | custom UUID
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(party_type, party_name)   -- one label per party
);

ALTER TABLE fin_party_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin public read party_labels"
  ON fin_party_labels FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "fin admin write party_labels"
  ON fin_party_labels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fin admin update party_labels"
  ON fin_party_labels FOR UPDATE TO authenticated USING (true);
CREATE POLICY "fin admin delete party_labels"
  ON fin_party_labels FOR DELETE TO authenticated USING (true);

-- fin_custom_labels stays unchanged — custom labels are still global
