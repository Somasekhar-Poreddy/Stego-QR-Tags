import pg from "pg";
import { logger } from "./logger.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set for comms migrations.");
  }
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}

export function getCommsPool(): pg.Pool {
  return getPool();
}

const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS otp_codes (
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
   )`,
  `CREATE INDEX IF NOT EXISTS otp_codes_phone_hash_idx ON otp_codes (phone_hash, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS otp_codes_expires_idx ON otp_codes (expires_at)`,

  `CREATE TABLE IF NOT EXISTS message_logs (
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
   )`,
  `CREATE INDEX IF NOT EXISTS message_logs_created_idx ON message_logs (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS message_logs_provider_message_id_idx ON message_logs (provider, provider_message_id)`,
  `CREATE INDEX IF NOT EXISTS message_logs_contact_request_idx ON message_logs (contact_request_id)`,

  `CREATE TABLE IF NOT EXISTS call_logs (
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
   )`,
  `CREATE INDEX IF NOT EXISTS call_logs_created_idx ON call_logs (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS call_logs_provider_call_id_idx ON call_logs (provider, provider_call_id)`,
  `CREATE INDEX IF NOT EXISTS call_logs_contact_request_idx ON call_logs (contact_request_id)`,
  `ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS recording_url text NULL`,

  `CREATE TABLE IF NOT EXISTS comms_rate_buckets (
     id           bigserial PRIMARY KEY,
     bucket_key   text NOT NULL,
     window_start timestamptz NOT NULL,
     count        integer NOT NULL DEFAULT 0,
     created_at   timestamptz NOT NULL DEFAULT now(),
     UNIQUE (bucket_key, window_start)
   )`,
  `CREATE INDEX IF NOT EXISTS comms_rate_buckets_window_idx ON comms_rate_buckets (window_start)`,

  `CREATE TABLE IF NOT EXISTS pending_disconnects (
     id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     provider          text NOT NULL,
     provider_call_id  text NOT NULL,
     scheduled_at      timestamptz NOT NULL,
     processed_at      timestamptz NULL,
     created_at        timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS pending_disconnects_scheduled_idx ON pending_disconnects (scheduled_at) WHERE processed_at IS NULL`,

  // The contact_requests table lives in Supabase (a separate Postgres
  // instance). Guard the ALTER so the migration is a no-op when the runtime
  // pool is pointed at a database that doesn't host that table.
  `DO $$
   BEGIN
     IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contact_requests') THEN
       EXECUTE 'ALTER TABLE contact_requests ADD COLUMN IF NOT EXISTS provider_metadata jsonb NOT NULL DEFAULT ''{}''::jsonb';
     END IF;
   END
   $$`,
];

let migrated = false;

export async function ensureCommsSchema(): Promise<void> {
  if (migrated) return;
  const p = getPool();
  for (const stmt of STATEMENTS) {
    try {
      await p.query(stmt);
    } catch (err) {
      logger.error({ err, stmt: stmt.slice(0, 80) }, "Comms migration statement failed");
      throw err;
    }
  }
  migrated = true;
  logger.info("Comms schema ensured");
}
