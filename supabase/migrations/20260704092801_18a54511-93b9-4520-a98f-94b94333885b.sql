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
    VALUES (v_wallet.id, v_req.user_id, 'deposit'::transaction_type, v_amount, v_req.crypto_type, 'completed', format('Manual deposit approved (request %s)', v_req.id), COALESCE(NULLIF(trim(p_tx_hash),''), v_req.tx_hash));
  UPDATE public.deposit_requests SET status = 'approved', credited_amount = v_amount, tx_hash = COALESCE(NULLIF(trim(p_tx_hash),''), tx_hash), admin_notes = p_notes, processed_by = v_admin, processed_at = now() WHERE id = v_req.id;
  INSERT INTO public.admin_actions(actor_id, actor_role, action_type, target_type, target_id, details)
    VALUES (v_admin, 'admin', 'approve_deposit', 'deposit_request', v_req.id, jsonb_build_object('amount',v_amount,'crypto_type',v_req.crypto_type,'user_id',v_req.user_id));
  PERFORM public.create_notification(v_req.user_id, 'system'::notification_type, 'Deposit credited', format('Your %s %s deposit has been credited.', v_amount, v_req.crypto_type), jsonb_build_object('kind','deposit_request','request_id',v_req.id,'status','approved'));
END $function$;

CREATE OR REPLACE FUNCTION public.admin_reject_deposit(p_request_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
  PERFORM public.create_notification(v_req.user_id, 'system'::notification_type, 'Deposit rejected', format('Your %s %s deposit was rejected. %s', v_req.amount, v_req.crypto_type, COALESCE('Reason: '||p_notes,'')), jsonb_build_object('kind','deposit_request','request_id',v_req.id,'status','rejected'));
END $function$;

CREATE OR REPLACE FUNCTION public.admin_mark_withdrawal_sent(p_request_id uuid, p_tx_hash text, p_notes text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
    VALUES (v_wallet.id, v_req.user_id, 'withdrawal'::transaction_type, v_req.total_locked, v_req.crypto_type, 'completed', format('Manual withdrawal sent (request %s)', v_req.id), trim(p_tx_hash), v_req.fee);
  UPDATE public.withdrawal_requests SET status = 'sent', tx_hash = trim(p_tx_hash), admin_notes = p_notes, processed_by = v_admin, processed_at = now() WHERE id = v_req.id;
  INSERT INTO public.admin_actions(actor_id, actor_role, action_type, target_type, target_id, details)
    VALUES (v_admin, 'admin', 'mark_withdrawal_sent', 'withdrawal_request', v_req.id, jsonb_build_object('tx_hash',p_tx_hash,'amount',v_req.amount,'crypto_type',v_req.crypto_type,'user_id',v_req.user_id));
  PERFORM public.create_notification(v_req.user_id, 'system'::notification_type, 'Withdrawal sent', format('Your %s %s withdrawal has been sent. TX: %s', v_req.amount, v_req.crypto_type, p_tx_hash), jsonb_build_object('kind','withdrawal_request','request_id',v_req.id,'status','sent','tx_hash',p_tx_hash));
END $function$;

CREATE OR REPLACE FUNCTION public.admin_reject_withdrawal(p_request_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_admin UUID := auth.uid(); v_req RECORD; v_wallet RECORD;
BEGIN
  IF NOT public.has_role(v_admin,'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT * INTO v_req FROM public.withdrawal_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  IF v_req.status NOT IN ('pending','approved') THEN RAISE EXCEPTION 'request not cancelable'; END IF;
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_req.user_id AND crypto_type = v_req.crypto_type FOR UPDATE;
  IF FOUND THEN UPDATE public.wallets SET locked_balance = GREATEST(0, locked_balance - v_req.total_locked), updated_at = now() WHERE id = v_wallet.id; END IF;
  UPDATE public.withdrawal_requests SET status = 'rejected', admin_notes = p_notes, processed_by = v_admin, processed_at = now() WHERE id = v_req.id;
  INSERT INTO public.admin_actions(actor_id, actor_role, action_type, target_type, target_id, details)
    VALUES (v_admin, 'admin', 'reject_withdrawal', 'withdrawal_request', v_req.id, jsonb_build_object('reason',p_notes,'user_id',v_req.user_id,'released',v_req.total_locked));
  PERFORM public.create_notification(v_req.user_id, 'system'::notification_type, 'Withdrawal rejected', format('Your %s %s withdrawal was rejected and funds returned. %s', v_req.amount, v_req.crypto_type, COALESCE('Reason: '||p_notes,'')), jsonb_build_object('kind','withdrawal_request','request_id',v_req.id,'status','rejected'));
END $function$;

CREATE OR REPLACE FUNCTION public.admin_rotate_deposit_address(p_old_id uuid, p_new_address text, p_new_memo text DEFAULT NULL::text, p_memo_required boolean DEFAULT false, p_min_deposit numeric DEFAULT 0, p_label text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_admin UUID := auth.uid(); v_old RECORD; v_new_id UUID;
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  IF p_new_address IS NULL OR length(trim(p_new_address)) < 4 THEN RAISE EXCEPTION 'new address required'; END IF;
  SELECT * INTO v_old FROM public.admin_deposit_addresses WHERE id = p_old_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'old address not found'; END IF;
  UPDATE public.admin_deposit_addresses SET active = false, updated_at = now() WHERE id = p_old_id;
  INSERT INTO public.admin_deposit_addresses(crypto_type, network, address, memo, memo_required, min_deposit, active, label, notes, created_by)
    VALUES (v_old.crypto_type, v_old.network, trim(p_new_address), NULLIF(trim(coalesce(p_new_memo,'')),''), p_memo_required, coalesce(p_min_deposit, v_old.min_deposit), true, coalesce(p_label, v_old.label), p_notes, v_admin)
    RETURNING id INTO v_new_id;
  INSERT INTO public.admin_actions(actor_id, actor_role, action_type, target_type, target_id, details)
    VALUES (v_admin, 'admin', 'rotate_deposit_address', 'admin_deposit_address', v_new_id, jsonb_build_object('crypto_type', v_old.crypto_type, 'network', v_old.network, 'old_id', p_old_id, 'old_address', v_old.address, 'new_address', trim(p_new_address)));
  RETURN v_new_id;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_upsert_withdrawal_limit(p_crypto_type text, p_network text, p_daily_limit numeric, p_enabled boolean DEFAULT true, p_notes text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_admin UUID := auth.uid(); v_prev RECORD;
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  IF p_daily_limit < 0 THEN RAISE EXCEPTION 'limit must be >= 0'; END IF;
  SELECT * INTO v_prev FROM public.withdrawal_limit_overrides WHERE crypto_type = upper(p_crypto_type) AND network = lower(p_network);
  INSERT INTO public.withdrawal_limit_overrides(crypto_type, network, daily_limit, enabled, notes, updated_by, updated_at)
    VALUES (upper(p_crypto_type), lower(p_network), p_daily_limit, p_enabled, p_notes, v_admin, now())
    ON CONFLICT (crypto_type, network) DO UPDATE SET daily_limit = EXCLUDED.daily_limit, enabled = EXCLUDED.enabled, notes = EXCLUDED.notes, updated_by = v_admin, updated_at = now();
  INSERT INTO public.admin_actions(actor_id, actor_role, action_type, target_type, target_id, details)
    VALUES (v_admin, 'admin', 'update_withdrawal_limit', 'withdrawal_limit_override', gen_random_uuid(), jsonb_build_object('crypto_type', upper(p_crypto_type), 'network', lower(p_network), 'daily_limit', p_daily_limit, 'enabled', p_enabled, 'previous', to_jsonb(v_prev)));
END $function$;

CREATE OR REPLACE FUNCTION public.admin_delete_withdrawal_limit(p_crypto_type text, p_network text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_admin UUID := auth.uid(); v_prev RECORD;
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT * INTO v_prev FROM public.withdrawal_limit_overrides WHERE crypto_type = upper(p_crypto_type) AND network = lower(p_network);
  IF NOT FOUND THEN RETURN; END IF;
  DELETE FROM public.withdrawal_limit_overrides WHERE crypto_type = upper(p_crypto_type) AND network = lower(p_network);
  INSERT INTO public.admin_actions(actor_id, actor_role, action_type, target_type, target_id, details)
    VALUES (v_admin, 'admin', 'delete_withdrawal_limit', 'withdrawal_limit_override', gen_random_uuid(), jsonb_build_object('previous', to_jsonb(v_prev)));
END $function$;