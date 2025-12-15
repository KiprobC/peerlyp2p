-- Add SECURITY DEFINER escrow lock function to avoid RLS issues when buyer opens a trade

CREATE OR REPLACE FUNCTION public.lock_escrow(
  p_seller_id uuid,
  p_crypto_type text,
  p_amount numeric,
  p_trade_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id uuid;
  v_balance numeric;
  v_locked numeric;
  v_available numeric;
  v_crypto text;
BEGIN
  v_crypto := UPPER(BTRIM(p_crypto_type));

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  -- Always ensure wallet exists (bypasses RLS via SECURITY DEFINER)
  v_wallet_id := public.get_or_create_wallet(p_seller_id, v_crypto);

  SELECT balance, locked_balance
  INTO v_balance, v_locked
  FROM public.wallets
  WHERE id = v_wallet_id;

  v_available := COALESCE(v_balance, 0) - COALESCE(v_locked, 0);

  IF v_available < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Insufficient balance. Available: %s %s, Required: %s %s', v_available, v_crypto, p_amount, v_crypto)
    );
  END IF;

  UPDATE public.wallets
  SET locked_balance = COALESCE(locked_balance, 0) + p_amount,
      updated_at = now()
  WHERE id = v_wallet_id;

  INSERT INTO public.wallet_transactions (
    wallet_id,
    user_id,
    type,
    amount,
    crypto_type,
    status,
    trade_id,
    description
  ) VALUES (
    v_wallet_id,
    p_seller_id,
    'escrow_lock'::transaction_type,
    p_amount,
    v_crypto,
    'completed',
    p_trade_id,
    CASE WHEN p_trade_id IS NULL THEN 'Escrow locked' ELSE format('Escrow locked for trade %s', left(p_trade_id::text, 8)) END
  );

  RETURN jsonb_build_object('success', true, 'wallet_id', v_wallet_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.lock_escrow(uuid, text, numeric, uuid) TO authenticated;
