-- Migration: Add waitlist table for pricing launch notifications
-- Created: 2025-01-25

-- ============================================================================
-- Waitlist Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    source VARCHAR(100) NOT NULL DEFAULT 'pricing', -- pricing, homepage, etc.
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Optional link to user
    metadata JSONB DEFAULT '{}',
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notified_at TIMESTAMPTZ, -- When pricing launched email was sent
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Unique constraint on email + source for upsert support
    UNIQUE(email, source)
);

-- Index for querying unnotified subscribers
CREATE INDEX IF NOT EXISTS waitlist_notified_idx ON waitlist(notified_at) WHERE notified_at IS NULL;

-- Index for lookups by source
CREATE INDEX IF NOT EXISTS waitlist_source_idx ON waitlist(source);

-- RLS Policies
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (for public signup)
CREATE POLICY "Anyone can join waitlist" ON waitlist
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Only service role can read/update (for notifications)
CREATE POLICY "Service role can manage waitlist" ON waitlist
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
