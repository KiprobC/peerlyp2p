-- Create KYC tier enum
CREATE TYPE public.kyc_tier AS ENUM ('unverified', 'level_1', 'level_2', 'level_3');

-- Create KYC tier limits configuration table
CREATE TABLE public.kyc_tier_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier kyc_tier NOT NULL UNIQUE,
  max_single_trade_amount numeric NOT NULL DEFAULT 0,
  daily_trade_limit numeric NOT NULL DEFAULT 0,
  monthly_trade_limit numeric NOT NULL DEFAULT 0,
  can_create_buy_offers boolean NOT NULL DEFAULT false,
  can_create_sell_offers boolean NOT NULL DEFAULT false,
  allowed_payment_methods text[] NOT NULL DEFAULT '{}',
  max_active_offers integer NOT NULL DEFAULT 0,
  max_daily_trades integer NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default KYC tier limits
INSERT INTO public.kyc_tier_limits (tier, max_single_trade_amount, daily_trade_limit, monthly_trade_limit, can_create_buy_offers, can_create_sell_offers, allowed_payment_methods, max_active_offers, max_daily_trades, description) VALUES
  ('unverified', 0, 0, 0, false, false, '{}', 0, 0, 'Cannot trade - verification required'),
  ('level_1', 50000, 100000, 500000, true, false, ARRAY['MPESA', 'Airtel Money'], 3, 5, 'Basic verification - phone verified'),
  ('level_2', 500000, 1000000, 5000000, true, true, ARRAY['MPESA', 'Airtel Money', 'Bank Transfer'], 10, 20, 'Standard verification - ID verified'),
  ('level_3', 5000000, 10000000, 50000000, true, true, ARRAY['MPESA', 'Airtel Money', 'Bank Transfer', 'Cash'], 50, 100, 'Full verification - address verified');

-- Enable RLS
ALTER TABLE public.kyc_tier_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies for kyc_tier_limits
CREATE POLICY "Anyone can view tier limits" ON public.kyc_tier_limits FOR SELECT USING (true);
CREATE POLICY "Admins can manage tier limits" ON public.kyc_tier_limits FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Create user trading stats table for tracking limits
CREATE TABLE public.user_trading_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  daily_trade_volume numeric NOT NULL DEFAULT 0,
  daily_trade_count integer NOT NULL DEFAULT 0,
  monthly_trade_volume numeric NOT NULL DEFAULT 0,
  monthly_trade_count integer NOT NULL DEFAULT 0,
  daily_reset_at timestamptz NOT NULL DEFAULT (date_trunc('day', now()) + interval '1 day'),
  monthly_reset_at timestamptz NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  last_trade_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_trading_stats ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own trading stats" ON public.user_trading_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all trading stats" ON public.user_trading_stats FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Create rate limits table (more comprehensive than otp_rate_limits)
CREATE TABLE public.action_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  ip_address text,
  action_type text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz,
  backoff_level integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, action_type, ip_address)
);

-- Create index for faster lookups
CREATE INDEX idx_action_rate_limits_lookup ON public.action_rate_limits(user_id, action_type, ip_address);
CREATE INDEX idx_action_rate_limits_window ON public.action_rate_limits(window_start);

-- Enable RLS
ALTER TABLE public.action_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies - service role only for direct access
CREATE POLICY "No direct user access to rate limits" ON public.action_rate_limits FOR ALL USING (false) WITH CHECK (false);

-- Create rate limit configuration table
CREATE TABLE public.rate_limit_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL UNIQUE,
  max_attempts integer NOT NULL DEFAULT 10,
  window_seconds integer NOT NULL DEFAULT 3600,
  base_cooldown_seconds integer NOT NULL DEFAULT 60,
  max_cooldown_seconds integer NOT NULL DEFAULT 86400,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default rate limit configurations
INSERT INTO public.rate_limit_config (action_type, max_attempts, window_seconds, base_cooldown_seconds, max_cooldown_seconds, description) VALUES
  ('offer_creation', 10, 3600, 60, 3600, 'Limit offer creation per hour'),
  ('trade_initiation', 20, 3600, 30, 1800, 'Limit trade initiation per hour'),
  ('trade_cancellation', 5, 3600, 120, 7200, 'Limit trade cancellations per hour'),
  ('username_search', 30, 60, 10, 300, 'Limit username searches per minute'),
  ('wallet_transfer', 10, 3600, 60, 3600, 'Limit wallet transfers per hour'),
  ('failed_trade', 3, 3600, 300, 86400, 'Limit after failed trades');

-- Enable RLS
ALTER TABLE public.rate_limit_config ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view rate limit config" ON public.rate_limit_config FOR SELECT USING (true);
CREATE POLICY "Admins can manage rate limit config" ON public.rate_limit_config FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Create abuse flags table for admin review
CREATE TABLE public.abuse_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  ip_address text,
  flag_type text NOT NULL,
  severity text NOT NULL DEFAULT 'low',
  action_type text,
  details jsonb DEFAULT '{}',
  reviewed_by uuid,
  reviewed_at timestamptz,
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_abuse_flags_user ON public.abuse_flags(user_id);
CREATE INDEX idx_abuse_flags_severity ON public.abuse_flags(severity, reviewed_at);

-- Enable RLS
ALTER TABLE public.abuse_flags ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage abuse flags" ON public.abuse_flags FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderators can view abuse flags" ON public.abuse_flags FOR SELECT USING (has_role(auth.uid(), 'moderator'));

-- Function to get user's KYC tier based on their profile status
CREATE OR REPLACE FUNCTION public.get_user_kyc_tier(p_user_id uuid)
RETURNS kyc_tier
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kyc_status kyc_status;
  v_setup_completed boolean;
  v_phone text;
BEGIN
  SELECT kyc_status, setup_completed, phone
  INTO v_kyc_status, v_setup_completed, v_phone
  FROM profiles
  WHERE user_id = p_user_id;

  IF v_kyc_status = 'verified' THEN
    RETURN 'level_3'::kyc_tier;
  ELSIF v_kyc_status = 'submitted' THEN
    RETURN 'level_2'::kyc_tier;
  ELSIF v_setup_completed = true AND v_phone IS NOT NULL THEN
    RETURN 'level_1'::kyc_tier;
  ELSE
    RETURN 'unverified'::kyc_tier;
  END IF;
END;
$$;

-- Function to check rate limit and return status
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id uuid,
  p_ip_address text,
  p_action_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config record;
  v_limit record;
  v_new_count integer;
  v_blocked_until timestamptz;
  v_backoff_seconds integer;
BEGIN
  -- Get rate limit config
  SELECT * INTO v_config FROM rate_limit_config WHERE action_type = p_action_type AND is_active = true;
  
  IF v_config IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'message', 'No rate limit configured');
  END IF;

  -- Get or create rate limit record
  SELECT * INTO v_limit FROM action_rate_limits
  WHERE (user_id = p_user_id OR (user_id IS NULL AND ip_address = p_ip_address))
    AND action_type = p_action_type
  ORDER BY user_id NULLS LAST
  LIMIT 1;

  -- Check if currently blocked
  IF v_limit IS NOT NULL AND v_limit.blocked_until IS NOT NULL AND v_limit.blocked_until > now() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'message', 'Too many attempts. Please try again later.',
      'retry_after', EXTRACT(EPOCH FROM (v_limit.blocked_until - now()))::integer
    );
  END IF;

  -- Reset if window expired
  IF v_limit IS NOT NULL AND v_limit.window_start + (v_config.window_seconds || ' seconds')::interval < now() THEN
    UPDATE action_rate_limits
    SET attempt_count = 1, window_start = now(), last_attempt_at = now(), blocked_until = NULL, backoff_level = 0
    WHERE id = v_limit.id;
    RETURN jsonb_build_object('allowed', true, 'remaining', v_config.max_attempts - 1);
  END IF;

  -- Create or update rate limit
  IF v_limit IS NULL THEN
    INSERT INTO action_rate_limits (user_id, ip_address, action_type, attempt_count, window_start, last_attempt_at)
    VALUES (p_user_id, p_ip_address, p_action_type, 1, now(), now());
    RETURN jsonb_build_object('allowed', true, 'remaining', v_config.max_attempts - 1);
  END IF;

  -- Check if over limit
  IF v_limit.attempt_count >= v_config.max_attempts THEN
    -- Calculate exponential backoff
    v_backoff_seconds := LEAST(
      v_config.base_cooldown_seconds * power(2, v_limit.backoff_level),
      v_config.max_cooldown_seconds
    );
    v_blocked_until := now() + (v_backoff_seconds || ' seconds')::interval;
    
    UPDATE action_rate_limits
    SET blocked_until = v_blocked_until, backoff_level = v_limit.backoff_level + 1, last_attempt_at = now()
    WHERE id = v_limit.id;

    -- Log abuse flag for repeated violations
    IF v_limit.backoff_level >= 2 THEN
      INSERT INTO abuse_flags (user_id, ip_address, flag_type, severity, action_type, details)
      VALUES (
        p_user_id, 
        p_ip_address, 
        'rate_limit_exceeded', 
        CASE WHEN v_limit.backoff_level >= 4 THEN 'high' ELSE 'medium' END,
        p_action_type,
        jsonb_build_object('backoff_level', v_limit.backoff_level, 'attempts', v_limit.attempt_count)
      );
    END IF;

    RETURN jsonb_build_object(
      'allowed', false,
      'message', 'Too many attempts. Please try again later.',
      'retry_after', v_backoff_seconds
    );
  END IF;

  -- Increment counter
  UPDATE action_rate_limits
  SET attempt_count = attempt_count + 1, last_attempt_at = now()
  WHERE id = v_limit.id
  RETURNING attempt_count INTO v_new_count;

  RETURN jsonb_build_object('allowed', true, 'remaining', v_config.max_attempts - v_new_count);
END;
$$;

-- Function to reset user trading stats on period expiry
CREATE OR REPLACE FUNCTION public.reset_trading_stats_if_needed(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_trading_stats
  SET 
    daily_trade_volume = CASE WHEN daily_reset_at <= now() THEN 0 ELSE daily_trade_volume END,
    daily_trade_count = CASE WHEN daily_reset_at <= now() THEN 0 ELSE daily_trade_count END,
    daily_reset_at = CASE WHEN daily_reset_at <= now() THEN date_trunc('day', now()) + interval '1 day' ELSE daily_reset_at END,
    monthly_trade_volume = CASE WHEN monthly_reset_at <= now() THEN 0 ELSE monthly_trade_volume END,
    monthly_trade_count = CASE WHEN monthly_reset_at <= now() THEN 0 ELSE monthly_trade_count END,
    monthly_reset_at = CASE WHEN monthly_reset_at <= now() THEN date_trunc('month', now()) + interval '1 month' ELSE monthly_reset_at END,
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- Function to check if user can perform trade action based on KYC limits
CREATE OR REPLACE FUNCTION public.check_kyc_trade_limits(
  p_user_id uuid,
  p_action text, -- 'create_buy_offer', 'create_sell_offer', 'initiate_trade'
  p_amount numeric,
  p_payment_method text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier kyc_tier;
  v_limits record;
  v_stats record;
  v_active_offers integer;
BEGIN
  -- Get user's KYC tier
  v_tier := get_user_kyc_tier(p_user_id);
  
  -- Get tier limits
  SELECT * INTO v_limits FROM kyc_tier_limits WHERE tier = v_tier;
  
  IF v_limits IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error_code', 'TIER_NOT_FOUND',
      'message', 'KYC tier configuration not found. Please contact support.'
    );
  END IF;

  -- Check if action is allowed for tier
  IF p_action = 'create_buy_offer' AND NOT v_limits.can_create_buy_offers THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error_code', 'BUY_OFFERS_NOT_ALLOWED',
      'message', 'Your current verification level does not allow creating buy offers. Please complete verification.',
      'required_tier', CASE WHEN v_tier = 'unverified' THEN 'level_1' ELSE 'level_2' END
    );
  END IF;

  IF p_action = 'create_sell_offer' AND NOT v_limits.can_create_sell_offers THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error_code', 'SELL_OFFERS_NOT_ALLOWED',
      'message', 'Your current verification level does not allow creating sell offers. Please complete KYC verification.',
      'required_tier', 'level_2'
    );
  END IF;

  -- Check payment method is allowed
  IF p_payment_method IS NOT NULL AND NOT (p_payment_method = ANY(v_limits.allowed_payment_methods)) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error_code', 'PAYMENT_METHOD_NOT_ALLOWED',
      'message', format('Payment method "%s" requires higher verification level.', p_payment_method),
      'allowed_methods', v_limits.allowed_payment_methods
    );
  END IF;

  -- Check single trade amount
  IF p_amount > v_limits.max_single_trade_amount THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error_code', 'AMOUNT_EXCEEDS_LIMIT',
      'message', format('Amount exceeds your limit of %s. Upgrade verification for higher limits.', v_limits.max_single_trade_amount),
      'max_allowed', v_limits.max_single_trade_amount,
      'requested', p_amount
    );
  END IF;

  -- Get or create trading stats
  INSERT INTO user_trading_stats (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Reset stats if needed
  PERFORM reset_trading_stats_if_needed(p_user_id);

  -- Get current stats
  SELECT * INTO v_stats FROM user_trading_stats WHERE user_id = p_user_id;

  -- Check daily limit
  IF v_stats.daily_trade_volume + p_amount > v_limits.daily_trade_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error_code', 'DAILY_LIMIT_EXCEEDED',
      'message', format('Daily trading limit of %s would be exceeded. Try again tomorrow or upgrade verification.', v_limits.daily_trade_limit),
      'daily_limit', v_limits.daily_trade_limit,
      'current_usage', v_stats.daily_trade_volume,
      'requested', p_amount
    );
  END IF;

  -- Check daily trade count
  IF v_stats.daily_trade_count >= v_limits.max_daily_trades THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error_code', 'DAILY_TRADE_COUNT_EXCEEDED',
      'message', format('Daily trade count limit of %s reached. Try again tomorrow.', v_limits.max_daily_trades),
      'max_trades', v_limits.max_daily_trades
    );
  END IF;

  -- Check monthly limit
  IF v_stats.monthly_trade_volume + p_amount > v_limits.monthly_trade_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error_code', 'MONTHLY_LIMIT_EXCEEDED',
      'message', format('Monthly trading limit of %s would be exceeded. Upgrade verification for higher limits.', v_limits.monthly_trade_limit),
      'monthly_limit', v_limits.monthly_trade_limit,
      'current_usage', v_stats.monthly_trade_volume,
      'requested', p_amount
    );
  END IF;

  -- Check active offers limit (for offer creation)
  IF p_action IN ('create_buy_offer', 'create_sell_offer') THEN
    SELECT COUNT(*) INTO v_active_offers FROM offers WHERE user_id = p_user_id AND is_active = true;
    IF v_active_offers >= v_limits.max_active_offers THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'error_code', 'MAX_OFFERS_REACHED',
        'message', format('Maximum active offers (%s) reached. Deactivate some offers or upgrade verification.', v_limits.max_active_offers),
        'max_offers', v_limits.max_active_offers
      );
    END IF;
  END IF;

  -- All checks passed
  RETURN jsonb_build_object(
    'allowed', true,
    'tier', v_tier,
    'remaining_daily', v_limits.daily_trade_limit - v_stats.daily_trade_volume,
    'remaining_monthly', v_limits.monthly_trade_limit - v_stats.monthly_trade_volume
  );
END;
$$;

-- Function to update trading stats after successful trade
CREATE OR REPLACE FUNCTION public.update_trading_stats(
  p_user_id uuid,
  p_amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Reset if needed first
  PERFORM reset_trading_stats_if_needed(p_user_id);
  
  -- Update stats
  UPDATE user_trading_stats
  SET 
    daily_trade_volume = daily_trade_volume + p_amount,
    daily_trade_count = daily_trade_count + 1,
    monthly_trade_volume = monthly_trade_volume + p_amount,
    monthly_trade_count = monthly_trade_count + 1,
    last_trade_at = now(),
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- Function to log abuse flag
CREATE OR REPLACE FUNCTION public.log_abuse_flag(
  p_user_id uuid,
  p_ip_address text,
  p_flag_type text,
  p_severity text,
  p_action_type text,
  p_details jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flag_id uuid;
BEGIN
  INSERT INTO abuse_flags (user_id, ip_address, flag_type, severity, action_type, details)
  VALUES (p_user_id, p_ip_address, p_flag_type, p_severity, p_action_type, p_details)
  RETURNING id INTO v_flag_id;
  
  RETURN v_flag_id;
END;
$$;

-- Create comprehensive trade validation function
CREATE OR REPLACE FUNCTION public.validate_trade_action(
  p_user_id uuid,
  p_action text,
  p_amount numeric,
  p_payment_method text,
  p_ip_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate_check jsonb;
  v_kyc_check jsonb;
  v_action_type text;
BEGIN
  -- Map action to rate limit action type
  v_action_type := CASE p_action
    WHEN 'create_buy_offer' THEN 'offer_creation'
    WHEN 'create_sell_offer' THEN 'offer_creation'
    WHEN 'initiate_trade' THEN 'trade_initiation'
    WHEN 'cancel_trade' THEN 'trade_cancellation'
    ELSE p_action
  END;

  -- Check rate limit first
  v_rate_check := check_rate_limit(p_user_id, p_ip_address, v_action_type);
  IF NOT (v_rate_check->>'allowed')::boolean THEN
    RETURN v_rate_check;
  END IF;

  -- Check KYC limits
  v_kyc_check := check_kyc_trade_limits(p_user_id, p_action, p_amount, p_payment_method);
  IF NOT (v_kyc_check->>'allowed')::boolean THEN
    RETURN v_kyc_check;
  END IF;

  -- All validations passed
  RETURN jsonb_build_object(
    'allowed', true,
    'tier', v_kyc_check->>'tier',
    'rate_limit_remaining', v_rate_check->>'remaining'
  );
END;
$$;

-- Cleanup function for expired rate limits (run via cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM action_rate_limits
  WHERE window_start < now() - interval '7 days'
    AND (blocked_until IS NULL OR blocked_until < now());
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;