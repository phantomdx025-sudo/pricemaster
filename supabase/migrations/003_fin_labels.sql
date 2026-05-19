-- Migration 003 — Ledger Label System (FIN-6)
-- Creates fin_ledger_labels and fin_custom_labels.
--
-- IMPORTANT: NO foreign key to fin_ledger — labels must survive ledger re-syncs.
-- The sync tool does DELETE + re-insert on fin_ledger. Labels are keyed on
-- (party_type, party_name, txn_date, vch_no) which are stable Tally values.

-- ── fin_ledger_labels ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fin_ledger_labels (
  id           SERIAL PRIMARY KEY,
  party_type   TEXT NOT NULL,                -- 'debtor' | 'creditor'
  party_name   TEXT NOT NULL,
  txn_date     DATE,
  vch_no       TEXT,
  label_key    TEXT NOT NULL,                -- system or custom UUID
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(party_type, party_name, txn_date, vch_no)   -- one label per row, stable identity
);

-- ── fin_custom_labels ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fin_custom_labels (
  id         SERIAL PRIMARY KEY,
  label_key  TEXT NOT NULL UNIQUE,           -- UUID generated client-side
  label_name TEXT NOT NULL,
  color_hex  TEXT NOT NULL,                  -- e.g. '#e74c3c'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE fin_ledger_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_custom_labels ENABLE ROW LEVEL SECURITY;

-- fin_ledger_labels policies
CREATE POLICY "fin public read ledger_labels"
  ON fin_ledger_labels FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "fin admin write ledger_labels"
  ON fin_ledger_labels FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "fin admin update ledger_labels"
  ON fin_ledger_labels FOR UPDATE TO authenticated USING (true);

CREATE POLICY "fin admin delete ledger_labels"
  ON fin_ledger_labels FOR DELETE TO authenticated USING (true);

-- fin_custom_labels policies
CREATE POLICY "fin public read custom_labels"
  ON fin_custom_labels FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "fin admin write custom_labels"
  ON fin_custom_labels FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "fin admin delete custom_labels"
  ON fin_custom_labels FOR DELETE TO authenticated USING (true);

-- ── Confirm no CASCADE from fin_ledger ───────────────────────────────────
-- fin_ledger_labels has NO foreign key to fin_ledger.
-- When sync tool does DELETE FROM fin_ledger WHERE ..., labels are unaffected.
-- This is intentional and must stay this way.
