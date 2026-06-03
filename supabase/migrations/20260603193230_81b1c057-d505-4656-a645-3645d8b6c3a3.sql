
-- Reconciliation runs
CREATE TABLE public.reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running', -- running | ok | drift | error
  total_drift numeric NOT NULL DEFAULT 0,
  notes text,
  triggered_by text NOT NULL DEFAULT 'cron', -- cron | manual
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reconciliation_runs TO authenticated;
GRANT ALL ON public.reconciliation_runs TO service_role;

ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view reconciliation runs"
  ON public.reconciliation_runs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Reconciliation per-crypto results
CREATE TABLE public.reconciliation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.reconciliation_runs(id) ON DELETE CASCADE,
  crypto_type text NOT NULL,
  user_wallet_balance numeric NOT NULL DEFAULT 0,
  user_locked_balance numeric NOT NULL DEFAULT 0,
  reserved_in_offers numeric NOT NULL DEFAULT 0,
  platform_wallet_balance numeric NOT NULL DEFAULT 0,
  total_deposits numeric NOT NULL DEFAULT 0,
  total_withdrawals numeric NOT NULL DEFAULT 0,
  total_fees_collected numeric NOT NULL DEFAULT 0,
  expected_total numeric NOT NULL DEFAULT 0,
  actual_total numeric NOT NULL DEFAULT 0,
  drift numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ok', -- ok | drift
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reconciliation_results TO authenticated;
GRANT ALL ON public.reconciliation_results TO service_role;

ALTER TABLE public.reconciliation_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view reconciliation results"
  ON public.reconciliation_results FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_reconciliation_results_run ON public.reconciliation_results(run_id);
CREATE INDEX idx_reconciliation_runs_started ON public.reconciliation_runs(started_at DESC);

-- Reconciliation function
CREATE OR REPLACE FUNCTION public.run_reconciliation(p_triggered_by text DEFAULT 'cron')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid;
  v_total_drift numeric := 0;
  v_overall_status text := 'ok';
  r record;
BEGIN
  INSERT INTO public.reconciliation_runs (status, triggered_by)
  VALUES ('running', p_triggered_by)
  RETURNING id INTO v_run_id;

  FOR r IN
    WITH cryptos AS (
      SELECT crypto_type FROM public.wallets
      UNION SELECT crypto_type FROM public.platform_wallets
      UNION SELECT crypto_type FROM public.wallet_transactions
    ),
    user_balances AS (
      SELECT crypto_type,
        COALESCE(SUM(balance),0) AS bal,
        COALESCE(SUM(locked_balance),0) AS locked
      FROM public.wallets GROUP BY crypto_type
    ),
    offer_reserved AS (
      SELECT crypto_type, COALESCE(SUM(reserved_amount),0) AS reserved
      FROM public.offers WHERE is_active = true GROUP BY crypto_type
    ),
    platform_bal AS (
      SELECT crypto_type, COALESCE(SUM(balance),0) AS bal
      FROM public.platform_wallets GROUP BY crypto_type
    ),
    deposits AS (
      SELECT crypto_type, COALESCE(SUM(amount),0) AS total
      FROM public.wallet_transactions
      WHERE type::text = 'deposit' AND status = 'completed'
      GROUP BY crypto_type
    ),
    withdrawals AS (
      SELECT crypto_type,
        COALESCE(SUM(amount),0) AS total,
        COALESCE(SUM(fee),0) AS fees
      FROM public.wallet_transactions
      WHERE type::text = 'withdrawal' AND status = 'completed'
      GROUP BY crypto_type
    ),
    fees_collected AS (
      SELECT crypto_type, COALESCE(SUM(amount),0) AS total
      FROM public.treasury_ledger
      WHERE ledger_type = 'fee_collected'
      GROUP BY crypto_type
    )
    SELECT
      c.crypto_type,
      COALESCE(ub.bal,0) AS user_bal,
      COALESCE(ub.locked,0) AS user_locked,
      COALESCE(ofr.reserved,0) AS reserved,
      COALESCE(pb.bal,0) AS platform_bal,
      COALESCE(d.total,0) AS deposits_total,
      COALESCE(w.total,0) AS withdrawals_total,
      COALESCE(fc.total,0) AS fees_total
    FROM cryptos c
    LEFT JOIN user_balances ub USING (crypto_type)
    LEFT JOIN offer_reserved ofr USING (crypto_type)
    LEFT JOIN platform_bal pb USING (crypto_type)
    LEFT JOIN deposits d USING (crypto_type)
    LEFT JOIN withdrawals w USING (crypto_type)
    LEFT JOIN fees_collected fc USING (crypto_type)
  LOOP
    DECLARE
      v_actual numeric;
      v_expected numeric;
      v_drift numeric;
      v_status text;
    BEGIN
      -- Actual = what we are currently holding everywhere
      v_actual := r.user_bal + r.user_locked + r.platform_bal;
      -- Expected = net inflows: deposits - withdrawals (withdrawal amount already excludes fee retained)
      v_expected := r.deposits_total - r.withdrawals_total;
      v_drift := v_actual - v_expected;
      v_status := CASE WHEN abs(v_drift) < 0.00000001 THEN 'ok' ELSE 'drift' END;

      INSERT INTO public.reconciliation_results (
        run_id, crypto_type,
        user_wallet_balance, user_locked_balance, reserved_in_offers,
        platform_wallet_balance, total_deposits, total_withdrawals, total_fees_collected,
        expected_total, actual_total, drift, status
      ) VALUES (
        v_run_id, r.crypto_type,
        r.user_bal, r.user_locked, r.reserved,
        r.platform_bal, r.deposits_total, r.withdrawals_total, r.fees_total,
        v_expected, v_actual, v_drift, v_status
      );

      v_total_drift := v_total_drift + abs(v_drift);
      IF v_status = 'drift' THEN v_overall_status := 'drift'; END IF;
    END;
  END LOOP;

  UPDATE public.reconciliation_runs
  SET finished_at = now(),
      status = v_overall_status,
      total_drift = v_total_drift
  WHERE id = v_run_id;

  RETURN v_run_id;
EXCEPTION WHEN OTHERS THEN
  UPDATE public.reconciliation_runs
  SET finished_at = now(), status = 'error', notes = SQLERRM
  WHERE id = v_run_id;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.run_reconciliation(text) FROM public;
GRANT EXECUTE ON FUNCTION public.run_reconciliation(text) TO service_role;

-- Admin manual trigger wrapper
CREATE OR REPLACE FUNCTION public.admin_run_reconciliation()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can trigger reconciliation';
  END IF;
  RETURN public.run_reconciliation('manual');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_run_reconciliation() TO authenticated;
