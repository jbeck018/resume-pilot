-- ============================================================================
-- Subscription & Usage Tracking Schema for Freemium System
-- ============================================================================

-- ============================================================================
-- Subscription Tiers
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Tier identification
    name VARCHAR(50) NOT NULL UNIQUE, -- free, pro, premium
    display_name VARCHAR(100) NOT NULL, -- Free, Pro, Premium
    description TEXT,

    -- Pricing (in cents)
    price_monthly INTEGER NOT NULL DEFAULT 0, -- Monthly price in cents
    price_yearly INTEGER NOT NULL DEFAULT 0, -- Yearly price in cents (discounted)

    -- Stripe product/price IDs
    stripe_product_id VARCHAR(255),
    stripe_price_monthly_id VARCHAR(255),
    stripe_price_yearly_id VARCHAR(255),

    -- Limits
    generation_limit_weekly INTEGER NOT NULL, -- -1 for unlimited
    job_discovery_limit_daily INTEGER NOT NULL DEFAULT -1, -- -1 for unlimited

    -- Features (JSONB for flexibility)
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Example: {
    --   "resume_styles": ["basic", "modern", "executive"],
    --   "api_access": false,
    --   "white_label": false,
    --   "priority_support": false,
    --   "custom_branding": false,
    --   "advanced_analytics": false
    -- }

    -- Display
    badge_text VARCHAR(50), -- e.g., "Most Popular"
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- User Subscriptions
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    tier_id UUID NOT NULL REFERENCES subscription_tiers(id),

    -- Subscription status
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    -- active, canceled, past_due, incomplete, trialing, paused

    -- Stripe integration
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    stripe_price_id VARCHAR(255), -- Which price they're on (monthly/yearly)

    -- Billing period
    billing_interval VARCHAR(20) DEFAULT 'monthly', -- monthly, yearly
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,

    -- Trial info
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,

    -- Cancellation
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    canceled_at TIMESTAMPTZ,
    cancellation_reason TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- Usage Tracking (Weekly periods)
-- ============================================================================

CREATE TABLE IF NOT EXISTS usage_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Period (week boundaries in UTC)
    period_start TIMESTAMPTZ NOT NULL, -- Sunday 00:00:00 UTC
    period_end TIMESTAMPTZ NOT NULL, -- Saturday 23:59:59 UTC

    -- Usage counters
    generations_used INTEGER NOT NULL DEFAULT 0,
    jobs_discovered INTEGER NOT NULL DEFAULT 0,
    api_calls INTEGER NOT NULL DEFAULT 0,

    -- Detailed tracking (JSONB for flexibility)
    usage_details JSONB DEFAULT '{}'::jsonb,
    -- Example: {
    --   "generation_timestamps": ["2024-01-15T10:00:00Z", ...],
    --   "by_day": {"2024-01-15": 3, "2024-01-16": 2}
    -- }

    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Ensure one record per user per period
    UNIQUE(user_id, period_start)
);

-- ============================================================================
-- Subscription Events (Audit Log)
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Event info
    event_type VARCHAR(100) NOT NULL,
    -- subscription_created, subscription_updated, subscription_canceled,
    -- payment_succeeded, payment_failed, trial_started, trial_ended,
    -- tier_upgraded, tier_downgraded, usage_limit_reached

    -- Related data
    subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
    stripe_event_id VARCHAR(255),

    -- Event data
    data JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_subscription_tiers_name ON subscription_tiers(name);
CREATE INDEX IF NOT EXISTS idx_subscription_tiers_active ON subscription_tiers(is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer ON user_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_sub ON user_subscriptions(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_period ON usage_tracking(user_id, period_start);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_period ON usage_tracking(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_subscription_events_user ON subscription_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_events_stripe ON subscription_events(stripe_event_id);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- Subscription tiers - everyone can read active tiers
CREATE POLICY "Anyone can view active subscription tiers"
    ON subscription_tiers FOR SELECT
    USING (is_active = true);

-- User subscriptions - users can only see their own
CREATE POLICY "Users can view their own subscription"
    ON user_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Usage tracking - users can only see their own
CREATE POLICY "Users can view their own usage"
    ON usage_tracking FOR SELECT
    USING (auth.uid() = user_id);

-- Subscription events - users can only see their own
CREATE POLICY "Users can view their own subscription events"
    ON subscription_events FOR SELECT
    USING (auth.uid() = user_id);

-- ============================================================================
-- Service Role Policies (for server-side operations)
-- ============================================================================

-- Allow service role to manage all subscription data
CREATE POLICY "Service role can manage subscription tiers"
    ON subscription_tiers FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage user subscriptions"
    ON user_subscriptions FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage usage tracking"
    ON usage_tracking FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage subscription events"
    ON subscription_events FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- Triggers
-- ============================================================================

-- Auto-update updated_at for subscription_tiers
CREATE TRIGGER update_subscription_tiers_updated_at
    BEFORE UPDATE ON subscription_tiers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for user_subscriptions
CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for usage_tracking
CREATE TRIGGER update_usage_tracking_updated_at
    BEFORE UPDATE ON usage_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Functions
-- ============================================================================

-- Function to get the start of the current week (Sunday UTC)
CREATE OR REPLACE FUNCTION get_week_start(ts TIMESTAMPTZ DEFAULT NOW())
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Extract day of week (0 = Sunday)
    -- Subtract days to get to Sunday, then truncate to day
    RETURN date_trunc('day', ts - ((EXTRACT(DOW FROM ts))::integer || ' days')::interval);
END;
$$;

-- Function to get the end of the current week (Saturday 23:59:59.999 UTC)
CREATE OR REPLACE FUNCTION get_week_end(ts TIMESTAMPTZ DEFAULT NOW())
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN get_week_start(ts) + INTERVAL '7 days' - INTERVAL '1 millisecond';
END;
$$;

-- Function to check if user can generate (has remaining quota)
CREATE OR REPLACE FUNCTION check_generation_limit(target_user_id UUID)
RETURNS TABLE (
    can_generate BOOLEAN,
    generations_used INTEGER,
    generation_limit INTEGER,
    remaining INTEGER,
    tier_name VARCHAR,
    resets_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tier_id UUID;
    v_tier_name VARCHAR;
    v_generation_limit INTEGER;
    v_generations_used INTEGER;
    v_period_start TIMESTAMPTZ;
    v_period_end TIMESTAMPTZ;
BEGIN
    -- Get current week boundaries
    v_period_start := get_week_start(NOW());
    v_period_end := get_week_end(NOW());

    -- Get user's tier (default to 'free' if no subscription)
    SELECT us.tier_id, st.name, st.generation_limit_weekly
    INTO v_tier_id, v_tier_name, v_generation_limit
    FROM user_subscriptions us
    JOIN subscription_tiers st ON us.tier_id = st.id
    WHERE us.user_id = target_user_id
      AND us.status IN ('active', 'trialing');

    -- If no subscription found, use free tier
    IF v_tier_id IS NULL THEN
        SELECT id, name, generation_limit_weekly
        INTO v_tier_id, v_tier_name, v_generation_limit
        FROM subscription_tiers
        WHERE name = 'free' AND is_active = true;
    END IF;

    -- Get current usage for this period
    SELECT COALESCE(ut.generations_used, 0)
    INTO v_generations_used
    FROM usage_tracking ut
    WHERE ut.user_id = target_user_id
      AND ut.period_start = v_period_start;

    -- If no usage record, default to 0
    IF v_generations_used IS NULL THEN
        v_generations_used := 0;
    END IF;

    -- Return results
    RETURN QUERY SELECT
        CASE
            WHEN v_generation_limit = -1 THEN true -- Unlimited
            WHEN v_generations_used < v_generation_limit THEN true
            ELSE false
        END AS can_generate,
        v_generations_used AS generations_used,
        v_generation_limit AS generation_limit,
        CASE
            WHEN v_generation_limit = -1 THEN -1 -- Unlimited
            ELSE GREATEST(0, v_generation_limit - v_generations_used)
        END AS remaining,
        v_tier_name AS tier_name,
        v_period_end + INTERVAL '1 millisecond' AS resets_at;
END;
$$;

-- Function to increment usage
CREATE OR REPLACE FUNCTION increment_usage(
    target_user_id UUID,
    usage_type VARCHAR DEFAULT 'generation',
    increment_by INTEGER DEFAULT 1
)
RETURNS TABLE (
    success BOOLEAN,
    new_count INTEGER,
    limit_reached BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_period_start TIMESTAMPTZ;
    v_period_end TIMESTAMPTZ;
    v_new_count INTEGER;
    v_limit INTEGER;
    v_limit_reached BOOLEAN := false;
BEGIN
    -- Get current week boundaries
    v_period_start := get_week_start(NOW());
    v_period_end := get_week_end(NOW());

    -- Get user's limit
    SELECT COALESCE(st.generation_limit_weekly, 5)
    INTO v_limit
    FROM user_subscriptions us
    JOIN subscription_tiers st ON us.tier_id = st.id
    WHERE us.user_id = target_user_id
      AND us.status IN ('active', 'trialing');

    -- Default to free tier limit if no subscription
    IF v_limit IS NULL THEN
        SELECT generation_limit_weekly INTO v_limit
        FROM subscription_tiers WHERE name = 'free';
        v_limit := COALESCE(v_limit, 5);
    END IF;

    -- Upsert usage record
    INSERT INTO usage_tracking (user_id, period_start, period_end, generations_used)
    VALUES (target_user_id, v_period_start, v_period_end, increment_by)
    ON CONFLICT (user_id, period_start)
    DO UPDATE SET
        generations_used = CASE
            WHEN usage_type = 'generation' THEN usage_tracking.generations_used + increment_by
            ELSE usage_tracking.generations_used
        END,
        jobs_discovered = CASE
            WHEN usage_type = 'job_discovery' THEN usage_tracking.jobs_discovered + increment_by
            ELSE usage_tracking.jobs_discovered
        END,
        api_calls = CASE
            WHEN usage_type = 'api_call' THEN usage_tracking.api_calls + increment_by
            ELSE usage_tracking.api_calls
        END,
        updated_at = NOW()
    RETURNING generations_used INTO v_new_count;

    -- Check if limit reached (-1 means unlimited)
    IF v_limit != -1 AND v_new_count >= v_limit THEN
        v_limit_reached := true;

        -- Log limit reached event
        INSERT INTO subscription_events (user_id, event_type, data)
        VALUES (
            target_user_id,
            'usage_limit_reached',
            jsonb_build_object(
                'usage_type', usage_type,
                'current_count', v_new_count,
                'limit', v_limit,
                'period_start', v_period_start,
                'period_end', v_period_end
            )
        );
    END IF;

    RETURN QUERY SELECT true, v_new_count, v_limit_reached;
END;
$$;

-- ============================================================================
-- Seed Data: Default Subscription Tiers
-- ============================================================================

INSERT INTO subscription_tiers (name, display_name, description, price_monthly, price_yearly, generation_limit_weekly, features, badge_text, sort_order)
VALUES
    (
        'free',
        'Free',
        'Perfect for getting started with job applications',
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
        NULL,
        0
    ),
    (
        'pro',
        'Pro',
        'For serious job seekers who need more power',
        1299, -- $12.99/month
        10788, -- $89.90/year (save ~30%)
        50,
        '{
            "resume_styles": ["basic", "modern", "creative", "executive"],
            "api_access": false,
            "white_label": false,
            "priority_support": true,
            "custom_branding": false,
            "advanced_analytics": true,
            "cover_letter": true,
            "job_matching": true,
            "ats_optimization": true,
            "linkedin_optimization": true,
            "interview_prep": true
        }'::jsonb,
        'Most Popular',
        1
    ),
    (
        'premium',
        'Premium',
        'Unlimited access for power users and teams',
        2999, -- $29.99/month
        23988, -- $199.90/year (save ~33%)
        -1, -- Unlimited
        '{
            "resume_styles": ["basic", "modern", "creative", "executive", "technical", "academic"],
            "api_access": true,
            "white_label": true,
            "priority_support": true,
            "custom_branding": true,
            "advanced_analytics": true,
            "cover_letter": true,
            "job_matching": true,
            "ats_optimization": true,
            "linkedin_optimization": true,
            "interview_prep": true,
            "salary_negotiation": true,
            "career_coaching": true
        }'::jsonb,
        NULL,
        2
    )
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    generation_limit_weekly = EXCLUDED.generation_limit_weekly,
    features = EXCLUDED.features,
    badge_text = EXCLUDED.badge_text,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- ============================================================================
-- Auto-create free subscription for new users
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user_subscription()
RETURNS TRIGGER AS $$
DECLARE
    v_free_tier_id UUID;
BEGIN
    -- Get the free tier ID
    SELECT id INTO v_free_tier_id
    FROM subscription_tiers
    WHERE name = 'free' AND is_active = true
    LIMIT 1;

    -- Create free subscription for new user
    IF v_free_tier_id IS NOT NULL THEN
        INSERT INTO user_subscriptions (user_id, tier_id, status, billing_interval)
        VALUES (NEW.id, v_free_tier_id, 'active', 'monthly')
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new users (fires after profile creation)
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user_subscription();
