CREATE OR REPLACE FUNCTION public.is_service_context()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  BEGIN
    v_role := COALESCE(auth.jwt() ->> 'role', current_setting('request.jwt.claim.role', true), '');
  EXCEPTION WHEN OTHERS THEN
    v_role := '';
  END;

  IF v_role = 'service_role' THEN
    RETURN true;
  END IF;

  IF v_role IN ('anon', 'authenticated') THEN
    RETURN false;
  END IF;

  -- No API request context at all: internal trigger / cron / direct owner session.
  RETURN session_user::text NOT IN ('authenticator', 'anon', 'authenticated');
END;
$$;

REVOKE ALL ON FUNCTION public.is_service_context() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assert_step_up(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_service_context() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assert_step_up(text, integer) TO authenticated, service_role;