
-- ============ MFA recovery codes ============
CREATE TABLE IF NOT EXISTS public.mfa_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mfa_recovery_codes_user ON public.mfa_recovery_codes(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mfa_recovery_codes_user_hash ON public.mfa_recovery_codes(user_id, code_hash);

GRANT SELECT ON public.mfa_recovery_codes TO authenticated;
GRANT ALL ON public.mfa_recovery_codes TO service_role;

ALTER TABLE public.mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own recovery code metadata" ON public.mfa_recovery_codes;
CREATE POLICY "Users can view their own recovery code metadata"
  ON public.mfa_recovery_codes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Regenerate a fresh set of 10 codes (server-side hashing, plaintext never stored)
CREATE OR REPLACE FUNCTION public.regenerate_recovery_codes(p_codes text[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_code text;
  v_count integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_codes IS NULL OR array_length(p_codes, 1) IS NULL THEN
    RAISE EXCEPTION 'No codes supplied';
  END IF;

  DELETE FROM public.mfa_recovery_codes WHERE user_id = v_user;

  FOREACH v_code IN ARRAY p_codes LOOP
    INSERT INTO public.mfa_recovery_codes (user_id, code_hash)
    VALUES (v_user, encode(extensions.digest(upper(trim(v_code)), 'sha256'), 'hex'))
    ON CONFLICT (user_id, code_hash) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.regenerate_recovery_codes(text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.regenerate_recovery_codes(text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.count_unused_recovery_codes()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.mfa_recovery_codes
  WHERE user_id = auth.uid() AND used_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.count_unused_recovery_codes() FROM public;
GRANT EXECUTE ON FUNCTION public.count_unused_recovery_codes() TO authenticated;

-- Redeem: validates a code, invalidates the whole remaining set, disables the 2FA preference.
CREATE OR REPLACE FUNCTION public.redeem_recovery_code(p_user_id uuid, p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash text := encode(extensions.digest(upper(trim(p_code)), 'sha256'), 'hex');
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM public.mfa_recovery_codes
  WHERE user_id = p_user_id AND code_hash = v_hash AND used_at IS NULL
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN false;
  END IF;

  -- one-time use, then the entire remaining set is invalidated
  UPDATE public.mfa_recovery_codes SET used_at = now() WHERE id = v_id;
  DELETE FROM public.mfa_recovery_codes WHERE user_id = p_user_id AND used_at IS NULL;

  UPDATE public.user_settings SET two_factor_enabled = false WHERE user_id = p_user_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_recovery_code(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.redeem_recovery_code(uuid, text) TO service_role;

-- ============ Account recovery requests ============
CREATE TABLE IF NOT EXISTS public.account_recovery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  username text NOT NULL,
  email text NOT NULL,
  explanation text NOT NULL,
  attachments text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_recovery_requests_status
  ON public.account_recovery_requests(status, created_at DESC);

GRANT INSERT ON public.account_recovery_requests TO anon, authenticated;
GRANT SELECT, UPDATE ON public.account_recovery_requests TO authenticated;
GRANT ALL ON public.account_recovery_requests TO service_role;

ALTER TABLE public.account_recovery_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit a recovery request" ON public.account_recovery_requests;
CREATE POLICY "Anyone can submit a recovery request"
  ON public.account_recovery_requests FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can view recovery requests" ON public.account_recovery_requests;
CREATE POLICY "Staff can view recovery requests"
  ON public.account_recovery_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "Staff can update recovery requests" ON public.account_recovery_requests;
CREATE POLICY "Staff can update recovery requests"
  ON public.account_recovery_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
