-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================================
-- Tables
-- ============================================================================

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,

    -- Basic info
    full_name VARCHAR(255),
    headline VARCHAR(500),
    summary TEXT,
    location VARCHAR(255),

    -- External profiles
    linkedin_url VARCHAR(500),
    github_handle VARCHAR(100),

    -- Parsed profile data
    skills JSONB DEFAULT '[]'::jsonb,
    experience JSONB DEFAULT '[]'::jsonb,
    education JSONB DEFAULT '[]'::jsonb,

    -- Job preferences
    preferred_roles JSONB DEFAULT '[]'::jsonb,
    preferred_locations JSONB DEFAULT '[]'::jsonb,
    remote_preference VARCHAR(50) DEFAULT 'hybrid',
    min_salary INTEGER,
    max_salary INTEGER,

    -- Profile embedding for job matching
    embedding vector(1536),

    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Resumes table
CREATE TABLE IF NOT EXISTS resumes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL DEFAULT 'My Resume',
    is_default BOOLEAN DEFAULT FALSE,

    original_file_url VARCHAR(1000),
    original_file_name VARCHAR(255),
    original_file_type VARCHAR(50),

    parsed_content TEXT,
    structured_data JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Job identification
    external_id VARCHAR(500),
    source VARCHAR(100) NOT NULL,
    source_url VARCHAR(1000) NOT NULL,

    -- Job details
    title VARCHAR(500) NOT NULL,
    company VARCHAR(255) NOT NULL,
    company_logo VARCHAR(1000),
    location VARCHAR(255),
    is_remote BOOLEAN DEFAULT FALSE,

    -- Job content
    description TEXT,
    requirements JSONB,
    benefits JSONB,
    salary_min INTEGER,
    salary_max INTEGER,
    salary_currency VARCHAR(10) DEFAULT 'USD',

    -- Job metadata
    employment_type VARCHAR(50),
    experience_level VARCHAR(50),

    -- Matching
    match_score INTEGER,
    match_reasons JSONB,
    embedding vector(1536),

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    user_feedback VARCHAR(50),
    feedback_reason TEXT,

    -- Timestamps
    posted_at TIMESTAMPTZ,
    discovered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Job applications table
CREATE TABLE IF NOT EXISTS job_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,

    tailored_resume TEXT,
    tailored_resume_url VARCHAR(1000),
    cover_letter TEXT,

    generation_model VARCHAR(100),
    generation_prompt TEXT,
    generation_cost INTEGER,

    status VARCHAR(50) NOT NULL DEFAULT 'generating',
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Search history table
CREATE TABLE IF NOT EXISTS search_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    query TEXT,
    filters JSONB,
    source VARCHAR(100) NOT NULL,

    jobs_found INTEGER DEFAULT 0,
    jobs_new INTEGER DEFAULT 0,
    jobs_matched INTEGER DEFAULT 0,

    executed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    duration_ms INTEGER
);

-- Workflow runs table
CREATE TABLE IF NOT EXISTS workflow_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    workflow_type VARCHAR(100) NOT NULL,
    inngest_run_id VARCHAR(255),

    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    result JSONB,
    error_message TEXT,

    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_profile_id ON resumes(profile_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_source_external_id ON jobs(source, external_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_user_id ON job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_job_id ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_user_id ON workflow_runs(user_id);

-- Vector indexes for similarity search
CREATE INDEX IF NOT EXISTS idx_profiles_embedding ON profiles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_jobs_embedding ON jobs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile"
    ON profiles FOR DELETE
    USING (auth.uid() = user_id);

-- Resumes policies
CREATE POLICY "Users can view their own resumes"
    ON resumes FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own resumes"
    ON resumes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own resumes"
    ON resumes FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own resumes"
    ON resumes FOR DELETE
    USING (auth.uid() = user_id);

-- Jobs policies
CREATE POLICY "Users can view their own jobs"
    ON jobs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own jobs"
    ON jobs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs"
    ON jobs FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own jobs"
    ON jobs FOR DELETE
    USING (auth.uid() = user_id);

-- Job applications policies
CREATE POLICY "Users can view their own job applications"
    ON job_applications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own job applications"
    ON job_applications FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own job applications"
    ON job_applications FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own job applications"
    ON job_applications FOR DELETE
    USING (auth.uid() = user_id);

-- Search history policies
CREATE POLICY "Users can view their own search history"
    ON search_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own search history"
    ON search_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Workflow runs policies
CREATE POLICY "Users can view their own workflow runs"
    ON workflow_runs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workflow runs"
    ON workflow_runs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workflow runs"
    ON workflow_runs FOR UPDATE
    USING (auth.uid() = user_id);

-- ============================================================================
-- Functions
-- ============================================================================

-- Function to match jobs by embedding similarity
CREATE OR REPLACE FUNCTION match_jobs(
    query_embedding vector(1536),
    match_threshold float,
    match_count int,
    target_user_id uuid
)
RETURNS TABLE (
    id uuid,
    title varchar,
    company varchar,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        jobs.id,
        jobs.title,
        jobs.company,
        1 - (jobs.embedding <=> query_embedding) as similarity
    FROM jobs
    WHERE jobs.user_id = target_user_id
        AND jobs.embedding IS NOT NULL
        AND 1 - (jobs.embedding <=> query_embedding) > match_threshold
    ORDER BY jobs.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resumes_updated_at
    BEFORE UPDATE ON resumes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_applications_updated_at
    BEFORE UPDATE ON job_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Auto-create profile on user signup
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();
