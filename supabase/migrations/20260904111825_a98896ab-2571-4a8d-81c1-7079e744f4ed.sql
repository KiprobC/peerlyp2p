-- 1. Helpers -------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_service_context()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT current_user::text IN ('service_role', 'postgres', 'supabase_admin')
$$;

GRANT EXECUTE ON FUNCTION public.is_service_context() TO authenticated, service_role;

-- Requires a strong, recent authentication for sensitive actions.
CREATE OR REPLACE FUNCTION public.assert_step_up(p_action text DEFAULT 'sensitive_action', p_max_age_minutes integer DEFAULT 15)
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

  -- AAL2 session (verified TOTP factor) always satisfies step-up.
  BEGIN
    v_aal := auth.jwt() ->> 'aal';
  EXCEPTION WHEN OTHERS THEN
    v_aal := NULL;
  END;
  IF v_aal = 'aal2' THEN
    RETURN;
  END IF;

  -- Recent passkey / OTP verification satisfies step-up.
  IF EXISTS (
    SELECT 1 FROM public.security_events
    WHERE user_id = v_uid
      AND status = 'success'
      AND (action_type IN ('passkey_step_up', 'passkey_login') OR action_type LIKE 'otp_verify%')
      AND created_at > now() - make_interval(mins => GREATEST(p_max_age_minutes, 1))
  ) THEN
    RETURN;
  END IF;

  -- No second factor enrolled at all -> nothing to bypass.
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

GRANT EXECUTE ON FUNCTION public.assert_step_up(text, integer) TO authenticated, service_role;

-- 2. Move trusted escrow logic behind internal-only entry points ----------

ALTER FUNCTION public.lock_escrow(uuid, text, numeric, uuid)
  RENAME TO lock_escrow_internal;
ALTER FUNCTION public.release_escrow_with_fee(uuid, uuid, uuid, text, numeric)
  RENAME TO release_escrow_with_fee_internal;
ALTER FUNCTION public.return_escrow_with_reservation(uuid, text, numeric, uuid)
  RENAME TO return_escrow_with_reservation_internal;

REVOKE ALL ON FUNCTION public.lock_escrow_internal(uuid, text, numeric, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_escrow_with_fee_internal(uuid, uuid, uuid, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.return_escrow_with_reservation_internal(uuid, text, numeric, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lock_escrow_internal(uuid, text, numeric, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_escrow_with_fee_internal(uuid, uuid, uuid, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.return_escrow_with_reservation_internal(uuid, text, numeric, uuid) TO service_role;

-- 3. Guarded public entry points -----------------------------------------

CREATE OR REPLACE FUNCTION public.lock_escrow(
  p_seller_id uuid, p_crypto_type text, p_amount numeric, p_trade_id uuid, p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_trade RECORD;
  v_key text;
  v_claim jsonb;
  v_result jsonb;
BEGIN
  SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
  END IF;

  IF NOT public.is_service_context() THEN
    IF v_uid IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    IF v_uid <> v_trade.buyer_id AND v_uid <> v_trade.seller_id
       AND NOT public.has_role(v_uid, 'admin') AND NOT public.has_role(v_uid, 'moderator') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not authorized for this trade');
    END IF;
  END IF;

  -- Identity and money always come from the trade record, never the caller.
  v_key := COALESCE(NULLIF(BTRIM(p_idempotency_key), ''), 'escrow_lock_' || p_trade_id::text);
  v_claim := public.claim_idempotency_key(v_key, 'escrow_lock', p_trade_id::text, v_trade.seller_id);
  IF (v_claim->>'replay')::boolean THEN
    RETURN (v_claim->'response') || jsonb_build_object('replay', true);
  END IF;
  IF (v_claim->>'in_progress')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Action already in progress', 'in_progress', true);
  END IF;

  BEGIN
    v_result := public.lock_escrow_internal(
      v_trade.seller_id, v_trade.crypto_type, v_trade.crypto_amount, p_trade_id
    );
    IF (v_result->>'success')::boolean THEN
      PERFORM public.complete_idempotency_key(v_key, v_result);
    ELSE
      PERFORM public.fail_idempotency_key(v_key, v_result->>'error');
    END IF;
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.fail_idempotency_key(v_key, SQLERRM);
    RAISE;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_escrow_with_fee(
  p_trade_id uuid, p_seller_id uuid, p_buyer_id uuid, p_crypto_type text,
  p_escrow_amount numeric, p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_trade RECORD;
  v_key text;
  v_claim jsonb;
  v_result jsonb;
BEGIN
  SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
  END IF;

  IF NOT public.is_service_context() THEN
    IF v_uid IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    IF v_uid <> v_trade.seller_id
       AND NOT public.has_role(v_uid, 'admin') AND NOT public.has_role(v_uid, 'moderator') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only the seller can release this escrow');
    END IF;
    PERFORM public.assert_step_up('escrow_release');
  END IF;

  v_key := COALESCE(NULLIF(BTRIM(p_idempotency_key), ''), 'release_' || p_trade_id::text);
  v_claim := public.claim_idempotency_key(v_key, 'escrow_release', p_trade_id::text, v_trade.seller_id);
  IF (v_claim->>'replay')::boolean THEN
    RETURN (v_claim->'response') || jsonb_build_object('replay', true);
  END IF;
  IF (v_claim->>'in_progress')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Release already in progress', 'in_progress', true);
  END IF;

  BEGIN
    v_result := public.release_escrow_with_fee_internal(
      p_trade_id, v_trade.seller_id, v_trade.buyer_id, v_trade.crypto_type, v_trade.crypto_amount
    );
    IF (v_result->>'success')::boolean THEN
      PERFORM public.complete_idempotency_key(v_key, v_result);
    ELSE
      PERFORM public.fail_idempotency_key(v_key, v_result->>'error');
    END IF;
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.fail_idempotency_key(v_key, SQLERRM);
    RAISE;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.return_escrow_with_reservation(
  p_seller_id uuid, p_crypto_type text, p_amount numeric, p_trade_id uuid, p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_trade RECORD;
  v_key text;
  v_claim jsonb;
  v_result jsonb;
BEGIN
  SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
  END IF;

  IF NOT public.is_service_context() THEN
    IF v_uid IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    IF v_uid <> v_trade.buyer_id AND v_uid <> v_trade.seller_id
       AND NOT public.has_role(v_uid, 'admin') AND NOT public.has_role(v_uid, 'moderator') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not authorized for this trade');
    END IF;
  END IF;

  v_key := COALESCE(NULLIF(BTRIM(p_idempotency_key), ''), 'refund_' || p_trade_id::text);
  v_claim := public.claim_idempotency_key(v_key, 'escrow_refund', p_trade_id::text, v_trade.seller_id);
  IF (v_claim->>'replay')::boolean THEN
    RETURN (v_claim->'response') || jsonb_build_object('replay', true);
  END IF;
  IF (v_claim->>'in_progress')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Refund already in progress', 'in_progress', true);
  END IF;

  BEGIN
    v_result := public.return_escrow_with_reservation_internal(
      v_trade.seller_id, v_trade.crypto_type, v_trade.crypto_amount, p_trade_id
    );
    IF (v_result->>'success')::boolean THEN
      PERFORM public.complete_idempotency_key(v_key, v_result);
    ELSE
      PERFORM public.fail_idempotency_key(v_key, v_result->>'error');
    END IF;
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.fail_idempotency_key(v_key, SQLERRM);
    RAISE;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.lock_escrow(uuid, text, numeric, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_escrow_with_fee(uuid, uuid, uuid, text, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.return_escrow_with_reservation(uuid, text, numeric, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lock_escrow(uuid, text, numeric, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_escrow_with_fee(uuid, uuid, uuid, text, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.return_escrow_with_reservation(uuid, text, numeric, uuid, text) TO authenticated, service_role;

-- 4. Deposit crediting is automation-only --------------------------------

REVOKE ALL ON FUNCTION public.credit_deposit(uuid, text, numeric, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_deposit(uuid, text, numeric, text, text, text, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.credit_buyer_wallet(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_buyer_wallet(uuid, numeric) TO service_role;

-- 5. Internal transfers: step-up + no anonymous access --------------------

ALTER FUNCTION public.execute_internal_transfer(text, text, numeric, text)
  RENAME TO execute_internal_transfer_internal;
REVOKE ALL ON FUNCTION public.execute_internal_transfer_internal(text, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_internal_transfer_internal(text, text, numeric, text) TO service_role;

CREATE OR REPLACE FUNCTION public.execute_internal_transfer(
  p_recipient_username text, p_crypto_type text, p_amount numeric, p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_service_context() THEN
    IF auth.uid() IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    PERFORM public.assert_step_up('internal_transfer');
  END IF;
  RETURN public.execute_internal_transfer_internal(p_recipient_username, p_crypto_type, p_amount, p_idempotency_key);
END;
$$;

REVOKE ALL ON FUNCTION public.execute_internal_transfer(text, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_internal_transfer(text, text, numeric, text) TO authenticated, service_role;

-- Legacy 3-arg overload: keep for compatibility but require step-up too.
CREATE OR REPLACE FUNCTION public.execute_internal_transfer(
  p_recipient_username text, p_crypto_type text, p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_service_context() THEN
    IF auth.uid() IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    PERFORM public.assert_step_up('internal_transfer');
  END IF;
  RETURN public.execute_internal_transfer_internal(
    p_recipient_username, p_crypto_type, p_amount,
    'transfer_' || COALESCE(auth.uid()::text, 'svc') || '_' || extract(epoch from clock_timestamp())::text
  );
END;
$$;

REVOKE ALL ON FUNCTION public.execute_internal_transfer(text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_internal_transfer(text, text, numeric) TO authenticated, service_role;

-- 6. No anonymous execution of privileged operations ----------------------

REVOKE ALL ON FUNCTION public.freeze_user(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_dispute(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_approve_deposit(uuid, numeric, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_mark_withdrawal_sent(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.freeze_user(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_dispute(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_approve_deposit(uuid, numeric, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_mark_withdrawal_sent(uuid, text, text) TO authenticated, service_role;