-- Drop the existing lock_escrow function first
DROP FUNCTION IF EXISTS public.lock_escrow(UUID, TEXT, NUMERIC, UUID);

-- Enhanced lock_escrow that reduces reservation when trade is created
CREATE OR REPLACE FUNCTION public.lock_escrow(
  p_seller_id UUID,
  p_crypto_type TEXT,
  p_amount NUMERIC,
  p_trade_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wallet_record RECORD;
  normalized_crypto TEXT;
  trade_record RECORD;
  offer_record RECORD;
BEGIN
  normalized_crypto := UPPER(TRIM(p_crypto_type));

  -- Get the trade to find the offer
  SELECT * INTO trade_record FROM trades WHERE id = p_trade_id;
  
  IF trade_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
  END IF;

  -- Get the offer
  SELECT * INTO offer_record FROM offers WHERE id = trade_record.offer_id;

  -- Get or create wallet
  SELECT * INTO wallet_record
  FROM wallets
  WHERE user_id = p_seller_id AND crypto_type = normalized_crypto;

  IF wallet_record IS NULL THEN
    -- Create wallet if doesn't exist
    INSERT INTO wallets (user_id, crypto_type, balance, locked_balance)
    VALUES (p_seller_id, normalized_crypto, 0, 0)
    RETURNING * INTO wallet_record;
  END IF;

  -- For sell offers, validate against reserved amount
  IF offer_record IS NOT NULL AND offer_record.type = 'sell' THEN
    -- Check if trade amount can be covered
    IF p_amount > offer_record.reserved_amount THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', format('Trade amount %s exceeds reserved offer amount %s', p_amount, offer_record.reserved_amount)
      );
    END IF;
  END IF;

  -- Check available balance (not already locked)
  IF (wallet_record.balance - wallet_record.locked_balance) < p_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('Insufficient available balance. Available: %s, Required: %s', 
        wallet_record.balance - wallet_record.locked_balance, p_amount),
      'available', wallet_record.balance - wallet_record.locked_balance
    );
  END IF;

  -- Lock the funds
  UPDATE wallets
  SET locked_balance = locked_balance + p_amount,
      updated_at = NOW()
  WHERE id = wallet_record.id;

  -- Reduce reserved amount on the offer (funds moved from reserved to locked)
  IF offer_record IS NOT NULL AND offer_record.type = 'sell' THEN
    UPDATE offers
    SET reserved_amount = GREATEST(0, reserved_amount - p_amount),
        updated_at = NOW()
    WHERE id = offer_record.id;
  END IF;

  -- Log the transaction
  INSERT INTO wallet_transactions (
    wallet_id,
    user_id,
    type,
    amount,
    crypto_type,
    status,
    trade_id,
    description
  ) VALUES (
    wallet_record.id,
    p_seller_id,
    'escrow_lock',
    p_amount,
    normalized_crypto,
    'completed',
    p_trade_id,
    format('Escrow locked for trade %s', LEFT(p_trade_id::text, 8))
  );

  RETURN jsonb_build_object('success', true, 'wallet_id', wallet_record.id);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.lock_escrow TO authenticated;