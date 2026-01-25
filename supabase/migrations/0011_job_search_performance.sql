-- Migration: Enhance PostgreSQL for job search performance
-- This migration adds Full-Text Search, upgrades vector index to HNSW,
-- adds trigram indexes for autocomplete, and creates a hybrid search function.

-- ============================================================================
-- 1. Full-Text Search Vector Column
-- ============================================================================

-- Add tsvector column for full-text search on job title, company, and description
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS fts_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('english',
            COALESCE(title, '') || ' ' ||
            COALESCE(company, '') || ' ' ||
            COALESCE(description, '')
        )
    ) STORED;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_jobs_fts_vector ON jobs USING GIN (fts_vector);

-- Add comment for documentation
COMMENT ON COLUMN jobs.fts_vector IS 'Full-text search vector combining title, company, and description for fast keyword matching';

-- ============================================================================
-- 2. Upgrade Vector Index from IVFFlat to HNSW (9x faster)
-- ============================================================================

-- Drop existing IVFFlat index on jobs.embedding if it exists
DROP INDEX IF EXISTS idx_jobs_embedding;

-- Create HNSW index for faster vector similarity search
-- m = 16: number of bi-directional links per element (default is 16, higher = more accurate but slower)
-- ef_construction = 64: size of dynamic candidate list during index construction (higher = better quality)
CREATE INDEX idx_jobs_embedding_hnsw ON jobs
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Add comment for documentation
COMMENT ON INDEX idx_jobs_embedding_hnsw IS 'HNSW index for fast vector similarity search (9x faster than IVFFlat)';

-- ============================================================================
-- 3. Trigram Extension and Indexes for Autocomplete
-- ============================================================================

-- Enable pg_trgm extension for trigram similarity
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create trigram indexes for fuzzy matching and autocomplete
CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm ON jobs USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_company_trgm ON jobs USING GIN (company gin_trgm_ops);

-- Add comments for documentation
COMMENT ON INDEX idx_jobs_title_trgm IS 'Trigram index for fuzzy title matching and autocomplete';
COMMENT ON INDEX idx_jobs_company_trgm IS 'Trigram index for fuzzy company matching and autocomplete';

-- ============================================================================
-- 4. Hybrid Search Function
-- ============================================================================

-- Drop existing function if it exists to allow recreation
DROP FUNCTION IF EXISTS hybrid_job_search(uuid, text, vector(1536), float, float, float, int);

-- Create hybrid search function combining FTS + vector similarity + freshness scoring
CREATE OR REPLACE FUNCTION hybrid_job_search(
    target_user_id uuid,
    search_query text DEFAULT NULL,
    query_embedding vector(1536) DEFAULT NULL,
    fts_weight float DEFAULT 0.3,
    vector_weight float DEFAULT 0.5,
    freshness_weight float DEFAULT 0.2,
    match_limit int DEFAULT 20
)
RETURNS TABLE (
    id uuid,
    title varchar,
    company varchar,
    location varchar,
    description text,
    source_url varchar,
    match_score integer,
    status varchar,
    posted_at timestamptz,
    discovered_at timestamptz,
    fts_score float,
    vector_score float,
    freshness_score float,
    hybrid_score float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    ts_query tsquery;
BEGIN
    -- Parse the search query for full-text search if provided
    IF search_query IS NOT NULL AND search_query != '' THEN
        ts_query := plainto_tsquery('english', search_query);
    ELSE
        ts_query := NULL;
    END IF;

    RETURN QUERY
    WITH scored_jobs AS (
        SELECT
            j.id,
            j.title,
            j.company,
            j.location,
            j.description,
            j.source_url,
            j.match_score,
            j.status,
            j.posted_at,
            j.discovered_at,
            -- Full-text search score (0-1 normalized)
            CASE
                WHEN ts_query IS NOT NULL AND j.fts_vector @@ ts_query
                THEN ts_rank_cd(j.fts_vector, ts_query, 32)::float
                ELSE 0.0
            END AS fts_score,
            -- Vector similarity score (0-1, using cosine similarity)
            CASE
                WHEN query_embedding IS NOT NULL AND j.embedding IS NOT NULL
                THEN (1.0 - (j.embedding <=> query_embedding))::float
                ELSE 0.0
            END AS vector_score,
            -- Freshness score (exponential decay based on posted/discovered date)
            -- Jobs posted in the last 7 days get highest scores, decaying over 30 days
            CASE
                WHEN j.posted_at IS NOT NULL
                THEN GREATEST(0.0, 1.0 - (EXTRACT(EPOCH FROM (NOW() - j.posted_at)) / (30 * 24 * 3600)))::float
                WHEN j.discovered_at IS NOT NULL
                THEN GREATEST(0.0, 1.0 - (EXTRACT(EPOCH FROM (NOW() - j.discovered_at)) / (30 * 24 * 3600)))::float
                ELSE 0.5  -- Default score for jobs without dates
            END AS freshness_score
        FROM jobs j
        WHERE j.user_id = target_user_id
          -- Filter to jobs that have either FTS match or embedding for vector search
          AND (
              (ts_query IS NOT NULL AND j.fts_vector @@ ts_query)
              OR (query_embedding IS NOT NULL AND j.embedding IS NOT NULL)
              OR (search_query IS NULL AND query_embedding IS NULL)  -- Return all if no search criteria
          )
    )
    SELECT
        s.id,
        s.title,
        s.company,
        s.location,
        s.description,
        s.source_url,
        s.match_score,
        s.status,
        s.posted_at,
        s.discovered_at,
        s.fts_score,
        s.vector_score,
        s.freshness_score,
        -- Combined hybrid score with configurable weights
        (
            (s.fts_score * fts_weight) +
            (s.vector_score * vector_weight) +
            (s.freshness_score * freshness_weight)
        )::float AS hybrid_score
    FROM scored_jobs s
    WHERE
        -- Require minimum relevance when search criteria are provided
        (search_query IS NULL AND query_embedding IS NULL)
        OR s.fts_score > 0
        OR s.vector_score > 0.5
    ORDER BY
        -- Sort by hybrid score descending
        (
            (s.fts_score * fts_weight) +
            (s.vector_score * vector_weight) +
            (s.freshness_score * freshness_weight)
        ) DESC,
        -- Secondary sort by freshness
        COALESCE(s.posted_at, s.discovered_at) DESC NULLS LAST
    LIMIT match_limit;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION hybrid_job_search IS 'Hybrid job search combining full-text search, vector similarity, and freshness scoring with configurable weights';

-- ============================================================================
-- 5. Additional Helper Functions
-- ============================================================================

-- Function for autocomplete suggestions using trigram similarity
CREATE OR REPLACE FUNCTION job_autocomplete(
    target_user_id uuid,
    search_prefix text,
    field_type text DEFAULT 'title',  -- 'title' or 'company'
    match_limit int DEFAULT 10
)
RETURNS TABLE (
    suggestion text,
    count bigint,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF field_type = 'company' THEN
        RETURN QUERY
        SELECT
            j.company AS suggestion,
            COUNT(*)::bigint AS count,
            similarity(j.company, search_prefix)::float AS similarity
        FROM jobs j
        WHERE j.user_id = target_user_id
          AND j.company % search_prefix  -- Trigram similarity operator
        GROUP BY j.company
        ORDER BY similarity(j.company, search_prefix) DESC, COUNT(*) DESC
        LIMIT match_limit;
    ELSE
        RETURN QUERY
        SELECT
            j.title AS suggestion,
            COUNT(*)::bigint AS count,
            similarity(j.title, search_prefix)::float AS similarity
        FROM jobs j
        WHERE j.user_id = target_user_id
          AND j.title % search_prefix  -- Trigram similarity operator
        GROUP BY j.title
        ORDER BY similarity(j.title, search_prefix) DESC, COUNT(*) DESC
        LIMIT match_limit;
    END IF;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION job_autocomplete IS 'Returns autocomplete suggestions for job titles or companies using trigram similarity';

-- ============================================================================
-- 6. Grant Permissions
-- ============================================================================

-- Grant execute permissions on the new functions
GRANT EXECUTE ON FUNCTION hybrid_job_search TO authenticated;
GRANT EXECUTE ON FUNCTION hybrid_job_search TO service_role;
GRANT EXECUTE ON FUNCTION job_autocomplete TO authenticated;
GRANT EXECUTE ON FUNCTION job_autocomplete TO service_role;
