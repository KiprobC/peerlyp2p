-- Create the get_available_balance function that calculates available balance for a user
-- Available = Total Balance - Locked Balance - Reserved in Active Sell Offers

CREATE OR REPLACE FUNCTION public.get_available_balance(
  p_user_id uuid,
  p_crypto_type text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_balance numeric := 0;
  v_locked_balance numeric := 0;
  v_reserved_in_offers numeric := 0;
  v_available numeric := 0;
BEGIN
  -- Get wallet balance
  SELECT COALESCE(balance, 0), COALESCE(locked_balance, 0)
  INTO v_total_balance, v_locked_balance
  FROM wallets
  WHERE user_id = p_user_id AND crypto_type = p_crypto_type;

  -- Get total reserved in active sell offers
  SELECT COALESCE(SUM(crypto_amount), 0)
  INTO v_reserved_in_offers
  FROM offers
  WHERE user_id = p_user_id 
    AND crypto_type = p_crypto_type 
    AND type = 'sell' 
    AND is_active = true;

  -- Calculate available balance
  v_available := v_total_balance - v_locked_balance - v_reserved_in_offers;
  
  -- Ensure non-negative
  IF v_available < 0 THEN
    v_available := 0;
  END IF;

  RETURN v_available;
END;
$$;