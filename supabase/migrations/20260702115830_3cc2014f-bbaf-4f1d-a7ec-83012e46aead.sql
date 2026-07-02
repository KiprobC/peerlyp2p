
-- 1) Public profiles directory view (safe columns only)
DROP VIEW IF EXISTS public.public_profiles CASCADE;
CREATE VIEW public.public_profiles
WITH (security_invoker = off) AS
SELECT
  user_id,
  username,
  full_name,
  avatar_url,
  is_verified,
  country,
  city,
  rating,
  total_trades,
  successful_trades,
  kyc_status,
  last_seen,
  created_at,
  setup_completed
FROM public.profiles
WHERE setup_completed = true;

GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;
GRANT ALL   ON public.public_profiles TO service_role;

-- 2) Remove broad PII exposure policy on profiles
DROP POLICY IF EXISTS "Authenticated users can view completed profiles" ON public.profiles;

-- 3) Extend withdrawal_limit_overrides
ALTER TABLE public.withdrawal_limit_overrides
  ADD COLUMN IF NOT EXISTS network TEXT NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true;

-- Drop old PK if it was on crypto_type alone; make composite
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'withdrawal_limit_overrides_pkey'
  ) THEN
    ALTER TABLE public.withdrawal_limit_overrides DROP CONSTRAINT withdrawal_limit_overrides_pkey;
  END IF;
END $$;

ALTER TABLE public.withdrawal_limit_overrides
  ADD CONSTRAINT withdrawal_limit_overrides_pkey PRIMARY KEY (crypto_type, network);

-- 4) Upsert withdrawal limit override
CREATE OR REPLACE FUNCTION public.admin_upsert_withdrawal_limit(
  p_crypto_type TEXT,
  p_network TEXT,
  p_daily_limit NUMERIC,
  p_enabled BOOLEAN DEFAULT true,
  p_notes TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_prev RECORD;
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  IF p_daily_limit < 0 THEN RAISE EXCEPTION 'limit must be >= 0'; END IF;

  SELECT * INTO v_prev FROM public.withdrawal_limit_overrides
    WHERE crypto_type = upper(p_crypto_type) AND network = lower(p_network);

  INSERT INTO public.withdrawal_limit_overrides(crypto_type, network, daily_limit, enabled, notes, updated_by, updated_at)
    VALUES (upper(p_crypto_type), lower(p_network), p_daily_limit, p_enabled, p_notes, v_admin, now())
    ON CONFLICT (crypto_type, network) DO UPDATE
      SET daily_limit = EXCLUDED.daily_limit,
          enabled = EXCLUDED.enabled,
          notes = EXCLUDED.notes,
          updated_by = v_admin,
          updated_at = now();

  INSERT INTO public.admin_actions(admin_id, action_type, target_type, target_id, details)
    VALUES (v_admin, 'update_withdrawal_limit', 'withdrawal_limit_override', gen_random_uuid(),
      jsonb_build_object(
        'crypto_type', upper(p_crypto_type),
        'network', lower(p_network),
        'daily_limit', p_daily_limit,
        'enabled', p_enabled,
        'previous', to_jsonb(v_prev)
      ));
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_withdrawal_limit(
  p_crypto_type TEXT,
  p_network TEXT
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_prev RECORD;
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;

  SELECT * INTO v_prev FROM public.withdrawal_limit_overrides
    WHERE crypto_type = upper(p_crypto_type) AND network = lower(p_network);
  IF NOT FOUND THEN RETURN; END IF;

  DELETE FROM public.withdrawal_limit_overrides
    WHERE crypto_type = upper(p_crypto_type) AND network = lower(p_network);

  INSERT INTO public.admin_actions(admin_id, action_type, target_type, target_id, details)
    VALUES (v_admin, 'delete_withdrawal_limit', 'withdrawal_limit_override', gen_random_uuid(),
      jsonb_build_object('previous', to_jsonb(v_prev)));
END $$;

-- 5) Safe deposit address rotation
CREATE OR REPLACE FUNCTION public.admin_rotate_deposit_address(
  p_old_id UUID,
  p_new_address TEXT,
  p_new_memo TEXT DEFAULT NULL,
  p_memo_required BOOLEAN DEFAULT false,
  p_min_deposit NUMERIC DEFAULT 0,
  p_label TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_old RECORD;
  v_new_id UUID;
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  IF p_new_address IS NULL OR length(trim(p_new_address)) < 4 THEN
    RAISE EXCEPTION 'new address required';
  END IF;

  SELECT * INTO v_old FROM public.admin_deposit_addresses WHERE id = p_old_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'source address not found'; END IF;

  UPDATE public.admin_deposit_addresses
     SET is_active = false, updated_at = now()
   WHERE id = p_old_id;

  INSERT INTO public.admin_deposit_addresses(
    crypto_type, network, address, memo, memo_required, min_deposit, is_active, label, notes, created_by
  ) VALUES (
    v_old.crypto_type, v_old.network, trim(p_new_address), NULLIF(trim(coalesce(p_new_memo,'')),''),
    p_memo_required, coalesce(p_min_deposit, v_old.min_deposit), true,
    coalesce(p_label, v_old.label), p_notes, v_admin
  ) RETURNING id INTO v_new_id;

  INSERT INTO public.admin_actions(admin_id, action_type, target_type, target_id, details)
    VALUES (v_admin, 'rotate_deposit_address', 'admin_deposit_address', v_new_id,
      jsonb_build_object(
        'crypto_type', v_old.crypto_type,
        'network', v_old.network,
        'old_id', p_old_id,
        'old_address', v_old.address,
        'new_address', trim(p_new_address)
      ));

  RETURN v_new_id;
END $$;

-- 6) Treasury overview aggregation RPC (admin only)
CREATE OR REPLACE FUNCTION public.admin_treasury_overview()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_result JSONB;
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;

  SELECT jsonb_build_object(
    'user_liabilities', (
      SELECT jsonb_object_agg(crypto_type, total) FROM (
        SELECT crypto_type, sum(balance + locked_balance) AS total
        FROM public.wallets GROUP BY crypto_type
      ) t
    ),
    'pending_deposits', (
      SELECT jsonb_object_agg(crypto_type, total) FROM (
        SELECT crypto_type, sum(amount) AS total
        FROM public.deposit_requests WHERE status = 'pending' GROUP BY crypto_type
      ) t
    ),
    'pending_withdrawals', (
      SELECT jsonb_object_agg(crypto_type, total) FROM (
        SELECT crypto_type, sum(total_locked) AS total
        FROM public.withdrawal_requests WHERE status IN ('pending','approved') GROUP BY crypto_type
      ) t
    ),
    'platform_balances', (
      SELECT jsonb_object_agg(crypto_type, total) FROM (
        SELECT crypto_type, sum(balance) AS total
        FROM public.platform_wallets GROUP BY crypto_type
      ) t
    ),
    'last_reconciliation', (
      SELECT to_jsonb(r) FROM public.reconciliation_runs r
      ORDER BY started_at DESC LIMIT 1
    ),
    'counts', jsonb_build_object(
      'pending_deposit_requests', (SELECT count(*) FROM public.deposit_requests WHERE status='pending'),
      'pending_withdrawal_requests', (SELECT count(*) FROM public.withdrawal_requests WHERE status IN ('pending','approved')),
      'active_deposit_addresses', (SELECT count(*) FROM public.admin_deposit_addresses WHERE is_active=true),
      'inactive_deposit_addresses', (SELECT count(*) FROM public.admin_deposit_addresses WHERE is_active=false)
    )
  ) INTO v_result;

  RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION public.admin_upsert_withdrawal_limit(TEXT,TEXT,NUMERIC,BOOLEAN,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_withdrawal_limit(TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_rotate_deposit_address(UUID,TEXT,TEXT,BOOLEAN,NUMERIC,TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_treasury_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_upsert_withdrawal_limit(TEXT,TEXT,NUMERIC,BOOLEAN,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_withdrawal_limit(TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_rotate_deposit_address(UUID,TEXT,TEXT,BOOLEAN,NUMERIC,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_treasury_overview() TO authenticated;
