-- =============================================================================
-- RESUME-PILOT DATABASE MIGRATION PLAN
-- =============================================================================
-- Generated: 2026-01-23
--
-- This file documents the migration execution order and verifies all
-- prerequisites are satisfied before running new migrations.
-- =============================================================================

-- =============================================================================
-- MIGRATION INVENTORY
-- =============================================================================
--
-- File Name                           | Status    | Dependencies
-- ------------------------------------|-----------|---------------------------
-- 0001_initial_schema.sql             | BASE      | None (creates core tables)
-- 0002_token_usage_tracking.sql       | OPTIONAL  | profiles, jobs tables
-- 0002_subscription_schema.sql        | OPTIONAL  | update_updated_at_column()
-- 0002_application_tracking.sql       | OPTIONAL  | jobs table
-- 0005_add_onboarding_fields.sql      | OPTIONAL  | profiles table
-- 0006_create_resume_storage.sql      | OPTIONAL  | storage.buckets (Supabase)
-- 0007_add_usage_tracking.sql         | OPTIONAL  | update_updated_at_column()
-- 0008_add_resume_styles.sql          | OPTIONAL  | job_applications, profiles
-- 0009_add_learned_preferences.sql    | NEW       | profiles table
-- 0010_add_email_preferences.sql      | NEW       | profiles table
--
-- NOTE: Multiple migrations have prefix "0002_" which is a naming conflict.
--       Supabase runs migrations alphabetically, so actual order is:
--       0002_application_tracking.sql
--       0002_subscription_schema.sql
--       0002_token_usage_tracking.sql


-- =============================================================================
-- CORRECT EXECUTION ORDER
-- =============================================================================
--
-- Phase 1 - Core Schema (MUST run first):
--   1. 0001_initial_schema.sql
--      Creates: profiles, resumes, jobs, job_applications, search_history,
--               workflow_runs, update_updated_at_column(), handle_new_user()
--
-- Phase 2 - Extensions (can run in any order after Phase 1):
--   2a. 0002_application_tracking.sql (adds columns to jobs)
--   2b. 0002_subscription_schema.sql (creates subscription tables)
--   2c. 0002_token_usage_tracking.sql (creates token/budget tables)
--
-- Phase 3 - Profile Enhancements:
--   3a. 0005_add_onboarding_fields.sql (adds columns to profiles)
--   3b. 0008_add_resume_styles.sql (adds columns to job_applications, profiles)
--
-- Phase 4 - Storage:
--   4. 0006_create_resume_storage.sql (creates storage bucket)
--
-- Phase 5 - Usage Tracking V2:
--   5. 0007_add_usage_tracking.sql (creates alternate usage_tracking)
--      NOTE: This conflicts with 0002_subscription_schema.sql which also
--            creates usage_tracking table. See conflicts section below.
--
-- Phase 6 - NEW MIGRATIONS (Focus of this deployment):
--   6a. 0009_add_learned_preferences.sql (adds learned_preferences to profiles)
--   6b. 0010_add_email_preferences.sql (adds email_preferences to profiles)


-- =============================================================================
-- MIGRATION CONFLICTS DETECTED
-- =============================================================================

-- CONFLICT 1: usage_tracking table defined twice
-- - 0002_subscription_schema.sql defines usage_tracking with:
--     period_start, period_end (TIMESTAMPTZ)
--     generations_used, jobs_discovered, api_calls (INTEGER)
--
-- - 0007_add_usage_tracking.sql defines usage_tracking with:
--     week_start_date (DATE)
--     job_matches_count, resume_generations_count (INTEGER)
--     job_matches_limit, resume_generations_limit (INTEGER)
--
-- RESOLUTION: Both use IF NOT EXISTS, so whichever runs first wins.
--             The schema.ts file expects the 0002_subscription_schema.sql version.
--             0007_add_usage_tracking.sql should be skipped or removed.

-- CONFLICT 2: get_week_start function defined twice
-- - 0002_subscription_schema.sql: Takes TIMESTAMPTZ, returns TIMESTAMPTZ
-- - 0007_add_usage_tracking.sql: Takes DATE, returns DATE
--
-- RESOLUTION: CREATE OR REPLACE means last one wins.
--             0002_subscription_schema.sql version should be authoritative.

-- CONFLICT 3: increment_usage function defined twice
-- - 0002_subscription_schema.sql: Returns TABLE (success, new_count, limit_reached)
-- - 0007_add_usage_tracking.sql: Returns BOOLEAN
--
-- RESOLUTION: CREATE OR REPLACE means last one wins.
--             0002_subscription_schema.sql version should be authoritative.


-- =============================================================================
-- VERIFICATION: 0009_add_learned_preferences.sql
-- =============================================================================
-- Status: SAFE TO RUN
-- Prerequisites:
--   [x] profiles table exists (created in 0001)
--   [x] auth.users table exists (Supabase built-in)
--   [x] jobs table exists (created in 0001)
--   [x] jobs.user_feedback column exists (created in 0001)
--
-- Creates:
--   - profiles.learned_preferences column (JSONB)
--   - Index: idx_profiles_learned_preferences_active
--   - Index: idx_profiles_learned_preferences_updated
--   - Function: has_active_learning(UUID)
--   - Function: get_feedback_count(UUID)
--   - Function: get_learning_stats(UUID)
--   - Function: update_profile_timestamp_on_preferences()
--   - Trigger: trigger_update_profile_on_preferences
--
-- Safety Notes:
--   - Uses IF NOT EXISTS for indexes
--   - Uses CREATE OR REPLACE for functions
--   - Uses DROP TRIGGER IF EXISTS before CREATE TRIGGER
--   - Column uses ADD COLUMN IF NOT EXISTS


-- =============================================================================
-- VERIFICATION: 0010_add_email_preferences.sql
-- =============================================================================
-- Status: SAFE TO RUN
-- Prerequisites:
--   [x] profiles table exists (created in 0001)
--   [x] auth.users table exists (Supabase built-in)
--   [x] gen_random_uuid() exists (PostgreSQL built-in)
--
-- Creates:
--   - profiles.email_preferences column (JSONB with defaults)
--   - Index: idx_profiles_email_prefs_weekly
--   - Index: idx_profiles_email_prefs_job_matches
--   - Table: email_send_history
--   - Index: idx_email_history_user
--   - Index: idx_email_history_type
--   - Index: idx_email_history_status
--   - RLS policies for email_send_history
--
-- Safety Notes:
--   - Uses IF NOT EXISTS for table and indexes
--   - Column uses ADD COLUMN IF NOT EXISTS
--   - Safe default value for email_preferences


-- =============================================================================
-- PRE-MIGRATION VERIFICATION QUERIES
-- =============================================================================
-- Run these queries to verify prerequisites before executing migrations:

-- Check if profiles table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
) AS profiles_table_exists;

-- Check if jobs table exists and has required columns
SELECT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'jobs'
    AND column_name = 'user_feedback'
) AS jobs_user_feedback_exists;

-- Check if learned_preferences column already exists (idempotency check)
SELECT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'learned_preferences'
) AS learned_preferences_already_exists;

-- Check if email_preferences column already exists (idempotency check)
SELECT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'email_preferences'
) AS email_preferences_already_exists;

-- Check if email_send_history table already exists (idempotency check)
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'email_send_history'
) AS email_send_history_already_exists;


-- =============================================================================
-- EXECUTION COMMANDS
-- =============================================================================
--
-- Option A: Using Supabase CLI (Recommended)
-- ------------------------------------------
-- From project root:
--
--   # Apply all pending migrations
--   npx supabase db push
--
--   # Or apply specific migrations (if using migration files directly)
--   npx supabase migration up
--
--
-- Option B: Using Supabase Dashboard
-- ----------------------------------
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Run the migrations in order:
--    - First run 0009_add_learned_preferences.sql
--    - Then run 0010_add_email_preferences.sql
--
--
-- Option C: Direct psql (for local development)
-- ---------------------------------------------
--   psql $DATABASE_URL -f supabase/migrations/0009_add_learned_preferences.sql
--   psql $DATABASE_URL -f supabase/migrations/0010_add_email_preferences.sql


-- =============================================================================
-- POST-MIGRATION VERIFICATION
-- =============================================================================
-- Run these after migration to verify success:

-- Verify learned_preferences column
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name = 'learned_preferences';

-- Verify email_preferences column with default
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name = 'email_preferences';

-- Verify email_send_history table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'email_send_history'
ORDER BY ordinal_position;

-- Verify functions were created
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'has_active_learning',
    'get_feedback_count',
    'get_learning_stats',
    'update_profile_timestamp_on_preferences'
);

-- Verify indexes were created
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname IN (
    'idx_profiles_learned_preferences_active',
    'idx_profiles_learned_preferences_updated',
    'idx_profiles_email_prefs_weekly',
    'idx_profiles_email_prefs_job_matches',
    'idx_email_history_user',
    'idx_email_history_type',
    'idx_email_history_status'
);

-- Verify RLS is enabled on email_send_history
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'email_send_history';


-- =============================================================================
-- ROLLBACK COMMANDS (if needed)
-- =============================================================================
-- Use these to revert the migrations:

-- Rollback 0010_add_email_preferences.sql
/*
DROP TABLE IF EXISTS email_send_history;
DROP INDEX IF EXISTS idx_profiles_email_prefs_weekly;
DROP INDEX IF EXISTS idx_profiles_email_prefs_job_matches;
ALTER TABLE profiles DROP COLUMN IF EXISTS email_preferences;
*/

-- Rollback 0009_add_learned_preferences.sql
/*
DROP TRIGGER IF EXISTS trigger_update_profile_on_preferences ON profiles;
DROP FUNCTION IF EXISTS update_profile_timestamp_on_preferences();
DROP FUNCTION IF EXISTS get_learning_stats(UUID);
DROP FUNCTION IF EXISTS get_feedback_count(UUID);
DROP FUNCTION IF EXISTS has_active_learning(UUID);
DROP INDEX IF EXISTS idx_profiles_learned_preferences_updated;
DROP INDEX IF EXISTS idx_profiles_learned_preferences_active;
ALTER TABLE profiles DROP COLUMN IF EXISTS learned_preferences;
*/


-- =============================================================================
-- SUMMARY
-- =============================================================================
--
-- Migrations 0009 and 0010 are SAFE TO RUN:
--
-- [OK] All prerequisites satisfied
-- [OK] All operations are idempotent (IF NOT EXISTS / IF EXISTS)
-- [OK] No breaking changes to existing data
-- [OK] Backward compatible (columns have defaults or allow NULL)
-- [OK] RLS policies properly configured
-- [OK] Grants for authenticated/service_role included
--
-- Recommended execution:
--   1. Run pre-migration verification queries
--   2. Execute migrations via Supabase CLI: npx supabase db push
--   3. Run post-migration verification queries
--   4. Test application functionality
--
-- =============================================================================
