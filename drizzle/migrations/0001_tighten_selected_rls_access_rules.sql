DROP POLICY IF EXISTS "Signed-in users can read country risk settings" ON public.country_risk_settings;
DROP POLICY IF EXISTS "Signed-in users can read platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Signed-in users can read payment restrictions" ON public.payment_method_restrictions;

CREATE POLICY "Admins can read platform settings"
  ON public.platform_settings
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Anyone can submit a recovery request" ON public.account_recovery_requests;
CREATE POLICY "Anyone can submit a recovery request"
  ON public.account_recovery_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    user_id IS NULL
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND admin_notes IS NULL
    AND mfa_removed_at IS NULL
    AND mfa_removed_by IS NULL
    AND attachments = '{}'::text[]
    AND length(btrim(username)) BETWEEN 3 AND 30
    AND username ~ '^[A-Za-z0-9_]+$'
    AND length(btrim(email)) BETWEEN 3 AND 254
    AND email ~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    AND length(btrim(explanation)) BETWEEN 20 AND 1000
  );