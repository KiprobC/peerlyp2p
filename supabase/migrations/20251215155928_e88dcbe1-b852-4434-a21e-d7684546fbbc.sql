-- Create a SECURITY DEFINER function to get or create a wallet
-- This bypasses RLS and ensures wallets can always be created when needed
CREATE OR REPLACE FUNCTION public.get_or_create_wallet(
  p_user_id UUID,
  p_crypto_type TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_normalized_crypto TEXT;
BEGIN
  -- Normalize crypto type to uppercase
  v_normalized_crypto := UPPER(BTRIM(p_crypto_type));
  
  -- Try to find existing wallet
  SELECT id INTO v_wallet_id
  FROM wallets
  WHERE user_id = p_user_id AND crypto_type = v_normalized_crypto;
  
  -- If not found, create it
  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, crypto_type, balance, locked_balance)
    VALUES (p_user_id, v_normalized_crypto, 0, 0)
    ON CONFLICT (user_id, crypto_type) DO UPDATE SET updated_at = now()
    RETURNING id INTO v_wallet_id;
  END IF;
  
  RETURN v_wallet_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_or_create_wallet(UUID, TEXT) TO authenticated;