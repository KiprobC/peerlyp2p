-- Add reserved_amount column to offers table
ALTER TABLE public.offers 
ADD COLUMN IF NOT EXISTS reserved_amount numeric NOT NULL DEFAULT 0;

-- Add a check constraint to ensure reserved_amount is non-negative
ALTER TABLE public.offers 
ADD CONSTRAINT offers_reserved_amount_non_negative CHECK (reserved_amount >= 0);

-- Add a check constraint to ensure reserved_amount doesn't exceed crypto_amount
ALTER TABLE public.offers 
ADD CONSTRAINT offers_reserved_not_exceeds_total CHECK (reserved_amount <= crypto_amount);

-- Create index for efficient queries on active offers with available balance
CREATE INDEX IF NOT EXISTS idx_offers_available_balance 
ON public.offers ((crypto_amount - reserved_amount)) 
WHERE is_active = true;

-- Update lock_escrow to handle missing reserved_amount gracefully
CREATE OR REPLACE FUNCTION public.lock_escrow(
  p_seller_id uuid, 
  p_crypto_type text, 
  p_amount numeric, 
  p_trade_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  wallet_record RECORD;
  normalized_crypto TEXT;
  trade_record RECORD;
  offer_record RECORD;
  current_reserved numeric;
BEGIN
  normalized_crypto := UPPER(TRIM(p_crypto_type));

  -- Get the trade to find the offer
  SELECT * INTO trade_record FROM trades WHERE id = p_trade_id;
  
  IF trade_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
  END IF;

  -- Get the offer with explicit column selection
  SELECT id, user_id, type, crypto_amount, COALESCE(reserved_amount, 0) as reserved_amount, is_active
  INTO offer_record 
  FROM offers 
  WHERE id = trade_record.offer_id;

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

  -- For sell offers, validate against available balance (not reserved)
  IF offer_record IS NOT NULL AND offer_record.type = 'sell' THEN
    current_reserved := COALESCE(offer_record.reserved_amount, 0);
    
    -- Check if offer has sufficient available amount
    IF p_amount > (offer_record.crypto_amount - current_reserved) THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', format('Trade amount %s exceeds available offer amount %s', 
          p_amount, offer_record.crypto_amount - current_reserved)
      );
    END IF;
  END IF;

  -- Check wallet available balance (not already locked)
  IF (wallet_record.balance - wallet_record.locked_balance) < p_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('Insufficient available balance. Available: %s, Required: %s', 
        wallet_record.balance - wallet_record.locked_balance, p_amount),
      'available', wallet_record.balance - wallet_record.locked_balance
    );
  END IF;

  -- Lock the funds in wallet
  UPDATE wallets
  SET locked_balance = locked_balance + p_amount,
      updated_at = NOW()
  WHERE id = wallet_record.id;

  -- Increase reserved amount on the offer (funds are now committed to this trade)
  IF offer_record IS NOT NULL AND offer_record.type = 'sell' THEN
    UPDATE offers
    SET reserved_amount = COALESCE(reserved_amount, 0) + p_amount,
        updated_at = NOW()
    WHERE id = offer_record.id;
    
    -- Auto-deactivate offer if fully reserved
    UPDATE offers
    SET is_active = false
    WHERE id = offer_record.id
      AND reserved_amount >= crypto_amount;
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
$function$;

-- Create or replace return_escrow_with_reservation function
CREATE OR REPLACE FUNCTION public.return_escrow_with_reservation(
  p_seller_id uuid,
  p_crypto_type text,
  p_amount numeric,
  p_trade_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Get wallet
  SELECT * INTO wallet_record
  FROM wallets
  WHERE user_id = p_seller_id AND crypto_type = normalized_crypto;

  IF wallet_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Unlock the funds from wallet
  UPDATE wallets
  SET locked_balance = GREATEST(0, locked_balance - p_amount),
      updated_at = NOW()
  WHERE id = wallet_record.id;

  -- Decrease reserved amount on the offer (funds returned to available pool)
  IF offer_record IS NOT NULL AND offer_record.type = 'sell' THEN
    UPDATE offers
    SET reserved_amount = GREATEST(0, COALESCE(reserved_amount, 0) - p_amount),
        is_active = CASE 
          WHEN GREATEST(0, COALESCE(reserved_amount, 0) - p_amount) < crypto_amount 
          THEN true 
          ELSE is_active 
        END,
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
    'escrow_release',
    p_amount,
    normalized_crypto,
    'completed',
    p_trade_id,
    format('Escrow returned for cancelled trade %s', LEFT(p_trade_id::text, 8))
  );

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- Update create_sell_offer_with_reservation to set initial reserved_amount
CREATE OR REPLACE FUNCTION public.create_sell_offer_with_reservation(
  p_user_id uuid,
  p_crypto_type text,
  p_crypto_amount numeric,
  p_fiat_currency text,
  p_price_per_unit numeric,
  p_price_margin numeric,
  p_min_amount numeric,
  p_max_amount numeric,
  p_payment_methods text[],
  p_terms text,
  p_time_limit integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  wallet_record RECORD;
  normalized_crypto TEXT;
  available_balance NUMERIC;
  new_offer_id UUID;
BEGIN
  normalized_crypto := UPPER(TRIM(p_crypto_type));

  -- Get wallet
  SELECT * INTO wallet_record
  FROM wallets
  WHERE user_id = p_user_id AND crypto_type = normalized_crypto;

  IF wallet_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found for this crypto type');
  END IF;

  -- Calculate available balance (total - locked - already reserved in other offers)
  SELECT COALESCE(wallet_record.balance - wallet_record.locked_balance - 
    COALESCE(SUM(o.crypto_amount), 0), 0)
  INTO available_balance
  FROM offers o
  WHERE o.user_id = p_user_id 
    AND o.crypto_type = normalized_crypto 
    AND o.type = 'sell' 
    AND o.is_active = true;

  -- Check if user has sufficient available balance
  IF available_balance < p_crypto_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('Insufficient available balance. Available: %s %s, Required: %s %s', 
        available_balance, normalized_crypto, p_crypto_amount, normalized_crypto)
    );
  END IF;

  -- Create the offer with reserved_amount = 0 (no trades yet)
  INSERT INTO offers (
    user_id,
    type,
    crypto_type,
    crypto_amount,
    fiat_currency,
    price_per_unit,
    price_margin,
    min_amount,
    max_amount,
    payment_methods,
    terms,
    time_limit,
    is_active,
    reserved_amount
  ) VALUES (
    p_user_id,
    'sell',
    normalized_crypto,
    p_crypto_amount,
    p_fiat_currency,
    p_price_per_unit,
    p_price_margin,
    p_min_amount,
    p_max_amount,
    p_payment_methods,
    p_terms,
    p_time_limit,
    true,
    0
  )
  RETURNING id INTO new_offer_id;

  RETURN jsonb_build_object('success', true, 'offer_id', new_offer_id);
END;
$function$;

-- Update get_available_balance to account for reserved amounts
CREATE OR REPLACE FUNCTION public.get_available_balance(p_user_id uuid, p_crypto_type text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  wallet_record RECORD;
  normalized_crypto TEXT;
  total_reserved_in_offers NUMERIC;
  available NUMERIC;
BEGIN
  normalized_crypto := UPPER(TRIM(p_crypto_type));

  -- Get wallet
  SELECT * INTO wallet_record
  FROM wallets
  WHERE user_id = p_user_id AND crypto_type = normalized_crypto;

  IF wallet_record IS NULL THEN
    RETURN 0;
  END IF;

  -- Calculate total reserved in active sell offers (crypto_amount - reserved_amount already in trades)
  SELECT COALESCE(SUM(crypto_amount - COALESCE(reserved_amount, 0)), 0)
  INTO total_reserved_in_offers
  FROM offers
  WHERE user_id = p_user_id 
    AND crypto_type = normalized_crypto 
    AND type = 'sell' 
    AND is_active = true;

  -- Available = wallet balance - locked in escrow - reserved in offers
  available := wallet_record.balance - wallet_record.locked_balance - total_reserved_in_offers;
  
  RETURN GREATEST(0, available);
END;
$function$;