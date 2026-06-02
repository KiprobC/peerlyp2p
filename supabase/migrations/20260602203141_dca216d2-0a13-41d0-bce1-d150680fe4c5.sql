
-- =========================================================================
-- PHASE 1 — Financial Safety hardening
-- =========================================================================

-- 1) Webhook replay protection ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    text NOT NULL,
  payload_hash text NOT NULL,
  signature   text,
  received_at timestamptz NOT NULL DEFAULT now(),
  source_ts   timestamptz,
  status      text NOT NULL DEFAULT 'accepted',
  reason      text,
  payload     jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_payload_hash_provider_idx
  ON public.webhook_events (provider, payload_hash);

CREATE INDEX IF NOT EXISTS webhook_events_received_at_idx
  ON public.webhook_events (received_at DESC);

GRANT SELECT ON public.webhook_events TO authenticated;
GRANT ALL    ON public.webhook_events TO service_role;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view webhook events"
  ON public.webhook_events
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Helper: returns true if event was fresh & recorded, false if rejected.
CREATE OR REPLACE FUNCTION public.record_webhook_event(
  p_provider text,
  p_payload_hash text,
  p_signature text,
  p_source_ts timestamptz,
  p_payload jsonb,
  p_max_age_seconds integer DEFAULT 600
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text;
BEGIN
  IF p_source_ts IS NOT NULL AND p_source_ts < now() - make_interval(secs => p_max_age_seconds) THEN
    v_reason := 'stale';
    INSERT INTO public.webhook_events(provider, payload_hash, signature, source_ts, status, reason, payload)
    VALUES (p_provider, p_payload_hash || ':' || extract(epoch from now())::text,
            p_signature, p_source_ts, 'rejected', v_reason, p_payload);
    RETURN jsonb_build_object('accepted', false, 'reason', v_reason);
  END IF;

  BEGIN
    INSERT INTO public.webhook_events(provider, payload_hash, signature, source_ts, status, payload)
    VALUES (p_provider, p_payload_hash, p_signature, p_source_ts, 'accepted', p_payload);
    RETURN jsonb_build_object('accepted', true);
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO public.webhook_events(provider, payload_hash, signature, source_ts, status, reason, payload)
    VALUES (p_provider, p_payload_hash || ':replay:' || extract(epoch from now())::text,
            p_signature, p_source_ts, 'rejected', 'replay', p_payload);
    RETURN jsonb_build_object('accepted', false, 'reason', 'replay');
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_webhook_event(text,text,text,timestamptz,jsonb,integer) TO service_role;


-- 2) Idempotent + row-locked internal transfer -----------------------------
CREATE OR REPLACE FUNCTION public.execute_internal_transfer(
  p_recipient_username text,
  p_crypto_type text,
  p_amount numeric,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_claim jsonb;
  v_sender_id uuid;
  v_sender_username text;
  v_recipient_id uuid;
  v_sender_wallet_id uuid;
  v_recipient_wallet_id uuid;
  v_sender_bal numeric;
  v_sender_locked numeric;
  v_crypto text;
  v_transfer_id uuid;
  v_response jsonb;
BEGIN
  v_sender_id := auth.uid();
  IF v_sender_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  v_crypto := UPPER(BTRIM(p_crypto_type));
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  v_key := COALESCE(NULLIF(BTRIM(p_idempotency_key), ''), 'transfer_' || v_sender_id::text || '_' || extract(epoch from now())::text);
  v_claim := public.claim_idempotency_key(v_key, 'internal_transfer', NULL, v_sender_id);
  IF (v_claim->>'replay')::boolean THEN
    RETURN (v_claim->'response') || jsonb_build_object('replay', true);
  END IF;
  IF (v_claim->>'in_progress')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transfer already in progress', 'in_progress', true);
  END IF;

  BEGIN
    IF EXISTS (SELECT 1 FROM public.user_transfer_freeze WHERE user_id = v_sender_id) THEN
      v_response := jsonb_build_object('success', false, 'error', 'Your transfers are currently frozen. Contact support.');
      PERFORM public.fail_idempotency_key(v_key, v_response->>'error');
      RETURN v_response;
    END IF;

    SELECT username INTO v_sender_username FROM public.profiles WHERE user_id = v_sender_id;
    SELECT user_id INTO v_recipient_id FROM public.profiles
      WHERE LOWER(username) = LOWER(BTRIM(p_recipient_username));

    IF v_recipient_id IS NULL THEN
      v_response := jsonb_build_object('success', false, 'error', 'Username not found');
      PERFORM public.fail_idempotency_key(v_key, v_response->>'error');
      RETURN v_response;
    END IF;

    IF v_sender_id = v_recipient_id THEN
      v_response := jsonb_build_object('success', false, 'error', 'Cannot transfer to yourself');
      PERFORM public.fail_idempotency_key(v_key, v_response->>'error');
      RETURN v_response;
    END IF;

    IF EXISTS (SELECT 1 FROM public.user_transfer_freeze WHERE user_id = v_recipient_id) THEN
      v_response := jsonb_build_object('success', false, 'error', 'Recipient cannot receive transfers at this time');
      PERFORM public.fail_idempotency_key(v_key, v_response->>'error');
      RETURN v_response;
    END IF;

    v_sender_wallet_id    := public.get_or_create_wallet(v_sender_id,    v_crypto);
    v_recipient_wallet_id := public.get_or_create_wallet(v_recipient_id, v_crypto);

    -- Lock both wallets in deterministic order to avoid deadlocks.
    IF v_sender_wallet_id < v_recipient_wallet_id THEN
      SELECT balance, locked_balance INTO v_sender_bal, v_sender_locked
        FROM public.wallets WHERE id = v_sender_wallet_id FOR UPDATE;
      PERFORM 1 FROM public.wallets WHERE id = v_recipient_wallet_id FOR UPDATE;
    ELSE
      PERFORM 1 FROM public.wallets WHERE id = v_recipient_wallet_id FOR UPDATE;
      SELECT balance, locked_balance INTO v_sender_bal, v_sender_locked
        FROM public.wallets WHERE id = v_sender_wallet_id FOR UPDATE;
    END IF;

    IF COALESCE(v_sender_bal,0) - COALESCE(v_sender_locked,0) < p_amount THEN
      v_response := jsonb_build_object('success', false, 'error',
        format('Insufficient balance. Available: %s %s',
               COALESCE(v_sender_bal,0) - COALESCE(v_sender_locked,0), v_crypto));
      PERFORM public.fail_idempotency_key(v_key, v_response->>'error');
      RETURN v_response;
    END IF;

    UPDATE public.wallets SET balance = balance - p_amount, updated_at = now()
      WHERE id = v_sender_wallet_id;
    UPDATE public.wallets SET balance = balance + p_amount, updated_at = now()
      WHERE id = v_recipient_wallet_id;

    SELECT username INTO v_sender_username FROM public.profiles WHERE user_id = v_sender_id;

    INSERT INTO public.internal_transfers(
      sender_id, recipient_id, sender_username, recipient_username,
      crypto_type, amount, status
    ) VALUES (
      v_sender_id, v_recipient_id, COALESCE(v_sender_username,'unknown'),
      LOWER(BTRIM(p_recipient_username)), v_crypto, p_amount, 'completed'
    ) RETURNING id INTO v_transfer_id;

    v_response := jsonb_build_object(
      'success', true,
      'transfer_id', v_transfer_id,
      'amount', p_amount,
      'crypto_type', v_crypto
    );
    PERFORM public.complete_idempotency_key(v_key, v_response);
    RETURN v_response;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.fail_idempotency_key(v_key, SQLERRM);
    RAISE;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_internal_transfer(text,text,numeric,text) TO authenticated;

-- 3) Idempotent withdrawal claim helper for edge function ------------------
-- The tatum-send-usdt edge fn must call claim_idempotency_key/complete around
-- the on-chain transfer. Grant execute to service_role (already SECURITY DEFINER).
GRANT EXECUTE ON FUNCTION public.claim_idempotency_key(text,text,text,uuid)  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_idempotency_key(text,jsonb)        TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_idempotency_key(text,text)             TO service_role;
