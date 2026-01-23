-- Migration: Add email notification preferences to profiles
-- This adds a JSONB column to store user email notification preferences

-- Add email_preferences column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS email_preferences JSONB DEFAULT '{
  "jobMatches": true,
  "resumeReady": true,
  "weeklySummary": true,
  "applicationUpdates": true,
  "marketingEmails": false
}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN profiles.email_preferences IS 'User email notification preferences: jobMatches, resumeReady, weeklySummary, applicationUpdates, marketingEmails';

-- Create index for querying users by email preferences (for batch operations)
CREATE INDEX IF NOT EXISTS idx_profiles_email_prefs_weekly
ON profiles ((email_preferences->>'weeklySummary'))
WHERE (email_preferences->>'weeklySummary')::boolean = true;

CREATE INDEX IF NOT EXISTS idx_profiles_email_prefs_job_matches
ON profiles ((email_preferences->>'jobMatches'))
WHERE (email_preferences->>'jobMatches')::boolean = true;

-- Create table for email send history (for tracking and debugging)
CREATE TABLE IF NOT EXISTS email_send_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type VARCHAR(50) NOT NULL, -- welcome, job_matches, resume_ready, weekly_summary, application_status
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  message_id VARCHAR(255), -- Resend message ID
  status VARCHAR(20) NOT NULL DEFAULT 'sent', -- sent, failed, bounced
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for querying email history
CREATE INDEX IF NOT EXISTS idx_email_history_user ON email_send_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_history_type ON email_send_history(email_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_history_status ON email_send_history(status) WHERE status = 'failed';

-- Add RLS policies for email_send_history
ALTER TABLE email_send_history ENABLE ROW LEVEL SECURITY;

-- Users can only view their own email history
CREATE POLICY "Users can view own email history"
  ON email_send_history FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert email history (backend operations)
CREATE POLICY "Service role can insert email history"
  ON email_send_history FOR INSERT
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON email_send_history TO authenticated;
GRANT INSERT ON email_send_history TO service_role;
GRANT ALL ON email_send_history TO postgres;
