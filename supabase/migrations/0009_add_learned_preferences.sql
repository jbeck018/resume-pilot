-- Migration: Add learned_preferences column to profiles table
-- This column stores the AI-learned user preferences computed from job feedback

-- Add the learned_preferences JSONB column to store computed preference weights
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS learned_preferences JSONB DEFAULT NULL;

-- Add a comment explaining the column structure
COMMENT ON COLUMN profiles.learned_preferences IS 'AI-learned preferences computed from user job feedback. Structure includes preference weights for companies, skills, job types, locations, salary, and title keywords. Updated automatically when users provide feedback on job matches.';

-- Create an index for efficient queries on the isActive field within the JSONB
-- This allows quick filtering of users who have active learning enabled
CREATE INDEX IF NOT EXISTS idx_profiles_learned_preferences_active
ON profiles ((learned_preferences->>'isActive'))
WHERE learned_preferences IS NOT NULL;

-- Create an index for the lastUpdated field to find stale preferences
CREATE INDEX IF NOT EXISTS idx_profiles_learned_preferences_updated
ON profiles ((learned_preferences->>'lastUpdated'))
WHERE learned_preferences IS NOT NULL;

-- Create a function to check if a user has active learning
CREATE OR REPLACE FUNCTION has_active_learning(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = target_user_id
    AND learned_preferences IS NOT NULL
    AND (learned_preferences->>'isActive')::boolean = true
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Create a function to get the feedback count for a user
CREATE OR REPLACE FUNCTION get_feedback_count(target_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  count_val INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO count_val
  FROM jobs
  WHERE user_id = target_user_id
  AND user_feedback IS NOT NULL;

  RETURN COALESCE(count_val, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Create a function to get learning statistics for a user
CREATE OR REPLACE FUNCTION get_learning_stats(target_user_id UUID)
RETURNS TABLE (
  is_active BOOLEAN,
  feedback_count INTEGER,
  positive_count INTEGER,
  negative_count INTEGER,
  last_updated TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((p.learned_preferences->>'isActive')::boolean, false) AS is_active,
    COALESCE((p.learned_preferences->'feedbackCount'->>'total')::integer, 0) AS feedback_count,
    COALESCE((p.learned_preferences->'feedbackCount'->>'positive')::integer, 0) AS positive_count,
    COALESCE((p.learned_preferences->'feedbackCount'->>'negative')::integer, 0) AS negative_count,
    CASE
      WHEN p.learned_preferences->>'lastUpdated' IS NOT NULL
      THEN (p.learned_preferences->>'lastUpdated')::timestamptz
      ELSE NULL
    END AS last_updated
  FROM profiles p
  WHERE p.user_id = target_user_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create a trigger to update the updated_at timestamp when learned_preferences changes
CREATE OR REPLACE FUNCTION update_profile_timestamp_on_preferences()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.learned_preferences IS DISTINCT FROM NEW.learned_preferences THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists, then recreate it
DROP TRIGGER IF EXISTS trigger_update_profile_on_preferences ON profiles;

CREATE TRIGGER trigger_update_profile_on_preferences
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_profile_timestamp_on_preferences();

-- Grant appropriate permissions
GRANT EXECUTE ON FUNCTION has_active_learning(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_feedback_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_learning_stats(UUID) TO authenticated;
