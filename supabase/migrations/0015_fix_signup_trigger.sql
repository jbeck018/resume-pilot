-- Migration: Fix user signup database issues
-- This migration:
-- 1. Adds service role RLS policy to profiles table
-- 2. Ensures the free subscription tier exists
-- 3. Updates handle_new_user() trigger function to current version

-- ============================================================================
-- Add service role policy to profiles
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'profiles'
        AND policyname = 'Service role can manage profiles'
    ) THEN
        CREATE POLICY "Service role can manage profiles"
            ON profiles FOR ALL
            USING (auth.jwt() ->> 'role' = 'service_role');
    END IF;
END $$;

-- ============================================================================
-- Ensure free tier exists (only if subscription_tiers table exists)
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription_tiers') THEN
        INSERT INTO subscription_tiers (name, display_name, price_monthly, price_yearly, generation_limit_weekly, features, is_active)
        VALUES (
            'free',
            'Free',
            0,
            0,
            5,
            '{
                "resume_styles": ["basic"],
                "api_access": false,
                "white_label": false,
                "priority_support": false,
                "custom_branding": false,
                "advanced_analytics": false,
                "cover_letter": true,
                "job_matching": true,
                "ats_optimization": true
            }'::jsonb,
            true
        )
        ON CONFLICT (name) DO NOTHING;
    END IF;
END $$;

-- ============================================================================
-- Update handle_new_user trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    invited_role VARCHAR(20);
    invitation_id UUID;
BEGIN
    -- Check if there's a pending invitation for this email
    SELECT role, id INTO invited_role, invitation_id
    FROM public.invited_users
    WHERE email = NEW.email
    AND status = 'pending'
    AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;

    -- Create profile with role from invitation or default to 'user'
    INSERT INTO public.profiles (user_id, email, role)
    VALUES (NEW.id, NEW.email, COALESCE(invited_role, 'user'));

    -- If there was an invitation, mark it as accepted
    IF invitation_id IS NOT NULL THEN
        UPDATE public.invited_users
        SET status = 'accepted',
            accepted_at = NOW(),
            accepted_by = NEW.id,
            updated_at = NOW()
        WHERE id = invitation_id;
    END IF;

    RETURN NEW;
END;
$$;
