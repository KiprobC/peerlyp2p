-- NOTE: Previous migration failed with: "ERROR:  42883: function min(uuid) does not exist".

-- 1) Normalize existing crypto_type values to uppercase across relevant tables
UPDATE public.wallets SET crypto_type = UPPER(BTRIM(crypto_type)) WHERE crypto_type IS NOT NULL;
UPDATE public.wallet_transactions SET crypto_type = UPPER(BTRIM(crypto_type)) WHERE crypto_type IS NOT NULL;
UPDATE public.offers SET crypto_type = UPPER(BTRIM(crypto_type)) WHERE crypto_type IS NOT NULL;
UPDATE public.trades SET crypto_type = UPPER(BTRIM(crypto_type)) WHERE crypto_type IS NOT NULL;

-- 2) Deduplicate wallets per (user_id, crypto_type) BEFORE adding unique constraint
WITH normalized AS (
  SELECT id, user_id, UPPER(BTRIM(crypto_type)) AS crypto_type_norm, balance, locked_balance
  FROM public.wallets
),
agg AS (
  SELECT
    user_id,
    crypto_type_norm,
    (ARRAY_AGG(id ORDER BY id::text))[1] AS keep_id,
    SUM(balance) AS sum_balance,
    SUM(locked_balance) AS sum_locked
  FROM normalized
  GROUP BY user_id, crypto_type_norm
  HAVING COUNT(*) > 1
),
dups AS (
  SELECT n.id AS dup_id, a.keep_id
  FROM normalized n
  JOIN agg a
    ON a.user_id = n.user_id
   AND a.crypto_type_norm = n.crypto_type_norm
  WHERE n.id <> a.keep_id
)
UPDATE public.wallet_transactions wt
SET wallet_id = d.keep_id
FROM dups d
WHERE wt.wallet_id = d.dup_id;

WITH normalized AS (
  SELECT id, user_id, UPPER(BTRIM(crypto_type)) AS crypto_type_norm, balance, locked_balance
  FROM public.wallets
),
agg AS (
  SELECT
    user_id,
    crypto_type_norm,
    (ARRAY_AGG(id ORDER BY id::text))[1] AS keep_id,
    SUM(balance) AS sum_balance,
    SUM(locked_balance) AS sum_locked
  FROM normalized
  GROUP BY user_id, crypto_type_norm
)
UPDATE public.wallets w
SET crypto_type = agg.crypto_type_norm,
    balance = agg.sum_balance,
    locked_balance = agg.sum_locked
FROM agg
WHERE w.id = agg.keep_id;

WITH normalized AS (
  SELECT id, user_id, UPPER(BTRIM(crypto_type)) AS crypto_type_norm
  FROM public.wallets
),
agg AS (
  SELECT
    user_id,
    crypto_type_norm,
    (ARRAY_AGG(id ORDER BY id::text))[1] AS keep_id
  FROM normalized
  GROUP BY user_id, crypto_type_norm
  HAVING COUNT(*) > 1
)
DELETE FROM public.wallets w
USING normalized n
JOIN agg a
  ON a.user_id = n.user_id
 AND a.crypto_type_norm = n.crypto_type_norm
WHERE w.id = n.id
  AND w.id <> a.keep_id;

-- 3) Enforce one wallet per user per currency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wallets_user_crypto_unique'
      AND conrelid = 'public.wallets'::regclass
  ) THEN
    ALTER TABLE public.wallets
      ADD CONSTRAINT wallets_user_crypto_unique UNIQUE (user_id, crypto_type);
  END IF;
END $$;

-- 4) Normalize crypto_type on write via triggers
CREATE OR REPLACE FUNCTION public.normalize_crypto_type_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.crypto_type IS NOT NULL THEN
    NEW.crypto_type := UPPER(BTRIM(NEW.crypto_type));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wallets_normalize_crypto_type ON public.wallets;
CREATE TRIGGER trg_wallets_normalize_crypto_type
BEFORE INSERT OR UPDATE ON public.wallets
FOR EACH ROW
EXECUTE FUNCTION public.normalize_crypto_type_column();

DROP TRIGGER IF EXISTS trg_wallet_transactions_normalize_crypto_type ON public.wallet_transactions;
CREATE TRIGGER trg_wallet_transactions_normalize_crypto_type
BEFORE INSERT OR UPDATE ON public.wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION public.normalize_crypto_type_column();

DROP TRIGGER IF EXISTS trg_offers_normalize_crypto_type ON public.offers;
CREATE TRIGGER trg_offers_normalize_crypto_type
BEFORE INSERT OR UPDATE ON public.offers
FOR EACH ROW
EXECUTE FUNCTION public.normalize_crypto_type_column();

DROP TRIGGER IF EXISTS trg_trades_normalize_crypto_type ON public.trades;
CREATE TRIGGER trg_trades_normalize_crypto_type
BEFORE INSERT OR UPDATE ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.normalize_crypto_type_column();
