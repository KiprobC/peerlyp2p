-- 1. Withdrawal submission: require step-up
CREATE OR REPLACE FUNCTION public.submit_withdrawal_request(
  p_crypto_type text, p_network text, p_amount numeric, p_fee numeric,
  p_destination_address text, p_destination_memo text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_crypto TEXT := upper(trim(p_crypto_type));
  v_network TEXT := lower(trim(p_network));
  v_total NUMERIC := COALESCE(p_amount,0) + COALESCE(p_fee,0);
  v_wallet RECORD;
  v_available NUMERIC;
  v_daily_sum NUMERIC;
  v_override NUMERIC;
  v_kyc_cap NUMERIC;
  v_cap NUMERIC;
  v_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  PERFORM public.assert_step_up('withdrawal', 15);

  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  IF p_fee IS NULL OR p_fee < 0 THEN RAISE EXCEPTION 'invalid fee'; END IF;
  IF p_destination_address IS NULL OR length(trim(p_destination_address)) < 10 THEN
    RAISE EXCEPTION 'invalid destination address';
  END IF;

  SELECT * INTO v_wallet FROM public.wallets
    WHERE user_id = v_user_id AND crypto_type = v_crypto
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet not found for %', v_crypto; END IF;

  v_available := v_wallet.balance - v_wallet.locked_balance;
  IF v_total > v_available THEN
    RAISE EXCEPTION 'insufficient available balance (need %, have %)', v_total, v_available;
  END IF;

  SELECT COALESCE(SUM(total_locked),0) INTO v_daily_sum
    FROM public.withdrawal_requests
   WHERE user_id = v_user_id
     AND crypto_type = v_crypto
     AND status IN ('pending','approved','sent')
     AND created_at >= (now() - interval '24 hours');

  SELECT daily_limit INTO v_override FROM public.withdrawal_limit_overrides WHERE crypto_type = v_crypto;

  BEGIN
    SELECT ktl.daily_withdrawal_limit INTO v_kyc_cap
      FROM public.profiles p
      JOIN public.kyc_tier_limits ktl ON ktl.tier = p.kyc_tier
     WHERE p.id = v_user_id;
  EXCEPTION WHEN undefined_column THEN v_kyc_cap := NULL;
  END;

  v_cap := LEAST(COALESCE(v_override, 'infinity'::numeric), COALESCE(v_kyc_cap, 'infinity'::numeric));
  IF v_cap IS NOT NULL AND v_cap <> 'infinity'::numeric AND (v_daily_sum + v_total) > v_cap THEN
    RAISE EXCEPTION 'daily withdrawal limit exceeded (cap: % %, used: %)', v_cap, v_crypto, v_daily_sum;
  END IF;

  UPDATE public.wallets
     SET locked_balance = locked_balance + v_total,
         updated_at = now()
   WHERE id = v_wallet.id;

  INSERT INTO public.withdrawal_requests(
    user_id, crypto_type, network, amount, fee, total_locked,
    destination_address, destination_memo
  ) VALUES (
    v_user_id, v_crypto, v_network, p_amount, p_fee, v_total,
    trim(p_destination_address), NULLIF(trim(p_destination_memo),'')
  ) RETURNING id INTO v_id;

  PERFORM public.notify_admins(
    'system'::notification_type,
    'New withdrawal request',
    format('User requested %s %s withdrawal', p_amount, v_crypto),
    jsonb_build_object('kind','withdrawal_request','request_id',v_id,'user_id',v_user_id,'crypto_type',v_crypto,'amount',p_amount)
  );

  PERFORM public.create_notification(
    v_user_id, 'system'::notification_type,
    'Withdrawal in progress',
    format('Your %s %s withdrawal is being processed. We''ll notify you as soon as it''s on its way.', trim_scale(p_amount), v_crypto),
    jsonb_build_object('kind','withdrawal_request','request_id',v_id,'status','pending')
  );

  RETURN v_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.submit_withdrawal_request(text,text,numeric,numeric,text,text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_withdrawal_request(text,text,numeric,numeric,text,text) TO authenticated, service_role;

-- 2. Recovery-code regeneration: require step-up
CREATE OR REPLACE FUNCTION public.regenerate_recovery_codes(p_codes text[])
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_code text;
  v_count integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_codes IS NULL OR array_length(p_codes, 1) IS NULL THEN
    RAISE EXCEPTION 'No codes supplied';
  END IF;

  PERFORM public.assert_step_up('recovery_code_regeneration', 15);

  DELETE FROM public.mfa_recovery_codes WHERE user_id = v_user;

  FOREACH v_code IN ARRAY p_codes LOOP
    INSERT INTO public.mfa_recovery_codes (user_id, code_hash)
    VALUES (v_user, encode(extensions.digest(upper(trim(v_code)), 'sha256'), 'hex'))
    ON CONFLICT (user_id, code_hash) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END $$;

REVOKE EXECUTE ON FUNCTION public.regenerate_recovery_codes(text[]) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.regenerate_recovery_codes(text[]) TO authenticated, service_role;

-- 3. Passkey removal / modification: require step-up
CREATE OR REPLACE FUNCTION public.guard_passkey_mutation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.is_service_context() OR auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM public.assert_step_up('passkey_' || lower(TG_OP), 15);
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS guard_passkey_mutation_trg ON public.passkeys;
CREATE TRIGGER guard_passkey_mutation_trg
BEFORE UPDATE OR DELETE ON public.passkeys
FOR EACH ROW EXECUTE FUNCTION public.guard_passkey_mutation();