-- Experience discovery sessions for interactive experience gathering (V2 system)
CREATE TABLE IF NOT EXISTS experience_discovery_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Associated job postings
    job_ids JSONB NOT NULL,

    -- Session status
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- pending, in_progress, completed, abandoned

    -- Generated questions
    questions JSONB NOT NULL,

    -- User responses
    responses JSONB DEFAULT '[]'::jsonb,

    -- Extracted experiences
    discovered_experiences JSONB DEFAULT '[]'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMPTZ
);

-- Indexes for efficient querying
CREATE INDEX idx_discovery_sessions_user_id ON experience_discovery_sessions(user_id);
CREATE INDEX idx_discovery_sessions_status ON experience_discovery_sessions(status);
CREATE INDEX idx_discovery_sessions_created_at ON experience_discovery_sessions(created_at DESC);

-- RLS policies
ALTER TABLE experience_discovery_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own discovery sessions"
    ON experience_discovery_sessions FOR SELECT
    USING (auth.uid() IN (SELECT user_id FROM profiles WHERE id = experience_discovery_sessions.user_id));

CREATE POLICY "Users can insert their own discovery sessions"
    ON experience_discovery_sessions FOR INSERT
    WITH CHECK (auth.uid() IN (SELECT user_id FROM profiles WHERE id = experience_discovery_sessions.user_id));

CREATE POLICY "Users can update their own discovery sessions"
    ON experience_discovery_sessions FOR UPDATE
    USING (auth.uid() IN (SELECT user_id FROM profiles WHERE id = experience_discovery_sessions.user_id));

CREATE POLICY "Users can delete their own discovery sessions"
    ON experience_discovery_sessions FOR DELETE
    USING (auth.uid() IN (SELECT user_id FROM profiles WHERE id = experience_discovery_sessions.user_id));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_experience_discovery_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_experience_discovery_updated_at
    BEFORE UPDATE ON experience_discovery_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_experience_discovery_updated_at();
