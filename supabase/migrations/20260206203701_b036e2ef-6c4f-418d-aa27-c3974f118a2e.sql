
-- Atomic escrow release with 0.99% seller fee
-- Handles: fee calculation, buyer credit, treasury credit, audit logging
CREATE OR REPLACE FUNCTION public.release_escrow_with_fee(
  p_trade_id UUID,
  p_seller_id UUID,
  p_buyer_id UUID,
  p_crypto_type TEXT,
  p_escrow_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee_rate NUMERIC := 0.0099;
  v_fee_amount NUMERIC;
  v_buyer_amount NUMERIC;
  v_seller_wallet RECORD;
  v_buyer_wallet_id UUID;
  v_normalized_crypto TEXT;
  v_treasury_wallet RECORD;
  v_trade RECORD;
BEGIN
  v_normalized_crypto := UPPER(TRIM(p_crypto_type));
  
  -- Calculate fee deterministically
  v_fee_amount := ROUND(p_escrow_amount * v_fee_rate, 8);
  v_buyer_amount := p_escrow_amount - v_fee_amount;

  -- Validate trade exists and is in correct state
  SELECT * INTO v_trade FROM public.trades 
  WHERE id = p_trade_id AND seller_id = p_seller_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
  END IF;
  
  IF v_trade.status NOT IN ('payment_sent', 'disputed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade is not in a releasable state');
  END IF;

  -- Get seller wallet
  SELECT * INTO v_seller_wallet FROM public.wallets
  WHERE user_id = p_seller_id AND crypto_type = v_normalized_crypto
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seller wallet not found');
  END IF;
  
  -- Verify sufficient locked balance
  IF v_seller_wallet.locked_balance < p_escrow_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient locked balance to cover escrow and fee');
  END IF;

  -- Get or create buyer wallet
  v_buyer_wallet_id := public.get_or_create_wallet(p_buyer_id, v_normalized_crypto);
  IF v_buyer_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Failed to get buyer wallet');
  END IF;

  -- 1. Deduct from seller (both balance and locked_balance by full escrow amount)
  UPDATE public.wallets SET
    balance = balance - p_escrow_amount,
    locked_balance = locked_balance - p_escrow_amount,
    updated_at = now()
  WHERE id = v_seller_wallet.id;

  -- 2. Credit buyer with net amount (escrow minus fee)
  UPDATE public.wallets SET
    balance = balance + v_buyer_amount,
    updated_at = now()
  WHERE id = v_buyer_wallet_id;

  -- 3. Credit platform treasury with fee
  SELECT * INTO v_treasury_wallet FROM public.platform_wallets
  WHERE wallet_type = 'fees' AND crypto_type = v_normalized_crypto
  FOR UPDATE;
  
  IF FOUND THEN
    UPDATE public.platform_wallets SET
      balance = balance + v_fee_amount,
      updated_at = now()
    WHERE id = v_treasury_wallet.id;
    
    -- Log treasury ledger entry
    INSERT INTO public.treasury_ledger (
      platform_wallet_id, ledger_type, amount, crypto_type,
      balance_before, balance_after, trade_id, user_id, description, metadata
    ) VALUES (
      v_treasury_wallet.id, 'fee_collected', v_fee_amount, v_normalized_crypto,
      v_treasury_wallet.balance, v_treasury_wallet.balance + v_fee_amount,
      p_trade_id, p_seller_id,
      'Escrow release fee (0.99%) for trade ' || LEFT(p_trade_id::text, 8),
      jsonb_build_object(
        'fee_rate', v_fee_rate,
        'escrow_amount', p_escrow_amount,
        'buyer_amount', v_buyer_amount,
        'fee_amount', v_fee_amount,
        'buyer_id', p_buyer_id,
        'seller_id', p_seller_id
      )
    );
  ELSE
    -- Create treasury wallet if missing
    INSERT INTO public.platform_wallets (wallet_type, crypto_type, balance, description)
    VALUES ('fees', v_normalized_crypto, v_fee_amount, 'Escrow fee collection wallet');
  END IF;

  -- 4. Log seller transaction (escrow release)
  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, type, amount, crypto_type, status, trade_id, fee, description
  ) VALUES (
    v_seller_wallet.id, p_seller_id, 'escrow_release', -p_escrow_amount, v_normalized_crypto,
    'completed', p_trade_id, v_fee_amount,
    'Escrow released for trade ' || LEFT(p_trade_id::text, 8) || ' (fee: ' || v_fee_amount || ' ' || v_normalized_crypto || ')'
  );

  -- 5. Log buyer transaction (escrow received)
  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, type, amount, crypto_type, status, trade_id, description
  ) VALUES (
    v_buyer_wallet_id, p_buyer_id, 'escrow_release', v_buyer_amount, v_normalized_crypto,
    'completed', p_trade_id,
    'Received ' || v_buyer_amount || ' ' || v_normalized_crypto || ' from trade ' || LEFT(p_trade_id::text, 8)
  );

  -- 6. Log audit trail
  INSERT INTO public.trade_audit_trail (
    trade_id, actor_id, action_type, escrow_amount, platform_fee,
    seller_balance_before, seller_balance_after,
    seller_locked_before, seller_locked_after,
    buyer_balance_before, buyer_balance_after,
    metadata
  ) VALUES (
    p_trade_id, p_seller_id, 'escrow_released_with_fee', p_escrow_amount, v_fee_amount,
    v_seller_wallet.balance, v_seller_wallet.balance - p_escrow_amount,
    v_seller_wallet.locked_balance, v_seller_wallet.locked_balance - p_escrow_amount,
    (SELECT balance FROM public.wallets WHERE id = v_buyer_wallet_id) - v_buyer_amount,
    (SELECT balance FROM public.wallets WHERE id = v_buyer_wallet_id),
    jsonb_build_object(
      'fee_rate', v_fee_rate,
      'fee_amount', v_fee_amount,
      'buyer_net_amount', v_buyer_amount,
      'crypto_type', v_normalized_crypto
    )
  );

  -- 7. Mark trade as completed
  UPDATE public.trades SET
    status = 'completed',
    escrow_released = true,
    completed_at = now(),
    updated_at = now()
  WHERE id = p_trade_id;

  RETURN jsonb_build_object(
    'success', true,
    'fee_amount', v_fee_amount,
    'buyer_amount', v_buyer_amount,
    'escrow_amount', p_escrow_amount,
    'fee_rate', v_fee_rate
  );
END;
$$;
