-- Token Usage Tracking Tables
-- Tracks LLM token consumption per user for budget enforcement and analytics

-- Token usage log - records each LLM call
CREATE TABLE IF NOT EXISTS token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Model details
  model TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'anthropic', 'openai', 'google'

  -- Token counts
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,

  -- Cost tracking (in cents)
  cost_cents NUMERIC(10, 4) NOT NULL DEFAULT 0,

  -- Request context
  purpose TEXT, -- 'resume', 'cover_letter', 'job_match', 'summary'
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  trace_id TEXT, -- Langfuse trace ID for correlation

  -- Caching info
  cached BOOLEAN NOT NULL DEFAULT FALSE,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- User token budgets - configurable limits per user
CREATE TABLE IF NOT EXISTS user_budgets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Monthly budget (in cents)
  monthly_budget_cents INTEGER NOT NULL DEFAULT 10000, -- $100 default

  -- Current period tracking
  current_period_start DATE NOT NULL DEFAULT DATE_TRUNC('month', NOW())::DATE,
  current_period_usage_cents NUMERIC(10, 4) NOT NULL DEFAULT 0,

  -- Daily limits
  daily_request_limit INTEGER NOT NULL DEFAULT 100,
  daily_token_limit INTEGER NOT NULL DEFAULT 500000,

  -- Alert thresholds (percentage)
  alert_threshold_50 BOOLEAN NOT NULL DEFAULT FALSE,
  alert_threshold_80 BOOLEAN NOT NULL DEFAULT FALSE,
  alert_threshold_100 BOOLEAN NOT NULL DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily usage aggregation for quick lookups
CREATE TABLE IF NOT EXISTS daily_usage_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,

  -- Aggregated counts
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_prompt_tokens INTEGER NOT NULL DEFAULT 0,
  total_completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost_cents NUMERIC(10, 4) NOT NULL DEFAULT 0,

  -- By model breakdown (JSONB for flexibility)
  usage_by_model JSONB NOT NULL DEFAULT '{}'::jsonb,
  usage_by_purpose JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Cache stats
  cached_requests INTEGER NOT NULL DEFAULT 0,
  cache_savings_cents NUMERIC(10, 4) NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, usage_date)
);

-- Indexes for efficient queries
CREATE INDEX idx_token_usage_user_created ON token_usage(user_id, created_at DESC);
CREATE INDEX idx_token_usage_user_date ON token_usage(user_id, DATE(created_at));
CREATE INDEX idx_token_usage_trace ON token_usage(trace_id) WHERE trace_id IS NOT NULL;
CREATE INDEX idx_token_usage_job ON token_usage(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX idx_daily_usage_user_date ON daily_usage_summary(user_id, usage_date DESC);

-- Enable RLS
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_usage_summary ENABLE ROW LEVEL SECURITY;

-- RLS Policies - users can only see their own data
CREATE POLICY "Users can view own token usage"
  ON token_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own budget"
  ON user_budgets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own daily summary"
  ON daily_usage_summary FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert/update (for server-side tracking)
CREATE POLICY "Service can insert token usage"
  ON token_usage FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Service can manage budgets"
  ON user_budgets FOR ALL
  USING (TRUE);

CREATE POLICY "Service can manage daily summary"
  ON daily_usage_summary FOR ALL
  USING (TRUE);

-- Function to update daily summary after each token usage insert
CREATE OR REPLACE FUNCTION update_daily_usage_summary()
RETURNS TRIGGER AS $$
DECLARE
  v_usage_date DATE;
  v_model_key TEXT;
  v_purpose_key TEXT;
BEGIN
  v_usage_date := DATE(NEW.created_at);
  v_model_key := NEW.model;
  v_purpose_key := COALESCE(NEW.purpose, 'other');

  INSERT INTO daily_usage_summary (
    user_id, usage_date,
    total_requests, total_prompt_tokens, total_completion_tokens,
    total_tokens, total_cost_cents,
    usage_by_model, usage_by_purpose,
    cached_requests, cache_savings_cents
  ) VALUES (
    NEW.user_id, v_usage_date,
    1, NEW.prompt_tokens, NEW.completion_tokens,
    NEW.total_tokens, NEW.cost_cents,
    jsonb_build_object(v_model_key, jsonb_build_object('requests', 1, 'tokens', NEW.total_tokens, 'cost', NEW.cost_cents)),
    jsonb_build_object(v_purpose_key, jsonb_build_object('requests', 1, 'tokens', NEW.total_tokens, 'cost', NEW.cost_cents)),
    CASE WHEN NEW.cached THEN 1 ELSE 0 END,
    CASE WHEN NEW.cached THEN NEW.cost_cents ELSE 0 END
  )
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET
    total_requests = daily_usage_summary.total_requests + 1,
    total_prompt_tokens = daily_usage_summary.total_prompt_tokens + NEW.prompt_tokens,
    total_completion_tokens = daily_usage_summary.total_completion_tokens + NEW.completion_tokens,
    total_tokens = daily_usage_summary.total_tokens + NEW.total_tokens,
    total_cost_cents = daily_usage_summary.total_cost_cents + NEW.cost_cents,
    usage_by_model = daily_usage_summary.usage_by_model ||
      jsonb_build_object(v_model_key, jsonb_build_object(
        'requests', COALESCE((daily_usage_summary.usage_by_model->v_model_key->>'requests')::int, 0) + 1,
        'tokens', COALESCE((daily_usage_summary.usage_by_model->v_model_key->>'tokens')::int, 0) + NEW.total_tokens,
        'cost', COALESCE((daily_usage_summary.usage_by_model->v_model_key->>'cost')::numeric, 0) + NEW.cost_cents
      )),
    usage_by_purpose = daily_usage_summary.usage_by_purpose ||
      jsonb_build_object(v_purpose_key, jsonb_build_object(
        'requests', COALESCE((daily_usage_summary.usage_by_purpose->v_purpose_key->>'requests')::int, 0) + 1,
        'tokens', COALESCE((daily_usage_summary.usage_by_purpose->v_purpose_key->>'tokens')::int, 0) + NEW.total_tokens,
        'cost', COALESCE((daily_usage_summary.usage_by_purpose->v_purpose_key->>'cost')::numeric, 0) + NEW.cost_cents
      )),
    cached_requests = daily_usage_summary.cached_requests + CASE WHEN NEW.cached THEN 1 ELSE 0 END,
    cache_savings_cents = daily_usage_summary.cache_savings_cents + CASE WHEN NEW.cached THEN NEW.cost_cents ELSE 0 END,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update daily summary
CREATE TRIGGER trigger_update_daily_summary
  AFTER INSERT ON token_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_usage_summary();

-- Function to update monthly budget usage
CREATE OR REPLACE FUNCTION update_budget_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- Reset period if new month
  UPDATE user_budgets
  SET
    current_period_start = DATE_TRUNC('month', NOW())::DATE,
    current_period_usage_cents = 0,
    alert_threshold_50 = FALSE,
    alert_threshold_80 = FALSE,
    alert_threshold_100 = FALSE
  WHERE user_id = NEW.user_id
    AND current_period_start < DATE_TRUNC('month', NOW())::DATE;

  -- Update usage
  UPDATE user_budgets
  SET
    current_period_usage_cents = current_period_usage_cents + NEW.cost_cents,
    updated_at = NOW()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update budget
CREATE TRIGGER trigger_update_budget
  AFTER INSERT ON token_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_budget_usage();

-- Function to check budget before allowing request
CREATE OR REPLACE FUNCTION check_budget(p_user_id UUID)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining_cents NUMERIC,
  usage_percent NUMERIC,
  message TEXT
) AS $$
DECLARE
  v_budget user_budgets%ROWTYPE;
BEGIN
  -- Get or create budget record
  INSERT INTO user_budgets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_budget FROM user_budgets WHERE user_id = p_user_id;

  -- Reset if new month
  IF v_budget.current_period_start < DATE_TRUNC('month', NOW())::DATE THEN
    UPDATE user_budgets
    SET
      current_period_start = DATE_TRUNC('month', NOW())::DATE,
      current_period_usage_cents = 0,
      alert_threshold_50 = FALSE,
      alert_threshold_80 = FALSE,
      alert_threshold_100 = FALSE
    WHERE user_id = p_user_id;

    v_budget.current_period_usage_cents := 0;
  END IF;

  allowed := v_budget.current_period_usage_cents < v_budget.monthly_budget_cents;
  remaining_cents := v_budget.monthly_budget_cents - v_budget.current_period_usage_cents;
  usage_percent := (v_budget.current_period_usage_cents / v_budget.monthly_budget_cents) * 100;

  IF NOT allowed THEN
    message := 'Monthly budget exceeded. Please upgrade or wait until next month.';
  ELSIF usage_percent >= 80 THEN
    message := 'Warning: You have used ' || ROUND(usage_percent) || '% of your monthly budget.';
  ELSE
    message := NULL;
  END IF;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-create budget record when user signs up
CREATE OR REPLACE FUNCTION create_user_budget()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_budgets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Hook into profile creation (from existing trigger)
CREATE TRIGGER on_profile_created_budget
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_user_budget();
