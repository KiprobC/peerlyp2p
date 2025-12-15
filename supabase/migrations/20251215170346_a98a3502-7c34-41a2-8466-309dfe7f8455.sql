-- Function to credit buyer wallet (bypasses RLS)
CREATE OR REPLACE FUNCTION public.credit_buyer_wallet(p_wallet_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE wallets
  SET balance = balance + p_amount,
      updated_at = now()
  WHERE id = p_wallet_id;
END;
$$;

-- Function to log buyer transaction (bypasses RLS)
CREATE OR REPLACE FUNCTION public.log_buyer_transaction(
  p_wallet_id uuid,
  p_user_id uuid,
  p_amount numeric,
  p_crypto_type text,
  p_trade_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
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
    p_wallet_id,
    p_user_id,
    'trade'::transaction_type,
    p_amount,
    UPPER(BTRIM(p_crypto_type)),
    'completed',
    p_trade_id,
    format('Received from trade %s', left(p_trade_id::text, 8))
  );
END;
$$;