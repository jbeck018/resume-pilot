-- Add usage tracking table for free tier limits
CREATE TABLE IF NOT EXISTS usage_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Weekly tracking period (Monday of the week)
    week_start_date DATE NOT NULL,

    -- Usage counts
    job_matches_count INTEGER DEFAULT 0,
    resume_generations_count INTEGER DEFAULT 0,

    -- Limits (can be adjusted per user for different tiers)
    job_matches_limit INTEGER DEFAULT 5,
    resume_generations_limit INTEGER DEFAULT 5,

    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Ensure one record per user per week
    UNIQUE(user_id, week_start_date)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_week ON usage_tracking(user_id, week_start_date);

-- RLS policies
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage"
    ON usage_tracking FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage"
    ON usage_tracking FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage"
    ON usage_tracking FOR UPDATE
    USING (auth.uid() = user_id);

-- Function to get current week start (Monday)
CREATE OR REPLACE FUNCTION get_week_start(check_date DATE DEFAULT CURRENT_DATE)
RETURNS DATE AS $$
BEGIN
    RETURN check_date - ((EXTRACT(DOW FROM check_date)::INTEGER + 6) % 7);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to increment usage counter
CREATE OR REPLACE FUNCTION increment_usage(
    target_user_id UUID,
    usage_type VARCHAR(50)
)
RETURNS BOOLEAN AS $$
DECLARE
    current_week_start DATE;
    current_count INTEGER;
    current_limit INTEGER;
BEGIN
    current_week_start := get_week_start();

    -- Insert or get current week's usage record
    INSERT INTO usage_tracking (user_id, week_start_date)
    VALUES (target_user_id, current_week_start)
    ON CONFLICT (user_id, week_start_date) DO NOTHING;

    -- Get current count and limit
    IF usage_type = 'job_matches' THEN
        SELECT job_matches_count, job_matches_limit
        INTO current_count, current_limit
        FROM usage_tracking
        WHERE user_id = target_user_id AND week_start_date = current_week_start;

        -- Check if limit reached
        IF current_count >= current_limit THEN
            RETURN FALSE;
        END IF;

        -- Increment counter
        UPDATE usage_tracking
        SET job_matches_count = job_matches_count + 1,
            updated_at = NOW()
        WHERE user_id = target_user_id AND week_start_date = current_week_start;

    ELSIF usage_type = 'resume_generations' THEN
        SELECT resume_generations_count, resume_generations_limit
        INTO current_count, current_limit
        FROM usage_tracking
        WHERE user_id = target_user_id AND week_start_date = current_week_start;

        -- Check if limit reached
        IF current_count >= current_limit THEN
            RETURN FALSE;
        END IF;

        -- Increment counter
        UPDATE usage_tracking
        SET resume_generations_count = resume_generations_count + 1,
            updated_at = NOW()
        WHERE user_id = target_user_id AND week_start_date = current_week_start;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER update_usage_tracking_updated_at
    BEFORE UPDATE ON usage_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
