-- =============================================================
-- Stegofy QR — Ecommerce Schema Migration (Task #29)
-- Run this once in the Supabase SQL Editor.
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS guards.
-- =============================================================

-- ─────────────────────────────────────────────────
-- 0. Drop existing simple products / orders tables
--    (they are being replaced with richer schemas)
-- ─────────────────────────────────────────────────
DROP TABLE IF EXISTS order_items  CASCADE;
DROP TABLE IF EXISTS cart_items   CASCADE;
DROP TABLE IF EXISTS reviews      CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS orders       CASCADE;
DROP TABLE IF EXISTS products     CASCADE;

-- ─────────────────────────────────────────────────
-- 1. products
-- ─────────────────────────────────────────────────
CREATE TABLE products (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT        NOT NULL,
  slug            TEXT        NOT NULL UNIQUE,
  description     TEXT,
  category        TEXT,                                  -- vehicle | pet | medical | kids | other
  images          TEXT[]      DEFAULT '{}',              -- array of image URLs
  price           NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_price  NUMERIC(10,2),
  rating          NUMERIC(3,1) NOT NULL DEFAULT 0,
  review_count    INTEGER     NOT NULL DEFAULT 0,
  badges          TEXT[]      DEFAULT '{}',              -- best_seller | popular | new
  features        TEXT[]      DEFAULT '{}',              -- bullet-point feature strings
  specifications  JSONB       DEFAULT '{}',              -- key-value pairs
  stock_quantity  INTEGER     NOT NULL DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category  ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Anon/authenticated users can read active products
CREATE POLICY "Public read active products"
  ON products FOR SELECT
  USING (is_active = TRUE);

-- Admin can read ALL products (active + inactive)
CREATE POLICY "Admin read all products"
  ON products FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- Admin can insert / update / delete products
CREATE POLICY "Admin insert products"
  ON products FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));

CREATE POLICY "Admin update products"
  ON products FOR UPDATE
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

CREATE POLICY "Admin delete products"
  ON products FOR DELETE
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ─────────────────────────────────────────────────
-- 2. product_variants
-- ─────────────────────────────────────────────────
CREATE TABLE product_variants (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id   UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_name TEXT        NOT NULL,
  price        NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock        INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pv_product_id ON product_variants(product_id);

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read product variants"
  ON product_variants FOR SELECT
  USING (TRUE);

CREATE POLICY "Admin manage product variants"
  ON product_variants FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM admin_users))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));

-- ─────────────────────────────────────────────────
-- 3. cart_items
-- ─────────────────────────────────────────────────
CREATE TABLE cart_items (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID        REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity   INTEGER     NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, product_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_user_id ON cart_items(user_id);

ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cart"
  ON cart_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin read all cart items"
  ON cart_items FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ─────────────────────────────────────────────────
-- 4. orders
-- ─────────────────────────────────────────────────
CREATE TABLE orders (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  total_price      NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_type     TEXT        NOT NULL DEFAULT 'cod',   -- cod | online
  order_status     TEXT        NOT NULL DEFAULT 'placed',
    -- placed | confirmed | packed | shipped | delivered | cancelled
  shipping_details JSONB       DEFAULT '{}',
    -- { name, phone, alternate_phone, email, address, landmark, pincode, city, state }
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id      ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at   ON orders(created_at DESC);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own orders"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin read all orders"
  ON orders FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

CREATE POLICY "Admin update orders"
  ON orders FOR UPDATE
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ─────────────────────────────────────────────────
-- 5. order_items
-- ─────────────────────────────────────────────────
CREATE TABLE order_items (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id     UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   UUID        REFERENCES products(id) ON DELETE SET NULL,
  variant_id   UUID        REFERENCES product_variants(id) ON DELETE SET NULL,
  product_name TEXT        NOT NULL,  -- snapshot at order time
  variant_name TEXT,                  -- snapshot at order time
  quantity     INTEGER     NOT NULL DEFAULT 1,
  price        NUMERIC(10,2) NOT NULL DEFAULT 0,  -- unit price at order time
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oi_order_id   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_oi_product_id ON order_items(product_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own order items"
  ON order_items FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM orders WHERE id = order_items.order_id
    )
  );

CREATE POLICY "Users insert order items"
  ON order_items FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM orders WHERE id = order_items.order_id
    )
  );

CREATE POLICY "Admin read all order items"
  ON order_items FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ─────────────────────────────────────────────────
-- 6. reviews
-- ─────────────────────────────────────────────────
CREATE TABLE reviews (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  rating     INTEGER     NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment    TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id    ON reviews(user_id);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read reviews"
  ON reviews FOR SELECT
  USING (TRUE);

CREATE POLICY "Authenticated users insert review"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);

CREATE POLICY "Users update own review"
  ON reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own review"
  ON reviews FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admin manage reviews"
  ON reviews FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM admin_users))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));

-- =============================================================
-- Done! All 6 ecommerce tables created with RLS policies.
-- =============================================================
