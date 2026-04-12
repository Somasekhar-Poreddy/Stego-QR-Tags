-- Task #20: QR Scan Tracking + Admin IP Access Logs
-- Run this once in the Supabase SQL editor

-- ─── qr_scans table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS qr_scans (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  qr_id           UUID REFERENCES qr_codes(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  masked_ip       TEXT,
  hashed_ip       TEXT,
  encrypted_ip    TEXT,
  city            TEXT,
  state           TEXT,
  country         TEXT,
  pincode         TEXT,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  timezone        TEXT,
  device          TEXT,
  browser         TEXT,
  os              TEXT,
  referrer        TEXT,
  session_id      TEXT,
  intent          TEXT,
  is_request_made BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qr_scans_qr_id      ON qr_scans(qr_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_created_at ON qr_scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_scans_session    ON qr_scans(session_id);

ALTER TABLE qr_scans ENABLE ROW LEVEL SECURITY;

-- Anonymous visitors can insert scan events
CREATE POLICY "Anyone can insert scans"
  ON qr_scans FOR INSERT
  WITH CHECK (true);

-- Authenticated users (admins) can read all scans
CREATE POLICY "Authenticated can read all scans"
  ON qr_scans FOR SELECT
  USING (auth.role() = 'authenticated');

-- Service role (backend) can update scans (intent + is_request_made)
CREATE POLICY "Service role can update scans"
  ON qr_scans FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ─── admin_ip_access_logs table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_ip_access_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id    UUID NOT NULL,
  qr_id       UUID,
  scan_id     UUID,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aial_admin_id  ON admin_ip_access_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_aial_viewed_at ON admin_ip_access_logs(viewed_at DESC);

ALTER TABLE admin_ip_access_logs ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert access log entries (done server-side via service role)
CREATE POLICY "Authenticated can insert ip access logs"
  ON admin_ip_access_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can read all ip access logs
CREATE POLICY "Authenticated can read ip access logs"
  ON admin_ip_access_logs FOR SELECT
  USING (auth.role() = 'authenticated');
