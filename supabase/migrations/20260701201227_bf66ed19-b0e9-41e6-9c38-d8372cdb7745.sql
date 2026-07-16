
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.deposit_request_status AS ENUM ('pending','approved','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.withdrawal_request_status AS ENUM ('pending','approved','sent','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ ADMIN DEPOSIT ADDRESSES ============
CREATE TABLE IF NOT EXISTS public.admin_deposit_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crypto_type TEXT NOT NULL,
  network TEXT NOT NULL,
  address TEXT NOT NULL,
  memo TEXT,
  memo_required BOOLEAN NOT NULL DEFAULT false,
  min_deposit NUMERIC(18,8) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  label TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_deposit_addresses_active_unique
  ON public.admin_deposit_addresses (crypto_type, network) WHERE is_active;

GRANT SELECT ON public.admin_deposit_addresses TO authenticated;
GRANT ALL ON public.admin_deposit_addresses TO service_role;
ALTER TABLE public.admin_deposit_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone auth can view active deposit addresses"
  ON public.admin_deposit_addresses FOR SELECT TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage deposit addresses"
  ON public.admin_deposit_addresses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_admin_deposit_addresses_updated
  BEFORE UPDATE ON public.admin_deposit_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ DEPOSIT REQUESTS ============
CREATE TABLE IF NOT EXISTS public.deposit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crypto_type TEXT NOT NULL,
  network TEXT NOT NULL,
  amount NUMERIC(18,8) NOT NULL CHECK (amount > 0),
  admin_address_id UUID REFERENCES public.admin_deposit_addresses(id),
  deposit_address TEXT NOT NULL,
  memo TEXT,
  tx_hash TEXT,
  status public.deposit_request_status NOT NULL DEFAULT 'pending',
  credited_amount NUMERIC(18,8),
  admin_notes TEXT,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_user ON public.deposit_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_status ON public.deposit_requests(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deposit_requests_tx_hash ON public.deposit_requests(tx_hash) WHERE tx_hash IS NOT NULL;

GRANT SELECT, INSERT ON public.deposit_requests TO authenticated;
GRANT ALL ON public.deposit_requests TO service_role;
ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own deposit requests"
  ON public.deposit_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "users create own deposit requests"
  ON public.deposit_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins update deposit requests"
  ON public.deposit_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_deposit_requests_updated
  BEFORE UPDATE ON public.deposit_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ WITHDRAWAL REQUESTS ============
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crypto_type TEXT NOT NULL,
  network TEXT NOT NULL,
  amount NUMERIC(18,8) NOT NULL CHECK (amount > 0),
  fee NUMERIC(18,8) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  total_locked NUMERIC(18,8) NOT NULL CHECK (total_locked > 0),
  destination_address TEXT NOT NULL,
  destination_memo TEXT,
  status public.withdrawal_request_status NOT NULL DEFAULT 'pending',
  tx_hash TEXT,
  admin_notes TEXT,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user ON public.withdrawal_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON public.withdrawal_requests(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawal_requests_tx_hash ON public.withdrawal_requests(tx_hash) WHERE tx_hash IS NOT NULL;

GRANT SELECT, INSERT ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own withdrawals"
  ON public.withdrawal_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "users create own withdrawals"
  ON public.withdrawal_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins update withdrawals"
  ON public.withdrawal_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_withdrawal_requests_updated
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ WITHDRAWAL LIMIT OVERRIDES ============
CREATE TABLE IF NOT EXISTS public.withdrawal_limit_overrides (
  crypto_type TEXT PRIMARY KEY,
  daily_limit NUMERIC(18,8) NOT NULL CHECK (daily_limit >= 0),
  notes TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.withdrawal_limit_overrides TO authenticated;
GRANT ALL ON public.withdrawal_limit_overrides TO service_role;
ALTER TABLE public.withdrawal_limit_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth can read withdrawal limits"
  ON public.withdrawal_limit_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage withdrawal limits"
  ON public.withdrawal_limit_overrides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_withdrawal_limit_overrides_updated
  BEFORE UPDATE ON public.withdrawal_limit_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ HELPER: notify all admins ============
CREATE OR REPLACE FUNCTION public.notify_admins(
  p_type notification_type,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT NULL
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
  r RECORD;
BEGIN
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role LOOP
    PERFORM public.create_notification(r.user_id, p_type, p_title, p_message, p_data);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

-- ============ RPC: user submits deposit request ============
CREATE OR REPLACE FUNCTION public.submit_deposit_request(
  p_crypto_type TEXT,
  p_network TEXT,
  p_amount NUMERIC,
  p_tx_hash TEXT DEFAULT NULL,
  p_memo TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_crypto TEXT := upper(trim(p_crypto_type));
  v_network TEXT := lower(trim(p_network));
  v_addr RECORD;
  v_id UUID;
  v_required_confirmations INTEGER;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;

  SELECT * INTO v_addr FROM public.admin_deposit_addresses
   WHERE crypto_type = v_crypto AND network = v_network AND is_active = true
   LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'no active deposit address for % on %', v_crypto, v_network; END IF;
  IF p_amount < v_addr.min_deposit THEN
    RAISE EXCEPTION 'amount below minimum of % %', v_addr.min_deposit, v_crypto;
  END IF;
  
  SELECT required_confirmations
  INTO v_required_confirmations
  FROM public.network_confirmation_rules
  WHERE crypto_type = v_crypto
    AND network = v_network
    AND enabled = true
  LIMIT 1;

  IF v_required_confirmations IS NULL THEN
    RAISE EXCEPTION
        'No confirmation rule configured for % on %',
        v_crypto,
        v_network;
  END IF; 

  INSERT INTO public.deposit_requests(
    user_id, crypto_type, network, amount, admin_address_id, deposit_address, memo, tx_hash, confirmations,required_confirmations
  ) VALUES (
    v_user_id, v_crypto, v_network, p_amount, v_addr.id, v_addr.address,
    COALESCE(p_memo, v_addr.memo), NULLIF(trim(p_tx_hash), v_required_confirmations, '')
  ) RETURNING id INTO v_id;

  PERFORM public.notify_admins(
    'system'::notification_type,
    'New deposit request',
    format('User submitted %s %s deposit (pending verification)', p_amount, v_crypto),
    jsonb_build_object('kind','deposit_request','request_id',v_id,'user_id',v_user_id,'crypto_type',v_crypto,'amount',p_amount)
  );

  PERFORM public.create_notification(
    v_user_id,
    'system'::notification_type,
    'Deposit In Progress',
    format(
        'Your %s %s deposit has entered the Network Confirmation Process. Your wallet will be credited after the required blockchain confirmations and deposit processing have been completed.',
        p_amount,
        v_crypto
    ),
    jsonb_build_object(
        'kind','deposit_request',
        'request_id',v_id,
        'status','pending'
    )
);

  RETURN v_id;
END $$;

-- ============ RPC: user submits withdrawal ============
CREATE OR REPLACE FUNCTION public.submit_withdrawal_request(
  p_crypto_type TEXT,
  p_network TEXT,
  p_amount NUMERIC,
  p_fee NUMERIC,
  p_destination_address TEXT,
  p_destination_memo TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  IF p_fee IS NULL OR p_fee < 0 THEN RAISE EXCEPTION 'invalid fee'; END IF;
  IF p_destination_address IS NULL OR length(trim(p_destination_address)) < 10 THEN
    RAISE EXCEPTION 'invalid destination address';
  END IF;

  -- Lock wallet row
  SELECT * INTO v_wallet FROM public.wallets
    WHERE user_id = v_user_id AND crypto_type = v_crypto
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet not found for %', v_crypto; END IF;

  v_available := v_wallet.balance - v_wallet.locked_balance;
  IF v_total > v_available THEN
    RAISE EXCEPTION 'insufficient available balance (need %, have %)', v_total, v_available;
  END IF;

  -- Enforce daily limit: KYC tier ceiling with admin override lowering
  SELECT COALESCE(SUM(total_locked),0) INTO v_daily_sum
    FROM public.withdrawal_requests
   WHERE user_id = v_user_id
     AND crypto_type = v_crypto
     AND status IN ('pending','approved','sent')
     AND created_at >= (now() - interval '24 hours');

  SELECT daily_limit INTO v_override FROM public.withdrawal_limit_overrides WHERE crypto_type = v_crypto;

  -- KYC tier cap: look up user's tier daily crypto limit if the tier table has one
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

  -- Lock balance
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
    v_user_id,
    'system'::notification_type,
    'Withdrawal Processing',
    format(
        'Your %s %s withdrawal request has been received and is being prepared for blockchain broadcast. Your available balance has been updated to reflect this pending transfer.',
        p_amount,
        v_crypto
    ),
    jsonb_build_object(
        'kind','withdrawal_request',
        'request_id',v_id,
        'status','pending'
    )
  );

  RETURN v_id;
END $$;

-- ============ RPC: admin approves deposit (credits wallet) ============
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

  -- Ensure wallet exists
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
    wallet_id, user_id, transaction_type, amount, crypto_type,
    balance_before, balance_after, description, metadata, tx_hash
  ) VALUES (
    v_wallet.id, v_req.user_id, 'deposit', v_amount, v_req.crypto_type,
    v_bal_before, v_bal_before + v_amount,
    format('Manual deposit approved (request %s)', v_req.id),
    jsonb_build_object('kind','manual_deposit','request_id',v_req.id,'admin_id',v_admin),
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
        'Your %s %s blockchain deposit has completed the Network Confirmation Process and your wallet has been credited.',
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

-- ============ RPC: admin rejects deposit ============
CREATE OR REPLACE FUNCTION public.admin_reject_deposit(
  p_request_id UUID, p_notes TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_req RECORD;
BEGIN
  IF NOT public.has_role(v_admin,'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT * INTO v_req FROM public.deposit_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'request already processed'; END IF;

  UPDATE public.deposit_requests
     SET status = 'rejected', admin_notes = p_notes,
         processed_by = v_admin, processed_at = now()
   WHERE id = v_req.id;

  INSERT INTO public.admin_actions(admin_id, action_type, target_type, target_id, details)
    VALUES (v_admin, 'reject_deposit', 'deposit_request', v_req.id,
            jsonb_build_object('reason',p_notes,'user_id',v_req.user_id));

  PERFORM public.create_notification(
    v_req.user_id, 'system'::notification_type,
    'Deposit rejected',
    format('Your %s %s deposit was rejected. %s',
           v_req.amount, v_req.crypto_type, COALESCE('Reason: '||p_notes,'')),
    jsonb_build_object('kind','deposit_request','request_id',v_req.id,'status','rejected')
  );
END $$;

-- ============ RPC: admin marks withdrawal sent ============
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
    wallet_id, user_id, transaction_type, amount, crypto_type,
    balance_before, balance_after, description, metadata, tx_hash
  ) VALUES (
    v_wallet.id, v_req.user_id, 'withdrawal', v_req.total_locked, v_req.crypto_type,
    v_bal_before, v_bal_before - v_req.total_locked,
    format('Manual withdrawal sent (request %s)', v_req.id),
    jsonb_build_object('kind','manual_withdrawal','request_id',v_req.id,'admin_id',v_admin,
                      'destination',v_req.destination_address,'fee',v_req.fee),
    trim(p_tx_hash)
  );

  UPDATE public.withdrawal_requests
     SET status = 'sent', tx_hash = trim(p_tx_hash), admin_notes = p_notes,
         processed_by = v_admin, processed_at = now()
   WHERE id = v_req.id;

  INSERT INTO public.admin_actions(admin_id, action_type, target_type, target_id, details)
    VALUES (v_admin, 'mark_withdrawal_sent', 'withdrawal_request', v_req.id,
            jsonb_build_object('tx_hash',p_tx_hash,'amount',v_req.amount,'crypto_type',v_req.crypto_type,'user_id',v_req.user_id));

  PERFORM public.create_notification(
    v_req.user_id,
    'system'::notification_type,
    'Blockchain Transfer Initiated',
    format(
        'Your %s %s transfer has been successfully broadcast to the blockchain. Transaction Hash: %s',
        v_req.amount,
        v_req.crypto_type,
        p_tx_hash
    ),
    jsonb_build_object(
        'kind','withdrawal_request',
        'request_id',v_req.id,
        'status','sent',
        'tx_hash',p_tx_hash
    )
);
END $$;

-- ============ RPC: admin rejects withdrawal (releases lock) ============
CREATE OR REPLACE FUNCTION public.admin_reject_withdrawal(
  p_request_id UUID, p_notes TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_req RECORD;
  v_wallet RECORD;
BEGIN
  IF NOT public.has_role(v_admin,'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT * INTO v_req FROM public.withdrawal_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  IF v_req.status NOT IN ('pending','approved') THEN
    RAISE EXCEPTION 'request not cancelable';
  END IF;

  SELECT * INTO v_wallet FROM public.wallets
    WHERE user_id = v_req.user_id AND crypto_type = v_req.crypto_type FOR UPDATE;
  IF FOUND THEN
    UPDATE public.wallets
       SET locked_balance = GREATEST(0, locked_balance - v_req.total_locked),
           updated_at = now()
     WHERE id = v_wallet.id;
  END IF;

  UPDATE public.withdrawal_requests
     SET status = 'rejected', admin_notes = p_notes,
         processed_by = v_admin, processed_at = now()
   WHERE id = v_req.id;

  INSERT INTO public.admin_actions(admin_id, action_type, target_type, target_id, details)
    VALUES (v_admin, 'reject_withdrawal', 'withdrawal_request', v_req.id,
            jsonb_build_object('reason',p_notes,'user_id',v_req.user_id,'released',v_req.total_locked));

  PERFORM public.create_notification(
    v_req.user_id,
    'system'::notification_type,
    'Withdrawal Not Completed',
    format(
        'We were unable to complete your %s %s blockchain transfer. Your funds have been safely returned to your available wallet balance.%s',
        v_req.amount,
        v_req.crypto_type,
        CASE
            WHEN p_notes IS NOT NULL AND trim(p_notes) <> ''
            THEN E'\n\nReason: ' || p_notes
            ELSE ''
        END
    ),
    jsonb_build_object(
        'kind','withdrawal_request',
        'request_id',v_req.id,
        'status','rejected'
    )
);
END $$;
