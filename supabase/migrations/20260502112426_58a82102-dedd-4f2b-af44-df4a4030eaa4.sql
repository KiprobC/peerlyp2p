
-- ================================================================
-- 1. idempotency_keys table
-- ================================================================
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  scope text NOT NULL,
  reference_id text,
  actor_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  response_snapshot jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE INDEX IF NOT EXISTS idempotency_keys_scope_created_idx ON public.idempotency_keys (scope, created_at DESC);
CREATE INDEX IF NOT EXISTS idempotency_keys_reference_idx ON public.idempotency_keys (reference_id);
CREATE INDEX IF NOT EXISTS idempotency_keys_expires_idx ON public.idempotency_keys (expires_at);
CREATE INDEX IF NOT EXISTS idempotency_keys_actor_idx ON public.idempotency_keys (actor_id);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all idempotency keys" ON public.idempotency_keys;
CREATE POLICY "Admins can view all idempotency keys"
  ON public.idempotency_keys FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view their own idempotency keys" ON public.idempotency_keys;
CREATE POLICY "Users can view their own idempotency keys"
  ON public.idempotency_keys FOR SELECT
  USING (auth.uid() = actor_id);

-- No direct INSERT/UPDATE/DELETE: only SECURITY DEFINER functions touch this table.

-- ================================================================
-- 2. Idempotency helper functions
-- ================================================================

-- Claim a key. Returns:
--   { fresh: true }  - first time, caller should execute the action
--   { replay: true, status, response } - already completed/failed, caller returns snapshot
--   { in_progress: true } - another worker is currently processing
CREATE OR REPLACE FUNCTION public.claim_idempotency_key(
  p_key text,
  p_scope text,
  p_reference_id text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing RECORD;
BEGIN
  IF p_key IS NULL OR length(trim(p_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency key required';
  END IF;

  BEGIN
    INSERT INTO public.idempotency_keys (key, scope, reference_id, actor_id, status)
    VALUES (p_key, p_scope, p_reference_id, p_actor_id, 'pending');
    RETURN jsonb_build_object('fresh', true);
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_existing FROM public.idempotency_keys WHERE key = p_key FOR UPDATE;
    IF v_existing.status = 'pending' THEN
      -- If the pending row is older than 5 minutes, treat it as stale and reclaim
      IF v_existing.created_at < now() - interval '5 minutes' THEN
        UPDATE public.idempotency_keys
        SET created_at = now(), status = 'pending', response_snapshot = NULL, error = NULL
        WHERE key = p_key;
        RETURN jsonb_build_object('fresh', true, 'reclaimed', true);
      END IF;
      RETURN jsonb_build_object('in_progress', true);
    END IF;
    RETURN jsonb_build_object(
      'replay', true,
      'status', v_existing.status,
      'response', COALESCE(v_existing.response_snapshot, '{}'::jsonb),
      'error', v_existing.error
    );
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_idempotency_key(
  p_key text,
  p_response jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.idempotency_keys
  SET status = 'completed',
      response_snapshot = p_response,
      completed_at = now()
  WHERE key = p_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_idempotency_key(
  p_key text,
  p_error text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.idempotency_keys
  SET status = 'failed',
      error = p_error,
      completed_at = now()
  WHERE key = p_key;
END;
$$;

-- ================================================================
-- 3. Trade state-machine enforcement
-- ================================================================
CREATE OR REPLACE FUNCTION public.assert_trade_transition(
  p_trade_id uuid,
  p_new_status trade_status
) RETURNS trade_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current trade_status;
  v_allowed boolean := false;
BEGIN
  SELECT status INTO v_current FROM public.trades WHERE id = p_trade_id FOR UPDATE;
  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Trade % not found', p_trade_id USING ERRCODE = 'P0002';
  END IF;
  IF v_current = p_new_status THEN
    -- No-op transition is rejected to prevent double-processing
    RAISE EXCEPTION 'Trade already in status %', v_current USING ERRCODE = 'P0001';
  END IF;

  v_allowed := CASE v_current::text
    WHEN 'pending'      THEN p_new_status::text IN ('confirmed','cancelled','expired')
    WHEN 'confirmed'    THEN p_new_status::text IN ('payment_sent','cancelled','disputed','expired')
    WHEN 'payment_sent' THEN p_new_status::text IN ('completed','disputed')
    WHEN 'disputed'     THEN p_new_status::text IN ('completed','cancelled','resolved')
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid trade transition: % -> %', v_current, p_new_status USING ERRCODE = 'P0001';
  END IF;

  RETURN v_current;
END;
$$;

-- ================================================================
-- 4. credit_deposit: unified atomic deposit credit (used by webhook & sim)
-- ================================================================
CREATE OR REPLACE FUNCTION public.credit_deposit(
  p_user_id uuid,
  p_crypto_type text,
  p_amount numeric,
  p_tx_hash text,
  p_network text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_simulated boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key text;
  v_claim jsonb;
  v_normalized text;
  v_wallet_id uuid;
  v_balance numeric;
  v_response jsonb;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;
  IF p_tx_hash IS NULL OR length(trim(p_tx_hash)) = 0 THEN
    RAISE EXCEPTION 'tx_hash required';
  END IF;

  v_normalized := UPPER(TRIM(p_crypto_type));
  v_key := COALESCE(p_idempotency_key, 'deposit_' || p_tx_hash);

  v_claim := public.claim_idempotency_key(v_key, 'deposit', p_tx_hash, p_user_id);
  IF (v_claim->>'replay')::boolean THEN
    RETURN v_claim->'response' || jsonb_build_object('replay', true);
  END IF;
  IF (v_claim->>'in_progress')::boolean THEN
    RAISE EXCEPTION 'Deposit already in progress' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    -- Get or create the wallet, then lock the row
    v_wallet_id := public.get_or_create_wallet(p_user_id, v_normalized);
    SELECT balance INTO v_balance FROM public.wallets WHERE id = v_wallet_id FOR UPDATE;

    -- Insert tx (unique tx_hash provides a second layer of dedup)
    BEGIN
      INSERT INTO public.wallet_transactions (
        wallet_id, user_id, type, amount, fee, crypto_type, status,
        tx_hash, network, confirmations, description
      ) VALUES (
        v_wallet_id, p_user_id, 'deposit', p_amount, 0, v_normalized, 'confirmed',
        p_tx_hash, p_network, 1,
        CASE WHEN p_simulated THEN '[TEST] Simulated ' ELSE '' END || v_normalized || ' deposit'
      );
    EXCEPTION WHEN unique_violation THEN
      v_response := jsonb_build_object('status', 'duplicate', 'tx_hash', p_tx_hash);
      PERFORM public.complete_idempotency_key(v_key, v_response);
      RETURN v_response || jsonb_build_object('replay', true);
    END;

    UPDATE public.wallets
    SET balance = COALESCE(v_balance, 0) + p_amount, updated_at = now()
    WHERE id = v_wallet_id;

    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (
      p_user_id,
      'Deposit Received',
      p_amount || ' ' || v_normalized || ' has been credited to your wallet.',
      'payment',
      jsonb_build_object(
        'tx_hash', p_tx_hash,
        'amount', p_amount,
        'crypto_type', v_normalized,
        'simulated', p_simulated,
        'idempotency_key', v_key
      )
    );

    v_response := jsonb_build_object(
      'status', 'processed',
      'tx_hash', p_tx_hash,
      'amount', p_amount,
      'crypto_type', v_normalized,
      'wallet_id', v_wallet_id
    );
    PERFORM public.complete_idempotency_key(v_key, v_response);
    RETURN v_response;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.fail_idempotency_key(v_key, SQLERRM);
    RAISE;
  END;
END;
$$;

-- ================================================================
-- 5. Idempotent overloads of existing escrow RPCs
--    (Add new function with extra p_idempotency_key arg; legacy
--     signature still exists so existing callers keep working.)
-- ================================================================

CREATE OR REPLACE FUNCTION public.lock_escrow(
  p_seller_id uuid, p_crypto_type text, p_amount numeric, p_trade_id uuid,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key text;
  v_claim jsonb;
  v_result jsonb;
BEGIN
  v_key := COALESCE(p_idempotency_key, 'escrow_lock_' || p_trade_id::text);
  v_claim := public.claim_idempotency_key(v_key, 'escrow_lock', p_trade_id::text, p_seller_id);
  IF (v_claim->>'replay')::boolean THEN
    RETURN (v_claim->'response') || jsonb_build_object('replay', true);
  END IF;
  IF (v_claim->>'in_progress')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Action already in progress', 'in_progress', true);
  END IF;
  BEGIN
    v_result := public.lock_escrow(p_seller_id, p_crypto_type, p_amount, p_trade_id);
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
  p_trade_id uuid, p_seller_id uuid, p_buyer_id uuid,
  p_crypto_type text, p_escrow_amount numeric,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key text;
  v_claim jsonb;
  v_result jsonb;
BEGIN
  v_key := COALESCE(p_idempotency_key, 'release_' || p_trade_id::text);
  v_claim := public.claim_idempotency_key(v_key, 'release', p_trade_id::text, p_seller_id);
  IF (v_claim->>'replay')::boolean THEN
    RETURN (v_claim->'response') || jsonb_build_object('replay', true);
  END IF;
  IF (v_claim->>'in_progress')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Action already in progress', 'in_progress', true);
  END IF;
  BEGIN
    v_result := public.release_escrow_with_fee(p_trade_id, p_seller_id, p_buyer_id, p_crypto_type, p_escrow_amount);
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
  p_seller_id uuid, p_crypto_type text, p_amount numeric, p_trade_id uuid,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key text;
  v_claim jsonb;
  v_result jsonb;
BEGIN
  v_key := COALESCE(p_idempotency_key, 'refund_' || p_trade_id::text);
  v_claim := public.claim_idempotency_key(v_key, 'refund', p_trade_id::text, p_seller_id);
  IF (v_claim->>'replay')::boolean THEN
    RETURN (v_claim->'response') || jsonb_build_object('replay', true);
  END IF;
  IF (v_claim->>'in_progress')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Action already in progress', 'in_progress', true);
  END IF;
  BEGIN
    v_result := public.return_escrow_with_reservation(p_seller_id, p_crypto_type, p_amount, p_trade_id);
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

-- ================================================================
-- 6. Cleanup function (called by scheduled job, registered separately)
-- ================================================================
CREATE OR REPLACE FUNCTION public.cleanup_idempotency_keys()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.idempotency_keys
  WHERE expires_at < now() AND status <> 'pending';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
