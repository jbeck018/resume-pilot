-- ============================================================================
-- Admin Roles System Enhancement Migration
-- Adds waitlist table, admin activity log, and additional helper functions
-- Note: User roles and invited_users table are already in 0012_invitations_and_roles.sql
-- ============================================================================

-- ============================================================================
-- Set root admin (in case not already set)
-- ============================================================================

UPDATE profiles SET role = 'root_admin' WHERE email = 'jacobbeck.dev@gmail.com' AND role != 'root_admin';

-- ============================================================================
-- Waitlist Table
-- For users who want to join but haven't been invited
-- ============================================================================

CREATE TABLE IF NOT EXISTS waitlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    source VARCHAR(100), -- 'pricing_page', 'landing_page', 'referral', etc.
    referral_code VARCHAR(100), -- If referred by someone
    priority INTEGER DEFAULT 0, -- Higher = more priority
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    notified_at TIMESTAMPTZ, -- When they were notified of invitation
    converted_at TIMESTAMPTZ -- When they signed up
);

-- Create indexes for waitlist
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_source ON waitlist(source);
CREATE INDEX IF NOT EXISTS idx_waitlist_priority ON waitlist(priority DESC);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at);

-- ============================================================================
-- Admin Activity Log
-- Track admin actions for audit purposes
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL,
    admin_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    -- e.g., 'invite_user', 'change_role', 'approve_waitlist', 'revoke_access'
    target_type VARCHAR(50), -- 'user', 'invitation', 'waitlist_entry'
    target_id UUID,
    target_email VARCHAR(255),
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for admin_activity_log
CREATE INDEX IF NOT EXISTS idx_admin_activity_admin_id ON admin_activity_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_action ON admin_activity_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created_at ON admin_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_target ON admin_activity_log(target_type, target_id);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Waitlist policies
-- Only admins can view/manage waitlist
CREATE POLICY "Admins can view waitlist"
    ON waitlist FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role IN ('admin', 'root_admin')
        )
    );

CREATE POLICY "Anyone can join waitlist"
    ON waitlist FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admins can update waitlist"
    ON waitlist FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role IN ('admin', 'root_admin')
        )
    );

CREATE POLICY "Admins can delete from waitlist"
    ON waitlist FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role IN ('admin', 'root_admin')
        )
    );

-- Admin activity log policies
-- Only root_admins can view the full activity log
CREATE POLICY "Root admins can view all activity"
    ON admin_activity_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'root_admin'
        )
    );

-- Admins can view their own activity
CREATE POLICY "Admins can view their own activity"
    ON admin_activity_log FOR SELECT
    USING (
        admin_id IN (
            SELECT id FROM profiles
            WHERE profiles.user_id = auth.uid()
        )
    );

-- ============================================================================
-- Service Role Policies (for server-side operations)
-- ============================================================================

CREATE POLICY "Service role can manage waitlist"
    ON waitlist FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage admin_activity_log"
    ON admin_activity_log FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- Additional Functions
-- ============================================================================

-- Function to get user role
CREATE OR REPLACE FUNCTION get_user_role(target_user_id UUID)
RETURNS VARCHAR(20)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role VARCHAR(20);
BEGIN
    SELECT role INTO v_role
    FROM profiles
    WHERE user_id = target_user_id;

    RETURN COALESCE(v_role, 'user');
END;
$$;

-- Function to check if an email is on waitlist
CREATE OR REPLACE FUNCTION is_on_waitlist(target_email VARCHAR)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM waitlist
        WHERE email = LOWER(target_email)
        AND converted_at IS NULL
    );
END;
$$;

-- Function to check if an email has a pending invitation
CREATE OR REPLACE FUNCTION is_email_invited(target_email VARCHAR)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM invited_users
        WHERE email = LOWER(target_email)
        AND status = 'pending'
        AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$;

-- Function to validate invitation token
CREATE OR REPLACE FUNCTION validate_invitation_token(target_token VARCHAR)
RETURNS TABLE (
    valid BOOLEAN,
    email VARCHAR,
    role VARCHAR,
    invited_by_name VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        CASE
            WHEN iu.id IS NOT NULL
                AND iu.status = 'pending'
                AND (iu.expires_at IS NULL OR iu.expires_at > NOW())
            THEN true
            ELSE false
        END AS valid,
        iu.email::VARCHAR,
        iu.role::VARCHAR,
        p.full_name AS invited_by_name
    FROM invited_users iu
    LEFT JOIN profiles p ON p.user_id = iu.invited_by
    WHERE iu.token = target_token;
END;
$$;

-- Function to convert waitlist entry to invitation
CREATE OR REPLACE FUNCTION convert_waitlist_to_invitation(
    waitlist_email VARCHAR,
    admin_user_id UUID,
    invitation_role VARCHAR DEFAULT 'user',
    invitation_token VARCHAR DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_token VARCHAR;
    v_invitation_id UUID;
    v_admin_email VARCHAR;
BEGIN
    -- Generate token if not provided
    v_token := COALESCE(invitation_token, encode(gen_random_bytes(32), 'hex'));

    -- Get admin email
    SELECT email INTO v_admin_email FROM profiles WHERE user_id = admin_user_id;

    -- Create invitation
    INSERT INTO invited_users (email, role, token, invited_by, invited_by_email, expires_at)
    VALUES (
        LOWER(waitlist_email),
        invitation_role,
        v_token,
        admin_user_id,
        v_admin_email,
        NOW() + INTERVAL '7 days'
    )
    RETURNING id INTO v_invitation_id;

    -- Mark waitlist entry as notified
    UPDATE waitlist
    SET notified_at = NOW()
    WHERE email = LOWER(waitlist_email);

    RETURN v_invitation_id;
END;
$$;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE waitlist IS 'Users who want to join but have not been invited yet';
COMMENT ON TABLE admin_activity_log IS 'Audit log for admin actions';
COMMENT ON COLUMN waitlist.source IS 'Where the user signed up from (pricing_page, landing_page, etc.)';
COMMENT ON COLUMN waitlist.priority IS 'Higher priority users get invited first';
COMMENT ON COLUMN admin_activity_log.action IS 'Type of admin action (invite_user, change_role, etc.)';
COMMENT ON COLUMN admin_activity_log.target_type IS 'Type of target (user, invitation, waitlist_entry)';
