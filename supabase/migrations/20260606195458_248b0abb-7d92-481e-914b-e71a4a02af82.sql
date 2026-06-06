CREATE OR REPLACE FUNCTION public.admin_set_push_dispatch_config_internal(
  p_service_role_key text,
  p_supabase_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  INSERT INTO private.edge_config (id, supabase_url, service_role_key, updated_at)
  VALUES (1, p_supabase_url, p_service_role_key, now())
  ON CONFLICT (id) DO UPDATE
    SET service_role_key = EXCLUDED.service_role_key,
        supabase_url     = EXCLUDED.supabase_url,
        updated_at       = now();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_push_dispatch_config_internal(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_push_dispatch_config_internal(text, text) TO service_role;