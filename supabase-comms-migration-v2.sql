-- Comms migration v2: surface plaintext phones + IVR vehicle digits + recording URL
-- so QR owners can see a useful "Activity" feed in the app and admins can
-- drill into a specific user.
--
-- Apply to the comms Postgres database (see COMMS_DATABASE_URL).

-- call_logs additions ---------------------------------------------------------
ALTER TABLE call_logs    ADD COLUMN IF NOT EXISTS caller_phone     text NULL;
ALTER TABLE call_logs    ADD COLUMN IF NOT EXISTS callee_phone     text NULL;
ALTER TABLE call_logs    ADD COLUMN IF NOT EXISTS recording_url    text NULL;
ALTER TABLE call_logs    ADD COLUMN IF NOT EXISTS vehicle_last4    text NULL;

-- message_logs additions ------------------------------------------------------
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS recipient_phone  text NULL;

-- Indexes for owner / admin per-QR queries ------------------------------------
CREATE INDEX IF NOT EXISTS call_logs_qr_created_idx    ON call_logs    (qr_id, created_at DESC);
CREATE INDEX IF NOT EXISTS message_logs_qr_created_idx ON message_logs (qr_id, created_at DESC);
