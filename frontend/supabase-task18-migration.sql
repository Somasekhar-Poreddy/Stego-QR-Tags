-- Task #18: User Activity Logging
-- Run this once in the Supabase SQL editor

CREATE TABLE IF NOT EXISTS user_activity_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  metadata    JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_ual_user_id    ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ual_created_at ON user_activity_logs(created_at DESC);

ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own activity"
  ON user_activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated can read all"
  ON user_activity_logs FOR SELECT
  USING (auth.role() = 'authenticated');
