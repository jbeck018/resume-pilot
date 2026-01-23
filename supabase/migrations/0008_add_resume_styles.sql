-- Migration: Add resume_style field to job_applications
-- This allows tracking which style was used for each generated resume

-- Add resume_style column to job_applications table
ALTER TABLE job_applications
ADD COLUMN IF NOT EXISTS resume_style VARCHAR(50) DEFAULT 'classic';

-- Add resume_style_name column for human-readable name
ALTER TABLE job_applications
ADD COLUMN IF NOT EXISTS resume_style_name VARCHAR(100);

-- Add preferred_resume_style to profiles for user's default preference
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS preferred_resume_style VARCHAR(50) DEFAULT 'classic';

-- Create index for querying by style (useful for analytics)
CREATE INDEX IF NOT EXISTS idx_job_applications_resume_style
ON job_applications(resume_style);

-- Comment on columns for documentation
COMMENT ON COLUMN job_applications.resume_style IS 'Resume style ID used for generation (classic, modern, creative, executive, technical, academic, federal, entry-level)';
COMMENT ON COLUMN job_applications.resume_style_name IS 'Human-readable name of the resume style used';
COMMENT ON COLUMN profiles.preferred_resume_style IS 'User''s preferred default resume style';
