-- Task #20: QR Scan Tracking + Admin IP Access Logs
-- Run this once in the Supabase SQL editor

-- ─── Helper function: is current user an admin? ──────────────────────────────
-- Checks the admin_users table (covers all roles: super_admin, ops_manager, etc.)
-- SECURITY DEFINER so it can query admin_users without the caller needing direct access.
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  );
$$;

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

-- Anyone (including anonymous visitors) can insert scan events
CREATE POLICY "Anyone can insert scans"
  ON qr_scans FOR INSERT
  WITH CHECK (true);

-- Only users with an admin_users record can read scan data
-- (service role bypasses RLS automatically for backend updates)
CREATE POLICY "Admins only can read scans"
  ON qr_scans FOR SELECT
  USING (is_admin_user());

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

-- Only admins can read or write IP access logs
-- (inserts are made server-side via service role which bypasses RLS,
--  but this policy covers any direct client access too)
CREATE POLICY "Admins only can read ip access logs"
  ON admin_ip_access_logs FOR SELECT
  USING (is_admin_user());

CREATE POLICY "Admins only can insert ip access logs"
  ON admin_ip_access_logs FOR INSERT
  WITH CHECK (is_admin_user());

-- ─── NOTE ─────────────────────────────────────────────────────────────────────
-- The root super admin (identified via VITE_ADMIN_USER_IDS env var) must also
-- have a record in the admin_users table with role = 'super_admin' for direct
-- Supabase client reads to work.  The Express API endpoints (/api/track-scan,
-- /api/admin/decrypt-ip) always use the service role key and bypass RLS entirely.
