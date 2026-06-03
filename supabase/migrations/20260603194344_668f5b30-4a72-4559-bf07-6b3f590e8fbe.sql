-- =====================================================================
-- PHASE 3: FRAUD & RISK ENFORCEMENT
-- =====================================================================

-- 1. risk_events: append-only audit log of risk evaluations
CREATE TABLE IF NOT EXISTS public.risk_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  action_type  text NOT NULL,
  risk_score   numeric NOT NULL,
  risk_level   text NOT NULL,
  decision     text NOT NULL,
  reasons      jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.risk_events TO authenticated;
GRANT ALL ON public.risk_events TO service_role;

ALTER TABLE public.risk_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all risk events" ON public.risk_events
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderators view all risk events" ON public.risk_events
  FOR SELECT USING (public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "Users view own risk events" ON public.risk_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_risk_events_user_time ON public.risk_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_events_level_time ON public.risk_events(risk_level, created_at DESC);

-- Append-only enforcement
CREATE OR REPLACE FUNCTION public.risk_events_block_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'risk_events is append-only';
END $$;

DROP TRIGGER IF EXISTS trg_risk_events_immutable ON public.risk_events;
CREATE TRIGGER trg_risk_events_immutable
BEFORE UPDATE OR DELETE ON public.risk_events
FOR EACH ROW EXECUTE FUNCTION public.risk_events_block_mutation();

-- =====================================================================
-- 2. account_freezes: typed, scoped freezes
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.account_freezes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  scope        text NOT NULL CHECK (scope IN ('withdrawals','trading','account')),
  reason       text,
  frozen_by    uuid NOT NULL,
  frozen_at    timestamptz NOT NULL DEFAULT now(),
  unfrozen_at  timestamptz,
  unfrozen_by  uuid,
  is_active    boolean GENERATED ALWAYS AS (unfrozen_at IS NULL) STORED
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_account_freezes_active
  ON public.account_freezes(user_id, scope) WHERE unfrozen_at IS NULL;

GRANT SELECT ON public.account_freezes TO authenticated;
GRANT ALL ON public.account_freezes TO service_role;

ALTER TABLE public.account_freezes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage freezes" ON public.account_freezes
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderators view freezes" ON public.account_freezes
  FOR SELECT USING (public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "Users view own freezes" ON public.account_freezes
  FOR SELECT USING (auth.uid() = user_id);

-- =====================================================================
-- 3. is_user_frozen update + scoped helper
-- =====================================================================
CREATE OR REPLACE FUNCTION public.is_user_frozen_for(p_user_id uuid, p_scope text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_freezes
    WHERE user_id = p_user_id
      AND unfrozen_at IS NULL
      AND scope IN ('account', p_scope)
  ) OR EXISTS (
    SELECT 1 FROM public.user_transfer_freeze WHERE user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_user_frozen(p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_freezes
    WHERE user_id = p_user_id AND unfrozen_at IS NULL AND scope = 'account'
  ) OR EXISTS (
    SELECT 1 FROM public.user_transfer_freeze WHERE user_id = p_user_id
  );
$$;

-- =====================================================================
-- 4. Freeze / unfreeze admin RPCs (with audit)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.freeze_user_scoped(
  p_user_id uuid, p_scope text, p_reason text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_actor uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'Only admins can freeze accounts';
  END IF;
  IF p_scope NOT IN ('withdrawals','trading','account') THEN
    RAISE EXCEPTION 'Invalid freeze scope: %', p_scope;
  END IF;

  INSERT INTO public.account_freezes(user_id, scope, reason, frozen_by)
  VALUES (p_user_id, p_scope, p_reason, v_actor)
  ON CONFLICT (user_id, scope) WHERE unfrozen_at IS NULL DO NOTHING
  RETURNING id INTO v_id;

  INSERT INTO public.admin_actions(actor_id, actor_role, action_type, target_type, target_id, reason, details)
  VALUES (v_actor, 'admin', 'freeze_user', 'user', p_user_id, p_reason,
          jsonb_build_object('scope', p_scope));

  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.unfreeze_user_scoped(
  p_user_id uuid, p_scope text, p_reason text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'Only admins can unfreeze accounts';
  END IF;

  UPDATE public.account_freezes
     SET unfrozen_at = now(), unfrozen_by = v_actor
   WHERE user_id = p_user_id AND scope = p_scope AND unfrozen_at IS NULL;

  INSERT INTO public.admin_actions(actor_id, actor_role, action_type, target_type, target_id, reason, details)
  VALUES (v_actor, 'admin', 'unfreeze_user', 'user', p_user_id, p_reason,
          jsonb_build_object('scope', p_scope));

  RETURN true;
END $$;

GRANT EXECUTE ON FUNCTION public.freeze_user_scoped(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unfreeze_user_scoped(uuid,text,text) TO authenticated;

-- =====================================================================
-- 5. evaluate_risk: central scoring engine
-- =====================================================================
CREATE OR REPLACE FUNCTION public.evaluate_risk(
  p_user_id uuid,
  p_action  text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_score numeric := 0;
  v_reasons jsonb := '[]'::jsonb;
  v_account_age_days numeric;
  v_kyc public.kyc_tier;
  v_metrics RECORD;
  v_trade_count int;
  v_withdrawal_count int;
  v_failed_logins int;
  v_pm_changes int;
  v_dispute_ratio numeric := 0;
  v_level text;
  v_decision text;
  v_amount numeric := COALESCE((p_metadata->>'amount')::numeric, 0);
BEGIN
  -- Already frozen → critical
  IF public.is_user_frozen(p_user_id) THEN
    v_score := 100;
    v_reasons := v_reasons || jsonb_build_array('account_frozen');
  END IF;

  -- Account age
  SELECT EXTRACT(EPOCH FROM (now() - created_at))/86400.0
    INTO v_account_age_days
  FROM auth.users WHERE id = p_user_id;

  IF v_account_age_days IS NULL THEN
    v_score := v_score + 20;
    v_reasons := v_reasons || jsonb_build_array('unknown_account_age');
  ELSIF v_account_age_days < 1 THEN
    v_score := v_score + 25;
    v_reasons := v_reasons || jsonb_build_array('account_under_24h');
  ELSIF v_account_age_days < 7 THEN
    v_score := v_score + 15;
    v_reasons := v_reasons || jsonb_build_array('account_under_7d');
  ELSIF v_account_age_days < 30 THEN
    v_score := v_score + 5;
    v_reasons := v_reasons || jsonb_build_array('account_under_30d');
  END IF;

  -- KYC
  SELECT public.get_user_kyc_tier(p_user_id) INTO v_kyc;
  IF v_kyc = 'unverified' THEN
    v_score := v_score + 20;
    v_reasons := v_reasons || jsonb_build_array('kyc_unverified');
  END IF;

  -- Behaviour metrics + dispute ratio
  SELECT total_trades, completed_trades, cancelled_trades, disputes_raised_against, risk_score
    INTO v_metrics
  FROM public.trader_behavior_metrics WHERE user_id = p_user_id;

  IF v_metrics.total_trades IS NOT NULL AND v_metrics.total_trades > 0 THEN
    v_dispute_ratio := v_metrics.disputes_raised_against::numeric / v_metrics.total_trades;
    IF v_dispute_ratio > 0.20 THEN
      v_score := v_score + 25;
      v_reasons := v_reasons || jsonb_build_array('high_dispute_ratio');
    ELSIF v_dispute_ratio > 0.10 THEN
      v_score := v_score + 12;
      v_reasons := v_reasons || jsonb_build_array('elevated_dispute_ratio');
    END IF;
    IF v_metrics.risk_score >= 75 THEN
      v_score := v_score + 20;
      v_reasons := v_reasons || jsonb_build_array('behaviour_risk_high');
    END IF;
  END IF;

  -- Trade velocity (last hour)
  SELECT COUNT(*) INTO v_trade_count
  FROM public.trades
  WHERE (buyer_id = p_user_id OR seller_id = p_user_id)
    AND created_at > now() - interval '1 hour';
  IF v_trade_count > 20 THEN
    v_score := v_score + 20;
    v_reasons := v_reasons || jsonb_build_array('trade_velocity_high');
  ELSIF v_trade_count > 10 THEN
    v_score := v_score + 10;
    v_reasons := v_reasons || jsonb_build_array('trade_velocity_elevated');
  END IF;

  -- Withdrawal velocity (last hour)
  IF p_action IN ('withdraw','withdrawal') THEN
    SELECT COUNT(*) INTO v_withdrawal_count
    FROM public.security_events
    WHERE user_id = p_user_id
      AND action_type = 'withdrawal'
      AND created_at > now() - interval '1 hour';
    IF v_withdrawal_count >= 5 THEN
      v_score := v_score + 25;
      v_reasons := v_reasons || jsonb_build_array('withdrawal_velocity_high');
    END IF;

    -- Large withdrawal from new account
    IF v_account_age_days IS NOT NULL AND v_account_age_days < 7 AND v_amount > 100 THEN
      v_score := v_score + 25;
      v_reasons := v_reasons || jsonb_build_array('large_withdrawal_new_account');
    END IF;
  END IF;

  -- Failed login attempts (last 24h)
  SELECT COUNT(*) INTO v_failed_logins
  FROM public.security_events
  WHERE user_id = p_user_id AND action_type = 'login' AND status = 'failed'
    AND created_at > now() - interval '24 hours';
  IF v_failed_logins >= 10 THEN
    v_score := v_score + 15;
    v_reasons := v_reasons || jsonb_build_array('many_failed_logins');
  ELSIF v_failed_logins >= 5 THEN
    v_score := v_score + 7;
    v_reasons := v_reasons || jsonb_build_array('repeated_failed_logins');
  END IF;

  -- Payment method changes (last 7d)
  SELECT COUNT(*) INTO v_pm_changes
  FROM public.security_events
  WHERE user_id = p_user_id AND action_type = 'payment_method_change'
    AND created_at > now() - interval '7 days';
  IF v_pm_changes >= 3 THEN
    v_score := v_score + 10;
    v_reasons := v_reasons || jsonb_build_array('frequent_payment_method_changes');
  END IF;

  -- Cap
  IF v_score > 100 THEN v_score := 100; END IF;

  -- Level
  v_level := CASE
    WHEN v_score >= 75 THEN 'critical'
    WHEN v_score >= 50 THEN 'high'
    WHEN v_score >= 25 THEN 'medium'
    ELSE 'low'
  END;

  -- Decision per action
  v_decision := CASE v_level
    WHEN 'critical' THEN 'block'
    WHEN 'high' THEN
      CASE WHEN p_action IN ('withdraw','withdrawal','release_crypto','change_security_settings')
           THEN 'step_up' ELSE 'restrict' END
    WHEN 'medium' THEN 'warn'
    ELSE 'allow'
  END;

  -- Persist
  INSERT INTO public.risk_events(user_id, action_type, risk_score, risk_level, decision, reasons, metadata)
  VALUES (p_user_id, p_action, v_score, v_level, v_decision, v_reasons, p_metadata);

  -- Critical → notify admins, create risk flag (best-effort)
  IF v_level = 'critical' THEN
    INSERT INTO public.abuse_flags(user_id, flag_type, severity, action_type, details)
    VALUES (p_user_id, 'critical_risk', 'high', p_action,
            jsonb_build_object('score', v_score, 'reasons', v_reasons));

    INSERT INTO public.notifications(user_id, type, title, message, data)
    SELECT ur.user_id, 'system'::notification_type,
           'Critical risk detected',
           'User ' || p_user_id::text || ' reached critical risk on ' || p_action,
           jsonb_build_object('user_id', p_user_id, 'action', p_action, 'score', v_score)
    FROM public.user_roles ur WHERE ur.role = 'admin';
  END IF;

  RETURN jsonb_build_object(
    'risk_score', v_score,
    'risk_level', v_level,
    'decision', v_decision,
    'reasons', v_reasons,
    'recommended_action', v_decision
  );
END $$;

GRANT EXECUTE ON FUNCTION public.evaluate_risk(uuid,text,jsonb) TO authenticated, service_role;

-- =====================================================================
-- 6. Wire evaluate_risk into validate_trade_action
-- =====================================================================
CREATE OR REPLACE FUNCTION public.validate_trade_action(
  p_user_id uuid, p_action text, p_amount numeric,
  p_payment_method text, p_ip_address text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rate_limit_result JSONB;
  v_kyc_result JSONB;
  v_user_kyc_tier public.kyc_tier;
  v_user_country TEXT;
  v_country_check JSONB;
  v_payment_check JSONB;
  v_risk JSONB;
  v_risk_level TEXT;
  v_risk_decision TEXT;
BEGIN
  IF NOT public.is_platform_enabled('trading_enabled') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'P2P trading is temporarily paused for maintenance', 'error_code', 'PLATFORM_DISABLED');
  END IF;
  IF p_action = 'create_offer' AND NOT public.is_platform_enabled('offer_creation_enabled') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Offer creation is temporarily disabled', 'error_code', 'OFFER_CREATION_DISABLED');
  END IF;
  IF p_action = 'initiate_trade' AND NOT public.is_platform_enabled('trade_initiation_enabled') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'New trades are temporarily disabled', 'error_code', 'TRADE_INITIATION_DISABLED');
  END IF;
  IF p_action = 'lock_escrow' AND NOT public.is_platform_enabled('escrow_locking_enabled') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Escrow operations are temporarily disabled', 'error_code', 'ESCROW_DISABLED');
  END IF;
  IF p_action = 'wallet_transfer' AND NOT public.is_platform_enabled('wallet_transfers_enabled') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Wallet transfers are temporarily disabled', 'error_code', 'TRANSFERS_DISABLED');
  END IF;

  -- Scoped freeze checks
  IF p_action IN ('withdraw','withdrawal','wallet_transfer') AND public.is_user_frozen_for(p_user_id, 'withdrawals') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Withdrawals are frozen on your account', 'error_code', 'USER_FROZEN');
  END IF;
  IF p_action IN ('create_offer','initiate_trade','lock_escrow') AND public.is_user_frozen_for(p_user_id, 'trading') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Trading is frozen on your account', 'error_code', 'USER_FROZEN');
  END IF;
  IF public.is_user_frozen(p_user_id) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Your account has been temporarily restricted. Please contact support.', 'error_code', 'USER_FROZEN');
  END IF;

  SELECT public.get_user_kyc_tier(p_user_id) INTO v_user_kyc_tier;
  SELECT kyc_country INTO v_user_country FROM public.profiles WHERE user_id = p_user_id;

  IF v_user_country IS NOT NULL THEN
    v_country_check := public.check_country_trading(v_user_country, v_user_kyc_tier);
    IF NOT (v_country_check->>'allowed')::boolean THEN
      RETURN jsonb_build_object('allowed', false, 'reason', v_country_check->>'reason', 'error_code', 'COUNTRY_RESTRICTED');
    END IF;
  END IF;

  IF p_payment_method IS NOT NULL AND v_user_country IS NOT NULL THEN
    v_payment_check := public.check_payment_method_allowed(v_user_country, p_payment_method, v_user_kyc_tier);
    IF NOT (v_payment_check->>'allowed')::boolean THEN
      RETURN jsonb_build_object('allowed', false, 'reason', v_payment_check->>'reason', 'error_code', 'PAYMENT_METHOD_RESTRICTED');
    END IF;
  END IF;

  v_rate_limit_result := public.check_rate_limit(p_user_id, p_action, COALESCE(p_ip_address, '0.0.0.0'));
  IF NOT (v_rate_limit_result->>'allowed')::boolean THEN
    RETURN jsonb_build_object('allowed', false, 'reason', v_rate_limit_result->>'reason',
                              'retry_after', v_rate_limit_result->>'retry_after', 'error_code', 'RATE_LIMITED');
  END IF;

  v_kyc_result := public.check_kyc_trade_limits(p_user_id, p_action, p_amount, p_payment_method);
  IF NOT (v_kyc_result->>'allowed')::boolean THEN
    RETURN jsonb_build_object('allowed', false, 'reason', v_kyc_result->>'reason',
      'current_tier', v_kyc_result->>'current_tier', 'required_tier', v_kyc_result->>'required_tier',
      'limit_type', v_kyc_result->>'limit_type', 'error_code', 'KYC_LIMIT_EXCEEDED');
  END IF;

  -- Risk engine gate
  v_risk := public.evaluate_risk(p_user_id, p_action,
            jsonb_build_object('amount', p_amount, 'payment_method', p_payment_method));
  v_risk_level := v_risk->>'risk_level';
  v_risk_decision := v_risk->>'decision';

  IF v_risk_level = 'critical' THEN
    RETURN jsonb_build_object('allowed', false,
      'reason', 'This action is blocked due to elevated risk on your account. Please contact support.',
      'error_code', 'RISK_BLOCKED', 'risk_score', v_risk->>'risk_score',
      'risk_level', v_risk_level, 'reasons', v_risk->'reasons');
  END IF;

  IF v_risk_level = 'high' AND p_action IN ('withdraw','withdrawal','release_crypto','change_security_settings') THEN
    RETURN jsonb_build_object('allowed', false,
      'reason', 'Additional verification required for this action.',
      'error_code', 'RISK_STEP_UP_REQUIRED', 'risk_score', v_risk->>'risk_score',
      'risk_level', v_risk_level, 'requires', 'passkey_or_oauth',
      'reasons', v_risk->'reasons');
  END IF;

  IF v_risk_level = 'high' AND p_amount > 0 THEN
    -- Restrict trade size to 50% of single-trade KYC cap (best-effort, info only)
    RETURN jsonb_build_object('allowed', true, 'warning', true,
      'risk_score', v_risk->>'risk_score', 'risk_level', v_risk_level,
      'reasons', v_risk->'reasons', 'message', 'High-risk: trade size restrictions apply.');
  END IF;

  IF v_risk_level = 'medium' THEN
    RETURN jsonb_build_object('allowed', true, 'warning', true,
      'risk_score', v_risk->>'risk_score', 'risk_level', v_risk_level,
      'reasons', v_risk->'reasons');
  END IF;

  RETURN jsonb_build_object('allowed', true, 'risk_score', v_risk->>'risk_score',
                            'risk_level', v_risk_level);
END $$;

-- =====================================================================
-- 7. Seed velocity limits
-- =====================================================================
INSERT INTO public.rate_limit_config (action_type, max_attempts, window_seconds, base_cooldown_seconds, max_cooldown_seconds, description)
VALUES
  ('otp_request', 5, 900, 60, 3600, 'OTP requests per 15 min'),
  ('login_attempt', 10, 3600, 60, 3600, 'Login attempts per hour'),
  ('trade_creation', 20, 3600, 60, 3600, 'Trade creations per hour'),
  ('withdrawal', 5, 3600, 300, 86400, 'Withdrawals per hour'),
  ('payment_method_change', 3, 86400, 300, 86400, 'Payment method changes per day'),
  ('dispute_create', 10, 86400, 60, 86400, 'Disputes per day')
ON CONFLICT (action_type) DO UPDATE SET
  max_attempts = EXCLUDED.max_attempts,
  window_seconds = EXCLUDED.window_seconds,
  base_cooldown_seconds = EXCLUDED.base_cooldown_seconds,
  max_cooldown_seconds = EXCLUDED.max_cooldown_seconds,
  description = EXCLUDED.description,
  is_active = true;