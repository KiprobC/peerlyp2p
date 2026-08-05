-- 1. Account recovery: extra tracking columns
ALTER TABLE public.account_recovery_requests
  ADD COLUMN IF NOT EXISTS mfa_removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS mfa_removed_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_account_recovery_requests_updated_at ON public.account_recovery_requests;
CREATE TRIGGER update_account_recovery_requests_updated_at
BEFORE UPDATE ON public.account_recovery_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Admin review RPC
CREATE OR REPLACE FUNCTION public.admin_review_recovery_request(
  p_request_id uuid,
  p_decision text,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := auth.uid();
  v_req RECORD;
  v_status text;
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF p_decision NOT IN ('approved','rejected','more_info') THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;
  IF p_notes IS NULL OR length(trim(p_notes)) < 3 THEN
    RAISE EXCEPTION 'a reason is required';
  END IF;

  SELECT * INTO v_req FROM public.account_recovery_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;

  v_status := p_decision;

  UPDATE public.account_recovery_requests
     SET status = v_status,
         admin_notes = trim(p_notes),
         reviewed_by = v_admin,
         reviewed_at = now()
   WHERE id = p_request_id;

  INSERT INTO public.admin_actions(actor_id, actor_role, action_type, target_type, target_id, reason, details)
  VALUES (v_admin, 'admin', 'recovery_request_' || v_status, 'account_recovery_request', p_request_id, trim(p_notes),
          jsonb_build_object('username', v_req.username, 'email', v_req.email, 'user_id', v_req.user_id));

  IF v_req.user_id IS NOT NULL THEN
    PERFORM public.create_notification(
      v_req.user_id,
      'system'::notification_type,
      CASE v_status
        WHEN 'approved' THEN 'Account recovery approved'
        WHEN 'rejected' THEN 'Account recovery declined'
        ELSE 'We need a bit more information'
      END,
      CASE v_status
        WHEN 'approved' THEN 'Your identity has been verified. You can sign in again — follow the instructions from our team.'
        WHEN 'rejected' THEN 'We could not verify your identity from the details provided. ' || trim(p_notes)
        ELSE 'To continue with your account recovery we need more details. ' || trim(p_notes)
      END,
      jsonb_build_object('kind','account_recovery','request_id',p_request_id,'status',v_status)
    );
  END IF;
END $function$;

REVOKE ALL ON FUNCTION public.admin_review_recovery_request(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_recovery_request(uuid, text, text) TO authenticated;

-- 3. Record an MFA removal performed via the admin edge function
CREATE OR REPLACE FUNCTION public.admin_record_mfa_removal(
  p_request_id uuid,
  p_target_user uuid,
  p_reason text,
  p_factors integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_admin uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN RAISE EXCEPTION 'a detailed reason is required'; END IF;

  IF p_request_id IS NOT NULL THEN
    UPDATE public.account_recovery_requests
       SET mfa_removed_at = now(), mfa_removed_by = v_admin
     WHERE id = p_request_id;
  END IF;

  INSERT INTO public.admin_actions(actor_id, actor_role, action_type, target_type, target_id, reason, details)
  VALUES (v_admin, 'admin', 'mfa_removed', 'user', p_target_user, trim(p_reason),
          jsonb_build_object('request_id', p_request_id, 'factors_removed', p_factors));

  PERFORM public.create_notification(
    p_target_user,
    'system'::notification_type,
    'Two-factor authentication was removed',
    'Our team removed two-factor authentication from your account as part of account recovery. Please set it up again right away to keep your account protected.',
    jsonb_build_object('kind','security','action','mfa_removed')
  );
END $function$;

REVOKE ALL ON FUNCTION public.admin_record_mfa_removal(uuid, uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_record_mfa_removal(uuid, uuid, text, integer) TO authenticated;

-- 4. Admin rating removal with reputation recalculation
CREATE OR REPLACE FUNCTION public.admin_remove_rating(
  p_rating_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := auth.uid();
  v_rating RECORD;
BEGIN
  IF NOT (public.has_role(v_admin,'admin') OR public.has_role(v_admin,'moderator')) THEN
    RAISE EXCEPTION 'admin or moderator only';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'a detailed reason is required';
  END IF;

  SELECT * INTO v_rating FROM public.trade_ratings WHERE id = p_rating_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'rating not found'; END IF;

  INSERT INTO public.trade_ratings_archive(id, trade_id, rater_id, rated_id, rating, comment, created_at, archived_at, archive_reason)
  VALUES (v_rating.id, v_rating.trade_id, v_rating.rater_id, v_rating.rated_id, v_rating.rating,
          v_rating.comment, v_rating.created_at, now(), trim(p_reason));

  DELETE FROM public.trade_ratings WHERE id = p_rating_id;

  UPDATE public.profiles
     SET rating = (SELECT COALESCE(AVG(rating)::numeric, 0) FROM public.trade_ratings WHERE rated_id = v_rating.rated_id)
   WHERE user_id = v_rating.rated_id;

  INSERT INTO public.admin_actions(actor_id, actor_role, action_type, target_type, target_id, reason, details)
  VALUES (v_admin,
          CASE WHEN public.has_role(v_admin,'admin') THEN 'admin'::app_role ELSE 'moderator'::app_role END,
          'rating_removed', 'trade_rating', p_rating_id, trim(p_reason),
          jsonb_build_object('rated_id', v_rating.rated_id, 'rater_id', v_rating.rater_id,
                             'rating', v_rating.rating, 'trade_id', v_rating.trade_id));

  PERFORM public.create_notification(
    v_rating.rated_id,
    'system'::notification_type,
    'A review on your profile was removed',
    'We removed a review from your profile after moderation review. Your reputation score has been updated.',
    jsonb_build_object('kind','reputation','action','rating_removed')
  );
END $function$;

REVOKE ALL ON FUNCTION public.admin_remove_rating(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_remove_rating(uuid, text) TO authenticated;

-- 5. Friendlier user-facing notification copy
CREATE OR REPLACE FUNCTION public.submit_withdrawal_request(p_crypto_type text, p_network text, p_amount numeric, p_fee numeric, p_destination_address text, p_destination_memo text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$;

CREATE OR REPLACE FUNCTION public.admin_mark_withdrawal_sent(p_request_id uuid, p_tx_hash text, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_admin UUID := auth.uid(); v_req RECORD; v_wallet RECORD;
BEGIN
  IF NOT public.has_role(v_admin,'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  IF p_tx_hash IS NULL OR length(trim(p_tx_hash)) < 6 THEN RAISE EXCEPTION 'blockchain tx hash required'; END IF;
  SELECT * INTO v_req FROM public.withdrawal_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  IF v_req.status NOT IN ('pending','approved') THEN RAISE EXCEPTION 'request not in pending/approved state'; END IF;
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_req.user_id AND crypto_type = v_req.crypto_type FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet missing'; END IF;
  IF v_wallet.locked_balance < v_req.total_locked THEN RAISE EXCEPTION 'locked balance insufficient'; END IF;
  UPDATE public.wallets SET balance = balance - v_req.total_locked, locked_balance = locked_balance - v_req.total_locked, updated_at = now() WHERE id = v_wallet.id;
  INSERT INTO public.wallet_transactions(wallet_id, user_id, type, amount, crypto_type, status, description, tx_hash, fee)
    VALUES (v_wallet.id, v_req.user_id, 'withdrawal'::transaction_type, v_req.total_locked, v_req.crypto_type, 'completed', format('Withdrawal sent (request %s)', v_req.id), trim(p_tx_hash), v_req.fee);
  UPDATE public.withdrawal_requests SET status = 'sent', tx_hash = trim(p_tx_hash), admin_notes = p_notes, processed_by = v_admin, processed_at = now() WHERE id = v_req.id;
  INSERT INTO public.admin_actions(actor_id, actor_role, action_type, target_type, target_id, details)
    VALUES (v_admin, 'admin', 'mark_withdrawal_sent', 'withdrawal_request', v_req.id, jsonb_build_object('tx_hash',p_tx_hash,'amount',v_req.amount,'crypto_type',v_req.crypto_type,'user_id',v_req.user_id));
  PERFORM public.create_notification(v_req.user_id, 'system'::notification_type, 'Withdrawal complete',
    format('Your %s %s withdrawal has been sent to your wallet.', trim_scale(v_req.amount), v_req.crypto_type),
    jsonb_build_object('kind','withdrawal_request','request_id',v_req.id,'status','sent','tx_hash',p_tx_hash));
END $function$;

CREATE OR REPLACE FUNCTION public.admin_reject_deposit(p_request_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_admin UUID := auth.uid(); v_req RECORD;
BEGIN
  IF NOT public.has_role(v_admin,'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT * INTO v_req FROM public.deposit_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'request already processed'; END IF;
  UPDATE public.deposit_requests SET status = 'rejected', admin_notes = p_notes, processed_by = v_admin, processed_at = now() WHERE id = v_req.id;
  INSERT INTO public.admin_actions(actor_id, actor_role, action_type, target_type, target_id, details)
    VALUES (v_admin, 'admin', 'reject_deposit', 'deposit_request', v_req.id, jsonb_build_object('reason',p_notes,'user_id',v_req.user_id));
  PERFORM public.create_notification(v_req.user_id, 'system'::notification_type, 'Deposit could not be confirmed',
    format('We could not confirm your %s %s deposit. %s', trim_scale(v_req.amount), v_req.crypto_type, COALESCE(p_notes,'Please contact support if you need help.')),
    jsonb_build_object('kind','deposit_request','request_id',v_req.id,'status','rejected'));
END $function$;

CREATE OR REPLACE FUNCTION public.admin_approve_deposit(p_request_id uuid, p_credited_amount numeric DEFAULT NULL::numeric, p_tx_hash text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin UUID := auth.uid();
  v_req RECORD;
  v_wallet RECORD;
  v_amount NUMERIC;
BEGIN
  IF NOT public.has_role(v_admin,'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT * INTO v_req FROM public.deposit_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'request already processed'; END IF;
  v_amount := COALESCE(p_credited_amount, v_req.amount);
  IF v_amount <= 0 THEN RAISE EXCEPTION 'invalid credit amount'; END IF;
  INSERT INTO public.wallets(user_id, crypto_type, balance) VALUES (v_req.user_id, v_req.crypto_type, 0) ON CONFLICT (user_id, crypto_type) DO NOTHING;
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_req.user_id AND crypto_type = v_req.crypto_type FOR UPDATE;
  UPDATE public.wallets SET balance = balance + v_amount, updated_at = now() WHERE id = v_wallet.id;
  INSERT INTO public.wallet_transactions(wallet_id, user_id, type, amount, crypto_type, status, description, tx_hash)
    VALUES (v_wallet.id, v_req.user_id, 'deposit'::transaction_type, v_amount, v_req.crypto_type, 'completed', format('Deposit credited (request %s)', v_req.id), COALESCE(NULLIF(trim(p_tx_hash),''), v_req.tx_hash));
  UPDATE public.deposit_requests SET status = 'approved', credited_amount = v_amount, tx_hash = COALESCE(NULLIF(trim(p_tx_hash),''), tx_hash), admin_notes = p_notes, processed_by = v_admin, processed_at = now() WHERE id = v_req.id;
  INSERT INTO public.admin_actions(actor_id, actor_role, action_type, target_type, target_id, details)
    VALUES (v_admin, 'admin', 'approve_deposit', 'deposit_request', v_req.id, jsonb_build_object('amount',v_amount,'crypto_type',v_req.crypto_type,'user_id',v_req.user_id));
  PERFORM public.create_notification(v_req.user_id, 'system'::notification_type, 'Funds added to your balance',
    format('Your %s %s deposit is now available in your balance.', trim_scale(v_amount), v_req.crypto_type),
    jsonb_build_object('kind','deposit_request','request_id',v_req.id,'status','approved'));
END $function$;

CREATE OR REPLACE FUNCTION public.admin_reject_withdrawal(p_request_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_admin UUID := auth.uid(); v_req RECORD; v_wallet RECORD;
BEGIN
  IF NOT public.has_role(v_admin,'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT * INTO v_req FROM public.withdrawal_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  IF v_req.status NOT IN ('pending','approved') THEN RAISE EXCEPTION 'request not cancelable'; END IF;
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_req.user_id AND crypto_type = v_req.crypto_type FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet missing'; END IF;
  UPDATE public.wallets SET locked_balance = GREATEST(locked_balance - v_req.total_locked, 0), updated_at = now() WHERE id = v_wallet.id;
  UPDATE public.withdrawal_requests SET status = 'rejected', admin_notes = p_notes, processed_by = v_admin, processed_at = now() WHERE id = v_req.id;
  INSERT INTO public.admin_actions(actor_id, actor_role, action_type, target_type, target_id, details)
    VALUES (v_admin, 'admin', 'reject_withdrawal', 'withdrawal_request', v_req.id, jsonb_build_object('reason',p_notes,'amount',v_req.amount,'crypto_type',v_req.crypto_type,'user_id',v_req.user_id));
  PERFORM public.create_notification(v_req.user_id, 'system'::notification_type, 'Withdrawal cancelled',
    format('Your %s %s withdrawal could not be completed and the full amount is back in your available balance. %s', trim_scale(v_req.amount), v_req.crypto_type, COALESCE(p_notes,'')),
    jsonb_build_object('kind','withdrawal_request','request_id',v_req.id,'status','rejected'));
END $function$;

-- 6. Security: stop trade participants tampering with escrow/financial fields via the API
CREATE OR REPLACE FUNCTION public.guard_trade_participant_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only applies to direct API writes (role authenticated/anon).
  -- SECURITY DEFINER platform functions run as the function owner and are unaffected.
  IF current_user NOT IN ('authenticated','anon') THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator') THEN
    RETURN NEW;
  END IF;

  IF NEW.offer_id IS DISTINCT FROM OLD.offer_id
     OR NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
     OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
     OR NEW.crypto_type IS DISTINCT FROM OLD.crypto_type
     OR NEW.crypto_amount IS DISTINCT FROM OLD.crypto_amount
     OR NEW.fiat_amount IS DISTINCT FROM OLD.fiat_amount
     OR NEW.fiat_currency IS DISTINCT FROM OLD.fiat_currency
     OR NEW.escrow_locked IS DISTINCT FROM OLD.escrow_locked
     OR NEW.escrow_released IS DISTINCT FROM OLD.escrow_released
     OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.assigned_moderator_id IS DISTINCT FROM OLD.assigned_moderator_id
     OR NEW.resolution_type IS DISTINCT FROM OLD.resolution_type
     OR NEW.dispute_resolution_summary IS DISTINCT FROM OLD.dispute_resolution_summary
  THEN
    RAISE EXCEPTION 'escrow and financial trade fields can only be changed by platform logic';
  END IF;

  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS guard_trade_participant_update_trigger ON public.trades;
CREATE TRIGGER guard_trade_participant_update_trigger
BEFORE UPDATE ON public.trades
FOR EACH ROW EXECUTE FUNCTION public.guard_trade_participant_update();

DROP POLICY IF EXISTS "Users can update trades they are part of" ON public.trades;
CREATE POLICY "Users can update trades they are part of"
ON public.trades
FOR UPDATE
TO authenticated
USING ((auth.uid() = buyer_id) OR (auth.uid() = seller_id))
WITH CHECK ((auth.uid() = buyer_id) OR (auth.uid() = seller_id));