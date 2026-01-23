-- Add onboarding-related fields to profiles table

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ideal_job_description TEXT,
ADD COLUMN IF NOT EXISTS portfolio_urls JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN profiles.onboarding_completed IS 'Whether the user has completed the initial onboarding flow';
COMMENT ON COLUMN profiles.ideal_job_description IS 'User''s description of their ideal job';
COMMENT ON COLUMN profiles.portfolio_urls IS 'Array of portfolio URLs (Dribbble, Behance, personal site, etc.)';
