-- Server-side hardening for sensitive wallet and authentication operations.

-- A normal passkey login must not satisfy a later step-up check.
CREATE OR REPLACE FUNCTION public.assert_step_up(
  p_action text DEFAULT 'sensitive_action',
  p_max_age_minutes integer DEFAULT 15
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_aal text;
  v_has_factor boolean;
BEGIN
  IF public.is_service_context() THEN
    RETURN;
  END IF;

  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_aal := auth.jwt() ->> 'aal';
  EXCEPTION WHEN OTHERS THEN
    v_aal := NULL;
  END;
  IF v_aal = 'aal2' THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.security_events
    WHERE user_id = v_uid
      AND status = 'success'
      AND (action_type = 'passkey_step_up' OR action_type LIKE 'otp_verify%')
      AND created_at > now() - make_interval(mins => GREATEST(p_max_age_minutes, 1))
  ) THEN
    RETURN;
  END IF;

  SELECT
    EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = v_uid AND f.status = 'verified')
    OR EXISTS (SELECT 1 FROM public.passkeys pk WHERE pk.user_id = v_uid)
  INTO v_has_factor;

  IF NOT v_has_factor THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'step_up_required: % requires two-factor or passkey verification', p_action
    USING ERRCODE = '42501';
END;
$$;

-- These helpers are only for trusted webhook/service-role workflows.
REVOKE ALL ON FUNCTION public.claim_idempotency_key(text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_idempotency_key(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_idempotency_key(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_idempotency_key(text, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_idempotency_key(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_idempotency_key(text, text) TO service_role;

-- Legacy direct wallet crediting is service-only and rejects invalid amounts/ids.
CREATE OR REPLACE FUNCTION public.credit_buyer_wallet(p_wallet_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_service_context() THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  IF p_wallet_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'valid wallet and positive amount required';
  END IF;

  UPDATE public.wallets
  SET balance = balance + p_amount,
      updated_at = now()
  WHERE id = p_wallet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'wallet not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_buyer_wallet(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_buyer_wallet(uuid, numeric) TO service_role;

-- Prevent an admin/API caller from crediting more than the submitted deposit.
CREATE OR REPLACE FUNCTION public.guard_deposit_credit_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.credited_amount IS NOT NULL AND NEW.credited_amount > NEW.amount THEN
    RAISE EXCEPTION 'credited amount cannot exceed requested deposit amount';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_deposit_credit_amount_trg ON public.deposit_requests;
CREATE TRIGGER guard_deposit_credit_amount_trg
BEFORE INSERT OR UPDATE OF credited_amount ON public.deposit_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_deposit_credit_amount();

-- The client may display a fee, but the server is authoritative.
CREATE OR REPLACE FUNCTION public.submit_withdrawal_request(
  p_crypto_type text,
  p_network text,
  p_amount numeric,
  p_fee numeric,
  p_destination_address text,
  p_destination_memo text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_crypto text := upper(trim(p_crypto_type));
  v_network text := lower(trim(p_network));
  v_fee numeric := 0;
  v_total numeric;
  v_wallet record;
  v_available numeric;
  v_daily_sum numeric;
  v_override numeric;
  v_kyc_cap numeric;
  v_cap numeric;
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.assert_step_up('withdrawal', 15);
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  IF p_destination_address IS NULL OR length(trim(p_destination_address)) < 10 THEN
    RAISE EXCEPTION 'invalid destination address';
  END IF;

  SELECT COALESCE((
    SELECT CASE
      WHEN f.max_amount IS NULL THEN GREATEST(p_amount * f.percentage / 100, COALESCE(f.min_amount, 0))
      ELSE LEAST(GREATEST(p_amount * f.percentage / 100, COALESCE(f.min_amount, 0)), f.max_amount)
    END
    FROM public.platform_fees f
    WHERE f.fee_type = 'withdrawal' AND f.is_active = true
    ORDER BY f.updated_at DESC
    LIMIT 1
  ), 0) INTO v_fee;
  v_total := p_amount + v_fee;

  SELECT * INTO v_wallet FROM public.wallets
  WHERE user_id = v_user_id AND crypto_type = v_crypto FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet not found for %', v_crypto; END IF;

  v_available := v_wallet.balance - v_wallet.locked_balance;
  IF v_total > v_available THEN
    RAISE EXCEPTION 'insufficient available balance (need %, have %)', v_total, v_available;
  END IF;

  SELECT COALESCE(SUM(total_locked), 0) INTO v_daily_sum
  FROM public.withdrawal_requests
  WHERE user_id = v_user_id
    AND crypto_type = v_crypto
    AND status IN ('pending', 'approved', 'sent')
    AND created_at >= now() - interval '24 hours';

  SELECT daily_limit INTO v_override
  FROM public.withdrawal_limit_overrides
  WHERE crypto_type = v_crypto;

  BEGIN
    SELECT ktl.daily_withdrawal_limit INTO v_kyc_cap
    FROM public.profiles p
    JOIN public.kyc_tier_limits ktl ON ktl.tier = p.kyc_tier
    WHERE p.id = v_user_id;
  EXCEPTION WHEN undefined_column THEN
    v_kyc_cap := NULL;
  END;

  v_cap := LEAST(COALESCE(v_override, 'infinity'::numeric), COALESCE(v_kyc_cap, 'infinity'::numeric));
  IF v_cap IS NOT NULL AND v_cap <> 'infinity'::numeric AND (v_daily_sum + v_total) > v_cap THEN
    RAISE EXCEPTION 'daily withdrawal limit exceeded (cap: % %, used: %)', v_cap, v_crypto, v_daily_sum;
  END IF;

  UPDATE public.wallets
  SET locked_balance = locked_balance + v_total, updated_at = now()
  WHERE id = v_wallet.id;

  INSERT INTO public.withdrawal_requests(
    user_id, crypto_type, network, amount, fee, total_locked,
    destination_address, destination_memo
  ) VALUES (
    v_user_id, v_crypto, v_network, p_amount, v_fee, v_total,
    trim(p_destination_address), NULLIF(trim(p_destination_memo), '')
  ) RETURNING id INTO v_id;

  PERFORM public.notify_admins(
    'system'::notification_type,
    'New withdrawal request',
    format('User requested %s %s withdrawal', p_amount, v_crypto),
    jsonb_build_object('kind', 'withdrawal_request', 'request_id', v_id, 'user_id', v_user_id, 'crypto_type', v_crypto, 'amount', p_amount)
  );

  PERFORM public.create_notification(
    v_user_id,
    'system'::notification_type,
    'Withdrawal in progress',
    format('Your %s %s withdrawal is being processed. We''ll notify you as soon as it''s on its way.', trim_scale(p_amount), v_crypto),
    jsonb_build_object('kind', 'withdrawal_request', 'request_id', v_id, 'status', 'pending')
  );

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_withdrawal_request(text, text, numeric, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_withdrawal_request(text, text, numeric, numeric, text, text) TO authenticated, service_role;
