-- Add application tracking fields to jobs table
-- These fields support the application tracking dashboard

-- Add interview and offer date fields
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS interview_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS offer_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add ATS score and keyword tracking (for ATS score display)
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS ats_score INTEGER,
ADD COLUMN IF NOT EXISTS keywords_matched JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS keywords_missing JSONB DEFAULT '[]';

-- Add skills gap analysis fields
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS matched_skills JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS missing_required_skills JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS missing_preferred_skills JSONB DEFAULT '[]';

-- Add match score breakdown for detailed analysis
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS match_score_breakdown JSONB;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_interview_date ON jobs(interview_date) WHERE interview_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_offer_date ON jobs(offer_date) WHERE offer_date IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN jobs.interview_date IS 'Date when interview is scheduled';
COMMENT ON COLUMN jobs.offer_date IS 'Date when offer was received';
COMMENT ON COLUMN jobs.rejection_date IS 'Date when application was rejected';
COMMENT ON COLUMN jobs.notes IS 'User notes about this application';
COMMENT ON COLUMN jobs.ats_score IS 'ATS compatibility score (0-100)';
COMMENT ON COLUMN jobs.keywords_matched IS 'Keywords from job description that match user profile';
COMMENT ON COLUMN jobs.keywords_missing IS 'Important keywords missing from user profile';
COMMENT ON COLUMN jobs.matched_skills IS 'Skills that match job requirements';
COMMENT ON COLUMN jobs.missing_required_skills IS 'Required skills the user does not have';
COMMENT ON COLUMN jobs.missing_preferred_skills IS 'Preferred skills the user does not have';
COMMENT ON COLUMN jobs.match_score_breakdown IS 'Breakdown of match score by category (skills, experience, education)';
