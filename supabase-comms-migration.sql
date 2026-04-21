-- ============================================================================
-- Stegofy Comms Platform — schema migration
-- ----------------------------------------------------------------------------
-- Tables for the multi-provider communication platform (Zavu + Exotel).
-- Mirrors the idempotent CREATE TABLE statements that the api-server runs at
-- startup in `artifacts/api-server/src/lib/migrations.ts`, but pinned here so
-- the schema is versioned in git and can be applied to a fresh Supabase
-- project without booting the server first.
--
-- Apply via Supabase SQL Editor or `supabase db push`.
--
-- All tables in this file are server-only. RLS is enabled with NO policies,
-- so the anon / authenticated keys cannot read or write them; the api-server
-- uses the service-role key which bypasses RLS by design.
-- ============================================================================

-- OTP codes -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS otp_codes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash    text NOT NULL,
  code_hash     text NOT NULL,
  qr_id         uuid NULL,
  purpose       text NOT NULL,
  channel       text NOT NULL,
  attempts      integer NOT NULL DEFAULT 0,
  expires_at    timestamptz NOT NULL,
  consumed_at   timestamptz NULL,
  ip_address    text NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS otp_codes_phone_hash_idx ON otp_codes (phone_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS otp_codes_expires_idx    ON otp_codes (expires_at);

ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Message logs (WhatsApp + SMS) -----------------------------------------------
CREATE TABLE IF NOT EXISTS message_logs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_request_id   uuid NULL,
  qr_id                uuid NULL,
  recipient_phone_hash text NOT NULL,
  channel              text NOT NULL,
  provider             text NOT NULL,
  provider_message_id  text NULL,
  status               text NOT NULL DEFAULT 'queued',
  template             text NULL,
  payload_summary      text NULL,
  error_code           text NULL,
  error_message        text NULL,
  cost_paise           integer NOT NULL DEFAULT 0,
  fallback_from        text NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS message_logs_created_idx              ON message_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS message_logs_provider_message_id_idx  ON message_logs (provider, provider_message_id);
CREATE INDEX IF NOT EXISTS message_logs_contact_request_idx      ON message_logs (contact_request_id);

ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;

-- Call logs -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS call_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_request_id  uuid NULL,
  qr_id               uuid NULL,
  caller_phone_hash   text NOT NULL,
  callee_phone_hash   text NOT NULL,
  provider            text NOT NULL,
  provider_call_id    text NULL,
  status              text NOT NULL DEFAULT 'initiated',
  duration_seconds    integer NOT NULL DEFAULT 0,
  cost_paise          integer NOT NULL DEFAULT 0,
  error_code          text NULL,
  error_message       text NULL,
  started_at          timestamptz NULL,
  ended_at            timestamptz NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS call_logs_created_idx           ON call_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS call_logs_provider_call_id_idx  ON call_logs (provider, provider_call_id);
CREATE INDEX IF NOT EXISTS call_logs_contact_request_idx   ON call_logs (contact_request_id);

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- Rate-limit buckets (OTP resend, per-QR call cap, cooldowns) -----------------
CREATE TABLE IF NOT EXISTS comms_rate_buckets (
  id           bigserial PRIMARY KEY,
  bucket_key   text NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket_key, window_start)
);

CREATE INDEX IF NOT EXISTS comms_rate_buckets_window_idx ON comms_rate_buckets (window_start);

ALTER TABLE comms_rate_buckets ENABLE ROW LEVEL SECURITY;

-- Pending disconnects (hang-up scheduler that survives restarts) --------------
CREATE TABLE IF NOT EXISTS pending_disconnects (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          text NOT NULL,
  provider_call_id  text NOT NULL,
  scheduled_at      timestamptz NOT NULL,
  processed_at      timestamptz NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pending_disconnects_scheduled_idx
  ON pending_disconnects (scheduled_at)
  WHERE processed_at IS NULL;

ALTER TABLE pending_disconnects ENABLE ROW LEVEL SECURITY;

-- contact_requests augmentation -----------------------------------------------
-- The comms-public routes stash the delivery trail (message_log / call_log ids,
-- providerCallId, channelUsed, provider) in this jsonb column so the admin
-- dashboard can reconstruct the trail without scanning by phone hash.
ALTER TABLE contact_requests
  ADD COLUMN IF NOT EXISTS provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
