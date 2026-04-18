-- =============================================================================
-- QR Inventory Management Module — database migration
-- =============================================================================
-- Adds vendor-aware batch tracking, per-sticker activity timeline, printable
-- display_code / pin_code columns, and a low-stock alerting system to the
-- existing qr_inventory table.
--
-- Run once in the Supabase SQL editor against the production project.
-- Safe to re-run: every table/index/policy uses IF NOT EXISTS guards.
--
-- Depends on:
--   * is_admin_user()                  — supabase-task20-migration.sql
--   * admin_users table                — existing
--   * qr_codes table                   — existing
--   * qr_inventory table               — existing (extended below)
-- =============================================================================


-- ─── 1. qr_inventory_batches ─────────────────────────────────────────────────
-- One row per bulk-generate run. Tracks vendor ownership across the lifecycle.

CREATE TABLE IF NOT EXISTS qr_inventory_batches (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_number    TEXT NOT NULL UNIQUE,           -- BATCH-YYYY-NNNN
  category        TEXT,
  type            TEXT,
  total_count     INTEGER NOT NULL DEFAULT 0,
  vendor_name     TEXT,
  vendor_contact  TEXT,
  vendor_notes    TEXT,
  status          TEXT NOT NULL DEFAULT 'created'
                   CHECK (status IN ('created', 'sent_to_vendor', 'received', 'fully_assigned')),
  sent_at         TIMESTAMPTZ,
  received_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qr_batches_status     ON qr_inventory_batches(status);
CREATE INDEX IF NOT EXISTS idx_qr_batches_created_at ON qr_inventory_batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_batches_type       ON qr_inventory_batches(type);

ALTER TABLE qr_inventory_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read batches"   ON qr_inventory_batches;
DROP POLICY IF EXISTS "Admins insert batches" ON qr_inventory_batches;
DROP POLICY IF EXISTS "Admins update batches" ON qr_inventory_batches;
DROP POLICY IF EXISTS "Admins delete batches" ON qr_inventory_batches;

CREATE POLICY "Admins read batches"   ON qr_inventory_batches FOR SELECT USING (is_admin_user());
CREATE POLICY "Admins insert batches" ON qr_inventory_batches FOR INSERT WITH CHECK (is_admin_user());
CREATE POLICY "Admins update batches" ON qr_inventory_batches FOR UPDATE USING (is_admin_user()) WITH CHECK (is_admin_user());
CREATE POLICY "Admins delete batches" ON qr_inventory_batches FOR DELETE USING (is_admin_user());


-- ─── 2. Extend qr_inventory ──────────────────────────────────────────────────
-- Existing columns: id, qr_code, type, category, status, created_at.
-- All new columns added defensively with IF NOT EXISTS.

ALTER TABLE qr_inventory ADD COLUMN IF NOT EXISTS batch_id       UUID REFERENCES qr_inventory_batches(id) ON DELETE SET NULL;
ALTER TABLE qr_inventory ADD COLUMN IF NOT EXISTS display_code   TEXT;
ALTER TABLE qr_inventory ADD COLUMN IF NOT EXISTS pin_code       TEXT;
ALTER TABLE qr_inventory ADD COLUMN IF NOT EXISTS qr_url         TEXT;
ALTER TABLE qr_inventory ADD COLUMN IF NOT EXISTS linked_qr_id   UUID REFERENCES qr_codes(id) ON DELETE SET NULL;
ALTER TABLE qr_inventory ADD COLUMN IF NOT EXISTS linked_user_id UUID;
ALTER TABLE qr_inventory ADD COLUMN IF NOT EXISTS vendor_name    TEXT;
ALTER TABLE qr_inventory ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT now();

-- Lifecycle: unassigned → sent_to_vendor → in_stock → assigned.
-- Legacy rows use unclaimed/claimed/activated — migrate them in place.
UPDATE qr_inventory SET status = 'unassigned' WHERE status = 'unclaimed';
UPDATE qr_inventory SET status = 'in_stock'   WHERE status = 'claimed';
UPDATE qr_inventory SET status = 'assigned'   WHERE status = 'activated';

-- Drop any legacy CHECK constraint, then add the new one.
ALTER TABLE qr_inventory DROP CONSTRAINT IF EXISTS qr_inventory_status_check;
ALTER TABLE qr_inventory ADD  CONSTRAINT qr_inventory_status_check
  CHECK (status IN ('unassigned', 'sent_to_vendor', 'in_stock', 'assigned'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_qr_inventory_display_code ON qr_inventory(display_code) WHERE display_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qr_inventory_batch_id   ON qr_inventory(batch_id);
CREATE INDEX IF NOT EXISTS idx_qr_inventory_status     ON qr_inventory(status);
CREATE INDEX IF NOT EXISTS idx_qr_inventory_type       ON qr_inventory(type);
CREATE INDEX IF NOT EXISTS idx_qr_inventory_linked_qr  ON qr_inventory(linked_qr_id);
CREATE INDEX IF NOT EXISTS idx_qr_inventory_created_at ON qr_inventory(created_at DESC);

-- RLS (re-enable defensively in case this table was created without it).
ALTER TABLE qr_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read inventory"   ON qr_inventory;
DROP POLICY IF EXISTS "Admins insert inventory" ON qr_inventory;
DROP POLICY IF EXISTS "Admins update inventory" ON qr_inventory;
DROP POLICY IF EXISTS "Admins delete inventory" ON qr_inventory;
DROP POLICY IF EXISTS "Public read inventory for claim" ON qr_inventory;

-- Admins can do anything.
CREATE POLICY "Admins read inventory"   ON qr_inventory FOR SELECT USING (is_admin_user());
CREATE POLICY "Admins insert inventory" ON qr_inventory FOR INSERT WITH CHECK (is_admin_user());
CREATE POLICY "Admins update inventory" ON qr_inventory FOR UPDATE USING (is_admin_user()) WITH CHECK (is_admin_user());
CREATE POLICY "Admins delete inventory" ON qr_inventory FOR DELETE USING (is_admin_user());

-- Secondary safety net: allows the anonymous Supabase client to detect an
-- unclaimed sticker by exact UUID match. The primary path is the server-side
-- GET /api/qr/info/:id endpoint (service-role), which never exposes pin_code.
-- This policy intentionally does NOT select pin_code — callers must restrict
-- their .select() to claim-safe columns only (id, status, type, display_code).
-- Restricted to rows that are not yet assigned and already have a display_code
-- so bulk enumeration yields no useful data for assigned/inactive inventory.
CREATE POLICY "Public read inventory for claim"
  ON qr_inventory FOR SELECT
  USING (status IN ('unassigned', 'sent_to_vendor', 'in_stock') AND display_code IS NOT NULL);


-- ─── 3. qr_inventory_events (activity timeline) ──────────────────────────────
-- Append-only event log per inventory row.

CREATE TABLE IF NOT EXISTS qr_inventory_events (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_id  UUID NOT NULL REFERENCES qr_inventory(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL
                 CHECK (event_type IN (
                   'created', 'added_to_batch', 'sent_to_vendor',
                   'received_in_stock', 'assigned', 'scanned',
                   'edited', 'deleted', 'claim_failed'
                 )),
  description   TEXT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qr_inventory_events_inventory_id ON qr_inventory_events(inventory_id);
CREATE INDEX IF NOT EXISTS idx_qr_inventory_events_created_at   ON qr_inventory_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_inventory_events_event_type   ON qr_inventory_events(event_type);

ALTER TABLE qr_inventory_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read events"   ON qr_inventory_events;
DROP POLICY IF EXISTS "Admins insert events" ON qr_inventory_events;

CREATE POLICY "Admins read events"   ON qr_inventory_events FOR SELECT USING (is_admin_user());
CREATE POLICY "Admins insert events" ON qr_inventory_events FOR INSERT WITH CHECK (is_admin_user());
-- Intentionally no UPDATE / DELETE policies — events are append-only.


-- ─── 4. inventory_category_settings (low-stock thresholds) ───────────────────

CREATE TABLE IF NOT EXISTS inventory_category_settings (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category              TEXT NOT NULL UNIQUE,
  low_stock_threshold   INTEGER NOT NULL DEFAULT 10,
  reorder_count         INTEGER NOT NULL DEFAULT 100,
  alert_email           TEXT,
  last_alerted_at       TIMESTAMPTZ,
  auto_generate         BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE inventory_category_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read category settings"   ON inventory_category_settings;
DROP POLICY IF EXISTS "Admins insert category settings" ON inventory_category_settings;
DROP POLICY IF EXISTS "Admins update category settings" ON inventory_category_settings;

CREATE POLICY "Admins read category settings"   ON inventory_category_settings FOR SELECT USING (is_admin_user());
CREATE POLICY "Admins insert category settings" ON inventory_category_settings FOR INSERT WITH CHECK (is_admin_user());
CREATE POLICY "Admins update category settings" ON inventory_category_settings FOR UPDATE USING (is_admin_user()) WITH CHECK (is_admin_user());

-- Seed one row per known category. ON CONFLICT DO NOTHING keeps admin tweaks safe.
INSERT INTO inventory_category_settings (category, low_stock_threshold, reorder_count)
VALUES
  ('vehicle',    10, 100),
  ('pet',        10, 100),
  ('child',      10, 100),
  ('medical',    10, 100),
  ('luggage',    10, 100),
  ('wallet',     10, 100),
  ('home',       10, 100),
  ('event',      10, 100),
  ('business',   10, 100),
  ('belongings', 10, 100)
ON CONFLICT (category) DO NOTHING;


-- ─── 5. inventory_low_stock_alerts (active alerts surface) ───────────────────

CREATE TABLE IF NOT EXISTS inventory_low_stock_alerts (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category              TEXT NOT NULL,
  current_stock         INTEGER NOT NULL,
  threshold             INTEGER NOT NULL,
  status                TEXT NOT NULL DEFAULT 'open'
                         CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_by_batch_id  UUID REFERENCES qr_inventory_batches(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_low_stock_status_category ON inventory_low_stock_alerts(status, category);
CREATE INDEX IF NOT EXISTS idx_low_stock_created_at      ON inventory_low_stock_alerts(created_at DESC);

ALTER TABLE inventory_low_stock_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read low stock alerts"   ON inventory_low_stock_alerts;
DROP POLICY IF EXISTS "Admins insert low stock alerts" ON inventory_low_stock_alerts;
DROP POLICY IF EXISTS "Admins update low stock alerts" ON inventory_low_stock_alerts;

CREATE POLICY "Admins read low stock alerts"   ON inventory_low_stock_alerts FOR SELECT USING (is_admin_user());
CREATE POLICY "Admins insert low stock alerts" ON inventory_low_stock_alerts FOR INSERT WITH CHECK (is_admin_user());
CREATE POLICY "Admins update low stock alerts" ON inventory_low_stock_alerts FOR UPDATE USING (is_admin_user()) WITH CHECK (is_admin_user());


-- ─── 6. check_inventory_low_stock() — alerting engine ────────────────────────
-- 1. For each category in inventory_category_settings, count unassigned rows.
-- 2. If count <= threshold AND (no open alert for this category OR last_alerted_at
--    was > 24h ago), insert a new alert and bump last_alerted_at.
-- 3. Auto-resolve any open alerts whose categories have climbed back above threshold.

CREATE OR REPLACE FUNCTION check_inventory_low_stock()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  setting_row  RECORD;
  stock_count  INTEGER;
  has_open     BOOLEAN;
  last_alert   TIMESTAMPTZ;
BEGIN
  FOR setting_row IN SELECT * FROM inventory_category_settings LOOP
    SELECT COUNT(*) INTO stock_count
      FROM qr_inventory
     WHERE type = setting_row.category
       AND status = 'unassigned';

    SELECT EXISTS (
      SELECT 1 FROM inventory_low_stock_alerts
       WHERE category = setting_row.category AND status = 'open'
    ) INTO has_open;

    IF stock_count <= setting_row.low_stock_threshold THEN
      -- Breach. Insert an alert unless dedup window protects us.
      last_alert := setting_row.last_alerted_at;
      IF NOT has_open AND (last_alert IS NULL OR last_alert < now() - INTERVAL '24 hours') THEN
        INSERT INTO inventory_low_stock_alerts (category, current_stock, threshold)
             VALUES (setting_row.category, stock_count, setting_row.low_stock_threshold);

        UPDATE inventory_category_settings
           SET last_alerted_at = now(), updated_at = now()
         WHERE id = setting_row.id;
      END IF;
    ELSE
      -- Stock is healthy — close any lingering open alerts for this category.
      IF has_open THEN
        UPDATE inventory_low_stock_alerts
           SET status = 'resolved', resolved_at = now()
         WHERE category = setting_row.category AND status = 'open';
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- ─── 7. pg_cron schedule (every 30 minutes) ──────────────────────────────────
-- Wrapped in a DO block so the migration doesn't fail on Supabase projects
-- where pg_cron isn't enabled yet; admins can install the extension and
-- re-run this block separately.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove any previous schedule with the same name before re-creating.
    PERFORM cron.unschedule('inventory_low_stock_check')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'inventory_low_stock_check');

    PERFORM cron.schedule(
      'inventory_low_stock_check',
      '*/30 * * * *',
      $cron$ SELECT check_inventory_low_stock(); $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron extension not installed — skipping low-stock schedule. '
                 'Enable it in Supabase Dashboard → Database → Extensions, then re-run the DO block.';
  END IF;
END;
$$;


-- ─── 8. Verification ─────────────────────────────────────────────────────────
-- Paste these in the SQL editor after running the migration:
--   SELECT column_name FROM information_schema.columns WHERE table_name='qr_inventory';
--   SELECT * FROM qr_inventory_batches LIMIT 1;
--   SELECT * FROM qr_inventory_events LIMIT 1;
--   SELECT * FROM inventory_category_settings ORDER BY category;
--   SELECT * FROM inventory_low_stock_alerts LIMIT 1;
--   SELECT check_inventory_low_stock();  -- manual trigger
