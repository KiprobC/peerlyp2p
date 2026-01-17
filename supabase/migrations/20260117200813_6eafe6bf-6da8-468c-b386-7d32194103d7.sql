-- =============================================
-- PLATFORM SETTINGS (Global Kill Switches)
-- =============================================
CREATE TABLE IF NOT EXISTS public.platform_settings (
    id TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}',
    description TEXT,
    updated_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default platform settings (ignore if exists)
INSERT INTO public.platform_settings (id, value, description) VALUES
    ('trading_enabled', '{"enabled": true}'::jsonb, 'Global P2P trading toggle'),
    ('offer_creation_enabled', '{"enabled": true}'::jsonb, 'Allow new offer creation'),
    ('trade_initiation_enabled', '{"enabled": true}'::jsonb, 'Allow new trade initiation'),
    ('escrow_locking_enabled', '{"enabled": true}'::jsonb, 'Allow escrow locking'),
    ('wallet_transfers_enabled', '{"enabled": true, "disabled_assets": []}'::jsonb, 'Global wallet transfers toggle with per-asset control')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;
CREATE POLICY "Anyone can read platform settings"
ON public.platform_settings FOR SELECT
USING (true);

-- Only admins can update
DROP POLICY IF EXISTS "Admins can update platform settings" ON public.platform_settings;
CREATE POLICY "Admins can update platform settings"
ON public.platform_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- COUNTRY RISK SETTINGS
-- =============================================
CREATE TABLE IF NOT EXISTS public.country_risk_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code TEXT NOT NULL UNIQUE,
    trading_enabled BOOLEAN NOT NULL DEFAULT true,
    min_kyc_tier public.kyc_tier NOT NULL DEFAULT 'unverified',
    risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'blocked')),
    notes TEXT,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.country_risk_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read country risk settings" ON public.country_risk_settings;
CREATE POLICY "Anyone can read country risk settings"
ON public.country_risk_settings FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage country risk settings" ON public.country_risk_settings;
CREATE POLICY "Admins can manage country risk settings"
ON public.country_risk_settings FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- PAYMENT METHOD RESTRICTIONS BY COUNTRY
-- =============================================
CREATE TABLE IF NOT EXISTS public.payment_method_restrictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    is_allowed BOOLEAN NOT NULL DEFAULT true,
    min_kyc_tier public.kyc_tier NOT NULL DEFAULT 'unverified',
    notes TEXT,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(country_code, payment_method)
);

ALTER TABLE public.payment_method_restrictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read payment restrictions" ON public.payment_method_restrictions;
CREATE POLICY "Anyone can read payment restrictions"
ON public.payment_method_restrictions FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage payment restrictions" ON public.payment_method_restrictions;
CREATE POLICY "Admins can manage payment restrictions"
ON public.payment_method_restrictions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- RISK FLAGS (Admin-configurable fraud patterns)
-- =============================================
CREATE TABLE IF NOT EXISTS public.risk_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_type TEXT NOT NULL CHECK (flag_type IN ('country_mismatch', 'high_volume', 'new_account', 'payment_pattern', 'custom')),
    condition JSONB NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('block', 'require_review', 'flag', 'increase_kyc')),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read risk flags" ON public.risk_flags;
CREATE POLICY "Anyone can read risk flags"
ON public.risk_flags FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage risk flags" ON public.risk_flags;
CREATE POLICY "Admins can manage risk flags"
ON public.risk_flags FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Insert default risk flags
INSERT INTO public.risk_flags (flag_type, condition, action, severity, description) VALUES
    ('country_mismatch', '{"check": "payment_country_ne_user_country"}'::jsonb, 'require_review', 'high', 'Block when payment method country differs from user country'),
    ('new_account', '{"account_age_days_lt": 7, "trade_amount_gt": 1000}'::jsonb, 'flag', 'medium', 'Flag high-value trades from accounts less than 7 days old'),
    ('high_volume', '{"daily_trades_gt": 10}'::jsonb, 'require_review', 'medium', 'Review accounts with more than 10 daily trades')
ON CONFLICT DO NOTHING;

-- =============================================
-- PLATFORM CONTROL FUNCTIONS
-- =============================================

-- Check if platform setting is enabled
CREATE OR REPLACE FUNCTION public.is_platform_enabled(p_setting_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((value->>'enabled')::boolean, true)
    FROM public.platform_settings
    WHERE id = p_setting_id
$$;

-- Check if user is frozen
CREATE OR REPLACE FUNCTION public.is_user_frozen(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_transfer_freeze
        WHERE user_id = p_user_id
    )
$$;

-- Check if asset transfers are disabled
CREATE OR REPLACE FUNCTION public.is_asset_transfer_disabled(p_crypto_type TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (value->>'enabled')::boolean = false OR
        (value->'disabled_assets') ? p_crypto_type,
        false
    )
    FROM public.platform_settings
    WHERE id = 'wallet_transfers_enabled'
$$;

-- Check country trading status
CREATE OR REPLACE FUNCTION public.check_country_trading(p_country_code TEXT, p_user_kyc_tier public.kyc_tier)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_settings RECORD;
    v_tier_order INTEGER;
    v_required_order INTEGER;
BEGIN
    SELECT CASE p_user_kyc_tier
        WHEN 'unverified' THEN 0
        WHEN 'level_1' THEN 1
        WHEN 'level_2' THEN 2
        WHEN 'level_3' THEN 3
    END INTO v_tier_order;
    
    SELECT * INTO v_settings
    FROM public.country_risk_settings
    WHERE country_code = p_country_code;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('allowed', true, 'reason', null);
    END IF;
    
    IF NOT v_settings.trading_enabled THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'Trading is disabled for this country');
    END IF;
    
    IF v_settings.risk_level = 'blocked' THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'This country is blocked from P2P trading');
    END IF;
    
    SELECT CASE v_settings.min_kyc_tier
        WHEN 'unverified' THEN 0
        WHEN 'level_1' THEN 1
        WHEN 'level_2' THEN 2
        WHEN 'level_3' THEN 3
    END INTO v_required_order;
    
    IF v_tier_order < v_required_order THEN
        RETURN jsonb_build_object(
            'allowed', false, 
            'reason', format('This country requires %s verification or higher', v_settings.min_kyc_tier)
        );
    END IF;
    
    RETURN jsonb_build_object('allowed', true, 'reason', null);
END;
$$;

-- Check payment method restrictions
CREATE OR REPLACE FUNCTION public.check_payment_method_allowed(
    p_country_code TEXT,
    p_payment_method TEXT,
    p_user_kyc_tier public.kyc_tier
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_restriction RECORD;
    v_tier_order INTEGER;
    v_required_order INTEGER;
BEGIN
    SELECT CASE p_user_kyc_tier
        WHEN 'unverified' THEN 0
        WHEN 'level_1' THEN 1
        WHEN 'level_2' THEN 2
        WHEN 'level_3' THEN 3
    END INTO v_tier_order;
    
    SELECT * INTO v_restriction
    FROM public.payment_method_restrictions
    WHERE country_code = p_country_code AND payment_method = p_payment_method;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('allowed', true, 'reason', null);
    END IF;
    
    IF NOT v_restriction.is_allowed THEN
        RETURN jsonb_build_object(
            'allowed', false, 
            'reason', format('%s is not available in your country', p_payment_method)
        );
    END IF;
    
    SELECT CASE v_restriction.min_kyc_tier
        WHEN 'unverified' THEN 0
        WHEN 'level_1' THEN 1
        WHEN 'level_2' THEN 2
        WHEN 'level_3' THEN 3
    END INTO v_required_order;
    
    IF v_tier_order < v_required_order THEN
        RETURN jsonb_build_object(
            'allowed', false, 
            'reason', format('%s requires %s verification in your country', p_payment_method, v_restriction.min_kyc_tier)
        );
    END IF;
    
    RETURN jsonb_build_object('allowed', true, 'reason', null);
END;
$$;

-- Enhanced validate_trade_action with kill switches and risk controls
CREATE OR REPLACE FUNCTION public.validate_trade_action(
    p_user_id UUID,
    p_action TEXT,
    p_amount NUMERIC,
    p_payment_method TEXT,
    p_ip_address TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rate_limit_result JSONB;
    v_kyc_result JSONB;
    v_user_kyc_tier public.kyc_tier;
    v_user_country TEXT;
    v_country_check JSONB;
    v_payment_check JSONB;
BEGIN
    -- 1. Check global kill switches first (highest priority)
    IF NOT public.is_platform_enabled('trading_enabled') THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'P2P trading is temporarily paused for maintenance',
            'error_code', 'PLATFORM_DISABLED'
        );
    END IF;
    
    IF p_action = 'create_offer' AND NOT public.is_platform_enabled('offer_creation_enabled') THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'Offer creation is temporarily disabled',
            'error_code', 'OFFER_CREATION_DISABLED'
        );
    END IF;
    
    IF p_action = 'initiate_trade' AND NOT public.is_platform_enabled('trade_initiation_enabled') THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'New trades are temporarily disabled',
            'error_code', 'TRADE_INITIATION_DISABLED'
        );
    END IF;
    
    IF p_action = 'lock_escrow' AND NOT public.is_platform_enabled('escrow_locking_enabled') THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'Escrow operations are temporarily disabled',
            'error_code', 'ESCROW_DISABLED'
        );
    END IF;
    
    IF p_action = 'wallet_transfer' AND NOT public.is_platform_enabled('wallet_transfers_enabled') THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'Wallet transfers are temporarily disabled',
            'error_code', 'TRANSFERS_DISABLED'
        );
    END IF;
    
    -- 2. Check if user is frozen (per-user kill switch)
    IF public.is_user_frozen(p_user_id) THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'Your account has been temporarily restricted. Please contact support.',
            'error_code', 'USER_FROZEN'
        );
    END IF;
    
    -- 3. Get user's KYC tier and country
    SELECT public.get_user_kyc_tier(p_user_id) INTO v_user_kyc_tier;
    SELECT kyc_country INTO v_user_country FROM public.profiles WHERE user_id = p_user_id;
    
    -- 4. Check country-level restrictions
    IF v_user_country IS NOT NULL THEN
        v_country_check := public.check_country_trading(v_user_country, v_user_kyc_tier);
        IF NOT (v_country_check->>'allowed')::boolean THEN
            RETURN jsonb_build_object(
                'allowed', false,
                'reason', v_country_check->>'reason',
                'error_code', 'COUNTRY_RESTRICTED'
            );
        END IF;
    END IF;
    
    -- 5. Check payment method restrictions
    IF p_payment_method IS NOT NULL AND v_user_country IS NOT NULL THEN
        v_payment_check := public.check_payment_method_allowed(v_user_country, p_payment_method, v_user_kyc_tier);
        IF NOT (v_payment_check->>'allowed')::boolean THEN
            RETURN jsonb_build_object(
                'allowed', false,
                'reason', v_payment_check->>'reason',
                'error_code', 'PAYMENT_METHOD_RESTRICTED'
            );
        END IF;
    END IF;
    
    -- 6. Rate limiting check
    v_rate_limit_result := public.check_rate_limit(p_user_id, p_action, COALESCE(p_ip_address, '0.0.0.0'));
    
    IF NOT (v_rate_limit_result->>'allowed')::boolean THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', v_rate_limit_result->>'reason',
            'retry_after', v_rate_limit_result->>'retry_after',
            'error_code', 'RATE_LIMITED'
        );
    END IF;
    
    -- 7. KYC trade limits check
    v_kyc_result := public.check_kyc_trade_limits(p_user_id, p_action, p_amount, p_payment_method);
    
    IF NOT (v_kyc_result->>'allowed')::boolean THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', v_kyc_result->>'reason',
            'current_tier', v_kyc_result->>'current_tier',
            'required_tier', v_kyc_result->>'required_tier',
            'limit_type', v_kyc_result->>'limit_type',
            'error_code', 'KYC_LIMIT_EXCEEDED'
        );
    END IF;
    
    RETURN jsonb_build_object(
        'allowed', true,
        'kyc_tier', v_user_kyc_tier,
        'country', v_user_country
    );
END;
$$;

-- Admin functions for kill switches
CREATE OR REPLACE FUNCTION public.toggle_platform_setting(
    p_setting_id TEXT,
    p_enabled BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
BEGIN
    IF NOT public.has_role(v_admin_id, 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    UPDATE public.platform_settings
    SET value = jsonb_set(value, '{enabled}', to_jsonb(p_enabled)),
        updated_by = v_admin_id,
        updated_at = now()
    WHERE id = p_setting_id;
    
    INSERT INTO public.admin_actions (actor_id, actor_role, action_type, target_type, target_id, details)
    VALUES (v_admin_id, 'admin', 'toggle_setting', 'platform_setting', p_setting_id, 
            jsonb_build_object('setting', p_setting_id, 'enabled', p_enabled));
    
    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.freeze_user(
    p_user_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
BEGIN
    IF NOT public.has_role(v_admin_id, 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    INSERT INTO public.user_transfer_freeze (user_id, frozen_by, reason)
    VALUES (p_user_id, v_admin_id, p_reason)
    ON CONFLICT (user_id) DO UPDATE SET
        frozen_by = v_admin_id,
        reason = p_reason,
        frozen_at = now();
    
    INSERT INTO public.admin_actions (actor_id, actor_role, action_type, target_type, target_id, reason)
    VALUES (v_admin_id, 'admin', 'freeze_user', 'user', p_user_id::text, p_reason);
    
    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.unfreeze_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
BEGIN
    IF NOT public.has_role(v_admin_id, 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    DELETE FROM public.user_transfer_freeze WHERE user_id = p_user_id;
    
    INSERT INTO public.admin_actions (actor_id, actor_role, action_type, target_type, target_id)
    VALUES (v_admin_id, 'admin', 'unfreeze_user', 'user', p_user_id::text);
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- Disable specific offer (per-offer kill switch)
CREATE OR REPLACE FUNCTION public.admin_disable_offer(
    p_offer_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
BEGIN
    IF NOT public.has_role(v_admin_id, 'admin') AND NOT public.has_role(v_admin_id, 'moderator') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    UPDATE public.offers SET is_active = false, updated_at = now() WHERE id = p_offer_id;
    
    INSERT INTO public.admin_actions (actor_id, actor_role, action_type, target_type, target_id, reason)
    VALUES (v_admin_id, CASE WHEN public.has_role(v_admin_id, 'admin') THEN 'admin' ELSE 'moderator' END, 
            'disable_offer', 'offer', p_offer_id::text, p_reason);
    
    RETURN jsonb_build_object('success', true);
END;
$$;