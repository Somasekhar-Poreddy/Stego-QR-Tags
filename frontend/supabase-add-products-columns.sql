-- =============================================================
-- Stegofy QR — Products Table: Add Missing Columns (Task #8)
-- Run this ONCE in the Supabase SQL Editor.
-- Safe to re-run: all statements use ADD COLUMN IF NOT EXISTS.
-- Does NOT drop or recreate the table — existing rows are kept.
-- =============================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS badges         TEXT[]        DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS features       TEXT[]        DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS specifications JSONB         DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS discount_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS review_count   INTEGER       NOT NULL DEFAULT 0;

-- Back-fill any NULLs that might exist from rows inserted before this migration
UPDATE products SET badges         = '{}'  WHERE badges         IS NULL;
UPDATE products SET features       = '{}'  WHERE features       IS NULL;
UPDATE products SET specifications = '{}'  WHERE specifications IS NULL;
UPDATE products SET review_count   = 0     WHERE review_count   IS NULL;

-- =============================================================
-- Done! The following columns are now present on `products`:
--   badges         TEXT[]        DEFAULT '{}'
--   features       TEXT[]        DEFAULT '{}'
--   specifications JSONB         DEFAULT '{}'
--   discount_price NUMERIC(10,2) (nullable)
--   review_count   INTEGER       NOT NULL DEFAULT 0
-- =============================================================
