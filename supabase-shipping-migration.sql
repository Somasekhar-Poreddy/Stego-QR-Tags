-- Shiprocket shipping integration — add shipping columns to orders table
-- Run in Supabase SQL Editor

ALTER TABLE orders ADD COLUMN IF NOT EXISTS shiprocket_order_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shiprocket_shipment_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS awb_code text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_id integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost numeric(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery date;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

CREATE INDEX IF NOT EXISTS orders_awb_idx ON orders (awb_code) WHERE awb_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_shiprocket_idx ON orders (shiprocket_order_id) WHERE shiprocket_order_id IS NOT NULL;
