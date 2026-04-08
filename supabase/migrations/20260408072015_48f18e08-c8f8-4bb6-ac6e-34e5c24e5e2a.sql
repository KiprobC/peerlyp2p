
-- Add tx_hash column to wallet_transactions if not exists, with unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'wallet_transactions' AND column_name = 'tx_hash'
  ) THEN
    ALTER TABLE public.wallet_transactions ADD COLUMN tx_hash text;
  END IF;
END $$;

-- Create unique index on tx_hash (partial - only non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_tx_hash_unique 
ON public.wallet_transactions (tx_hash) WHERE tx_hash IS NOT NULL;

-- Add network column to wallet_transactions if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'wallet_transactions' AND column_name = 'network'
  ) THEN
    ALTER TABLE public.wallet_transactions ADD COLUMN network text;
  END IF;
END $$;

-- Add confirmations column 
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'wallet_transactions' AND column_name = 'confirmations'
  ) THEN
    ALTER TABLE public.wallet_transactions ADD COLUMN confirmations integer DEFAULT 0;
  END IF;
END $$;
