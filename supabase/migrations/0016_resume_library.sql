-- Resume library for storing successful resumes (V2 system)
CREATE TABLE IF NOT EXISTS resume_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,

    -- Resume content
    resume_content TEXT NOT NULL,
    resume_hash VARCHAR(64) NOT NULL,

    -- Scoring metrics
    match_score INTEGER NOT NULL,
    ats_score INTEGER NOT NULL,
    confidence_score JSONB NOT NULL,

    -- Analysis results
    matched_requirements JSONB NOT NULL,
    gaps JSONB,
    reframing_strategies JSONB,

    -- Outcome tracking
    outcome JSONB,

    -- Job metadata (denormalized for search)
    job_title VARCHAR(500),
    company VARCHAR(255),
    industry VARCHAR(100),

    -- Vector embedding for similarity search
    embedding vector(1536),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX idx_resume_library_user_id ON resume_library(user_id);
CREATE INDEX idx_resume_library_hash ON resume_library(resume_hash);
CREATE INDEX idx_resume_library_scores ON resume_library(match_score, ats_score);
CREATE INDEX idx_resume_library_job_id ON resume_library(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX idx_resume_library_created_at ON resume_library(created_at DESC);

-- RLS policies
ALTER TABLE resume_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own resume library"
    ON resume_library FOR SELECT
    USING (auth.uid() IN (SELECT user_id FROM profiles WHERE id = resume_library.user_id));

CREATE POLICY "Users can insert into their own resume library"
    ON resume_library FOR INSERT
    WITH CHECK (auth.uid() IN (SELECT user_id FROM profiles WHERE id = resume_library.user_id));

CREATE POLICY "Users can update their own resume library"
    ON resume_library FOR UPDATE
    USING (auth.uid() IN (SELECT user_id FROM profiles WHERE id = resume_library.user_id));

CREATE POLICY "Users can delete from their own resume library"
    ON resume_library FOR DELETE
    USING (auth.uid() IN (SELECT user_id FROM profiles WHERE id = resume_library.user_id));
