-- ── Financial Reports tables ──────────────────────────────────────────────────
-- Migration: 002_fin_init.sql
-- Run once in Supabase SQL Editor.

-- Party summary (one row per party per type)
CREATE TABLE IF NOT EXISTS fin_parties (
  id            SERIAL PRIMARY KEY,
  party_type    TEXT NOT NULL CHECK (party_type IN ('debtor','creditor')),
  party_name    TEXT NOT NULL,
  opening_bal   NUMERIC DEFAULT 0,
  closing_bal   NUMERIC DEFAULT 0,
  status        TEXT,
  synced_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (party_type, party_name)
);

-- Full ledger entries
CREATE TABLE IF NOT EXISTS fin_ledger (
  id          SERIAL PRIMARY KEY,
  party_type  TEXT NOT NULL,
  party_name  TEXT NOT NULL,
  txn_date    DATE,
  vch_type    TEXT,
  vch_no      TEXT,
  narration   TEXT,
  debit       NUMERIC DEFAULT 0,
  credit      NUMERIC DEFAULT 0,
  balance     NUMERIC DEFAULT 0
);

-- Outstanding invoice breakdown (only for parties with outstanding)
CREATE TABLE IF NOT EXISTS fin_outstanding (
  id           SERIAL PRIMARY KEY,
  party_type   TEXT NOT NULL,
  party_name   TEXT NOT NULL,
  inv_date     DATE,
  vch_type     TEXT,
  vch_no       TEXT,
  original_amt NUMERIC DEFAULT 0,
  paid_amt     NUMERIC DEFAULT 0,
  remaining    NUMERIC DEFAULT 0,
  reason       TEXT
);

-- Address book
CREATE TABLE IF NOT EXISTS fin_address (
  id             SERIAL PRIMARY KEY,
  party_name     TEXT NOT NULL UNIQUE,
  address        TEXT,
  party_group    TEXT,
  pincode        TEXT,
  state_name     TEXT,
  contact_person TEXT,
  phone          TEXT,
  mobile         TEXT,
  email          TEXT,
  website        TEXT,
  pan_no         TEXT,
  gstin          TEXT,
  reg_type       TEXT
);

-- Admin notes per party (written in the app, not from Excel)
CREATE TABLE IF NOT EXISTS fin_party_notes (
  id          SERIAL PRIMARY KEY,
  party_type  TEXT NOT NULL,
  party_name  TEXT NOT NULL,
  note_text   TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Pinned parties (admin starred)
CREATE TABLE IF NOT EXISTS fin_pinned (
  id          SERIAL PRIMARY KEY,
  party_type  TEXT NOT NULL,
  party_name  TEXT NOT NULL,
  UNIQUE(party_type, party_name)
);

-- Sync log
CREATE TABLE IF NOT EXISTS fin_sync_log (
  id          SERIAL PRIMARY KEY,
  file_type   TEXT NOT NULL, -- 'debtors' | 'creditors' | 'address_book'
  synced_at   TIMESTAMPTZ DEFAULT now(),
  row_count   INTEGER,
  party_count INTEGER,
  status      TEXT
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE fin_parties       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_ledger        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_outstanding   ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_address       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_party_notes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_pinned        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_sync_log      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin public read parties"     ON fin_parties     FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "fin public read ledger"      ON fin_ledger      FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "fin public read outstanding" ON fin_outstanding FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "fin public read address"     ON fin_address     FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "fin public read notes"       ON fin_party_notes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "fin public read pinned"      ON fin_pinned      FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "fin public read sync_log"    ON fin_sync_log    FOR SELECT TO anon, authenticated USING (true);

-- Notes + pinned: admin can write (authenticated = admin session)
CREATE POLICY "fin admin write notes"   ON fin_party_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fin admin delete notes"  ON fin_party_notes FOR DELETE TO authenticated USING (true);
CREATE POLICY "fin admin write pinned"  ON fin_pinned      FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fin admin delete pinned" ON fin_pinned      FOR DELETE TO authenticated USING (true);
