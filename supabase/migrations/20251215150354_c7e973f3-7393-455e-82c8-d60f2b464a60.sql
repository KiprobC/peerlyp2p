-- Add unique constraint on wallets to prevent duplicates
ALTER TABLE public.wallets 
ADD CONSTRAINT wallets_user_crypto_unique UNIQUE (user_id, crypto_type);

-- Add unique constraint to prevent duplicate trades from same offer by same buyer
CREATE UNIQUE INDEX IF NOT EXISTS trades_offer_buyer_status_idx 
ON public.trades (offer_id, buyer_id) 
WHERE status NOT IN ('completed', 'cancelled');