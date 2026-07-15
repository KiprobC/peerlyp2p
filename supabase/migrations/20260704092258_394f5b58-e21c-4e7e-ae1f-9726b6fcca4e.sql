-- Fix admin_approve_deposit to use correct wallet_transactions columns
CREATE OR REPLACE FUNCTION public.admin_approve_deposit(
  p_request_id UUID,
  p_credited_amount NUMERIC DEFAULT NULL,
  p_tx_hash TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_req RECORD;
  v_wallet RECORD;
  v_amount NUMERIC;
  v_bal_before NUMERIC;
BEGIN
  IF NOT public.has_role(v_admin,'admin') THEN RAISE EXCEPTION 'admin only'; END IF;

  SELECT * INTO v_req FROM public.deposit_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'request already processed'; END IF;

  v_amount := COALESCE(p_credited_amount, v_req.amount);
  IF v_amount <= 0 THEN RAISE EXCEPTION 'invalid credit amount'; END IF;

  INSERT INTO public.wallets(user_id, crypto_type, balance)
    VALUES (v_req.user_id, v_req.crypto_type, 0)
    ON CONFLICT (user_id, crypto_type) DO NOTHING;

  SELECT * INTO v_wallet FROM public.wallets
    WHERE user_id = v_req.user_id AND crypto_type = v_req.crypto_type FOR UPDATE;
  v_bal_before := v_wallet.balance;

  UPDATE public.wallets
     SET balance = balance + v_amount, updated_at = now()
   WHERE id = v_wallet.id;

  INSERT INTO public.wallet_transactions(
    wallet_id, user_id, type, amount, crypto_type,
    status, description, tx_hash
  ) VALUES (
    v_wallet.id, v_req.user_id, 'deposit'::transaction_type, v_amount, v_req.crypto_type,
    'completed',
    format('Manual deposit approved (request %s)', v_req.id),
    COALESCE(NULLIF(trim(p_tx_hash),''), v_req.tx_hash)
  );

  UPDATE public.deposit_requests
     SET status = 'approved',
         credited_amount = v_amount,
         tx_hash = COALESCE(NULLIF(trim(p_tx_hash),''), tx_hash),
         admin_notes = p_notes,
         processed_by = v_admin,
         processed_at = now()
   WHERE id = v_req.id;

  INSERT INTO public.admin_actions(admin_id, action_type, target_type, target_id, details)
    VALUES (v_admin, 'approve_deposit', 'deposit_request', v_req.id,
            jsonb_build_object('amount',v_amount,'crypto_type',v_req.crypto_type,'user_id',v_req.user_id));

  PERFORM public.create_notification(
    v_req.user_id,
    'system'::notification_type,
    'Deposit Confirmed',
    format(
        'Your %s %s deposit has completed blockchain confirmations and has been credited to your wallet.',
        v_amount,
        v_req.crypto_type
    ),
    jsonb_build_object(
        'kind','deposit_request',
        'request_id',v_req.id,
        'status','approved'
    )
);
END $$;

-- Fix admin_mark_withdrawal_sent to use correct wallet_transactions columns
CREATE OR REPLACE FUNCTION public.admin_mark_withdrawal_sent(
  p_request_id UUID,
  p_tx_hash TEXT,
  p_notes TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_req RECORD;
  v_wallet RECORD;
  v_bal_before NUMERIC;
BEGIN
  IF NOT public.has_role(v_admin,'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  IF p_tx_hash IS NULL OR length(trim(p_tx_hash)) < 6 THEN
    RAISE EXCEPTION 'blockchain tx hash required';
  END IF;

  SELECT * INTO v_req FROM public.withdrawal_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  IF v_req.status NOT IN ('pending','approved') THEN
    RAISE EXCEPTION 'request not in pending/approved state';
  END IF;

  SELECT * INTO v_wallet FROM public.wallets
    WHERE user_id = v_req.user_id AND crypto_type = v_req.crypto_type FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet missing'; END IF;

  IF v_wallet.locked_balance < v_req.total_locked THEN
    RAISE EXCEPTION 'locked balance insufficient (%.< %)', v_wallet.locked_balance, v_req.total_locked;
  END IF;

  v_bal_before := v_wallet.balance;

  UPDATE public.wallets
     SET balance = balance - v_req.total_locked,
         locked_balance = locked_balance - v_req.total_locked,
         updated_at = now()
   WHERE id = v_wallet.id;

  INSERT INTO public.wallet_transactions(
    wallet_id, user_id, type, amount, crypto_type,
    status, description, tx_hash, fee
  ) VALUES (
    v_wallet.id, v_req.user_id, 'withdrawal'::transaction_type, v_req.total_locked, v_req.crypto_type,
    'completed',
    format('Manual withdrawal sent (request %s)', v_req.id),
    trim(p_tx_hash),
    v_req.fee
  );

  UPDATE public.withdrawal_requests
     SET status = 'sent', tx_hash = trim(p_tx_hash), admin_notes = p_notes,
         processed_by = v_admin, processed_at = now()
   WHERE id = v_req.id;

  INSERT INTO public.admin_actions(admin_id, action_type, target_type, target_id, details)
    VALUES (v_admin, 'mark_withdrawal_sent', 'withdrawal_request', v_req.id,
            jsonb_build_object('tx_hash',p_tx_hash,'amount',v_req.amount,'crypto_type',v_req.crypto_type,'user_id',v_req.user_id));

  PERFORM public.create_notification(
    v_req.user_id, 'system'::notification_type,
    'Withdrawal sent',
    format('Your %s %s withdrawal has been sent. TX: %s', v_req.amount, v_req.crypto_type, p_tx_hash),
    jsonb_build_object('kind','withdrawal_request','request_id',v_req.id,'status','sent','tx_hash',p_tx_hash)
  );
END $$;