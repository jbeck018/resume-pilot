-- Migration: Add user roles and invitation system
-- This migration adds:
-- 1. Role field to profiles table
-- 2. invited_users table for tracking invitations

-- ============================================================================
-- Add role to profiles table
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';

-- Create index for role queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ============================================================================
-- Invited Users table
-- ============================================================================

CREATE TABLE IF NOT EXISTS invited_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Invitation details
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    token VARCHAR(255) NOT NULL UNIQUE,

    -- Inviter info
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invited_by_email VARCHAR(255),

    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- pending, accepted, revoked, expired

    -- Timestamps
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invited_users_email ON invited_users(email);
CREATE INDEX IF NOT EXISTS idx_invited_users_token ON invited_users(token);
CREATE INDEX IF NOT EXISTS idx_invited_users_status ON invited_users(status);
CREATE INDEX IF NOT EXISTS idx_invited_users_invited_by ON invited_users(invited_by);

-- ============================================================================
-- Row Level Security for invited_users
-- ============================================================================

ALTER TABLE invited_users ENABLE ROW LEVEL SECURITY;

-- Only admins can view invitations
CREATE POLICY "Admins can view invitations"
    ON invited_users FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role IN ('admin', 'root_admin')
        )
    );

-- Only root admin can insert invitations for admin role
-- Regular admins can only invite users
CREATE POLICY "Admins can insert invitations"
    ON invited_users FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND (
                -- Root admin can invite anyone
                profiles.role = 'root_admin'
                OR
                -- Regular admin can only invite users (not admins)
                (profiles.role = 'admin' AND invited_users.role = 'user')
            )
        )
    );

-- Admins can update invitations (revoke, etc.)
CREATE POLICY "Admins can update invitations"
    ON invited_users FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role IN ('admin', 'root_admin')
        )
    );

-- Anyone can read their own invitation by token (for acceptance flow)
CREATE POLICY "Anyone can read invitation by token"
    ON invited_users FOR SELECT
    USING (true);

-- ============================================================================
-- Updated at trigger for invited_users
-- ============================================================================

CREATE TRIGGER update_invited_users_updated_at
    BEFORE UPDATE ON invited_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Function to check if user is root admin
-- ============================================================================

CREATE OR REPLACE FUNCTION is_root_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = is_root_admin.user_id
        AND profiles.role = 'root_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function to check if user is any admin
-- ============================================================================

CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = is_admin.user_id
        AND profiles.role IN ('admin', 'root_admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Modify handle_new_user to check for invitations
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    invited_role VARCHAR(20);
    invitation_id UUID;
BEGIN
    -- Check if there's a pending invitation for this email
    SELECT role, id INTO invited_role, invitation_id
    FROM invited_users
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
        UPDATE invited_users
        SET status = 'accepted',
            accepted_at = NOW(),
            accepted_by = NEW.id,
            updated_at = NOW()
        WHERE id = invitation_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Set root admin for the initial admin user
-- (This should be run manually or updated with your email)
-- ============================================================================

-- Update the root admin (uncomment and run manually with correct email)
-- UPDATE profiles SET role = 'root_admin' WHERE email = 'jacobbeck.dev@gmail.com';
