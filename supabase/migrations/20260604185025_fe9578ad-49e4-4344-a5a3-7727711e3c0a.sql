
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated, PUBLIC;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE IF NOT EXISTS private.pii_keys (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  key bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.pii_keys FROM anon, authenticated, PUBLIC;
GRANT ALL ON private.pii_keys TO service_role;

INSERT INTO private.pii_keys (id, key)
VALUES (1, extensions.gen_random_bytes(32))
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION private._pii_key()
RETURNS bytea LANGUAGE sql STABLE SECURITY DEFINER SET search_path = private AS $$
  SELECT key FROM private.pii_keys WHERE id = 1;
$$;
REVOKE ALL ON FUNCTION private._pii_key() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.encrypt_pii(plaintext text)
RETURNS bytea LANGUAGE sql STABLE SECURITY DEFINER SET search_path = private, extensions, public AS $$
  SELECT CASE
    WHEN plaintext IS NULL OR length(plaintext) = 0 THEN NULL
    ELSE extensions.pgp_sym_encrypt(plaintext, encode(private._pii_key(), 'hex'))
  END;
$$;
REVOKE ALL ON FUNCTION private.encrypt_pii(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.decrypt_pii(ciphertext bytea)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = private, extensions, public AS $$
  SELECT CASE
    WHEN ciphertext IS NULL THEN NULL
    ELSE extensions.pgp_sym_decrypt(ciphertext, encode(private._pii_key(), 'hex'))
  END;
$$;
REVOKE ALL ON FUNCTION private.decrypt_pii(bytea) FROM PUBLIC, anon, authenticated;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mpesa_phone_enc bytea,
  ADD COLUMN IF NOT EXISTS bank_account_number_enc bytea,
  ADD COLUMN IF NOT EXISTS id_number_enc bytea;

ALTER TABLE public.kyc_submissions
  ADD COLUMN IF NOT EXISTS id_number_enc bytea;

CREATE OR REPLACE FUNCTION public._sync_profile_pii_enc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, extensions AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.mpesa_phone IS DISTINCT FROM OLD.mpesa_phone THEN
    NEW.mpesa_phone_enc := private.encrypt_pii(NEW.mpesa_phone);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number THEN
    NEW.bank_account_number_enc := private.encrypt_pii(NEW.bank_account_number);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.id_number IS DISTINCT FROM OLD.id_number THEN
    NEW.id_number_enc := private.encrypt_pii(NEW.id_number);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_pii_enc ON public.profiles;
CREATE TRIGGER trg_sync_profile_pii_enc
BEFORE INSERT OR UPDATE OF mpesa_phone, bank_account_number, id_number ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public._sync_profile_pii_enc();

CREATE OR REPLACE FUNCTION public._sync_kyc_pii_enc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, extensions AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.id_number IS DISTINCT FROM OLD.id_number THEN
    NEW.id_number_enc := private.encrypt_pii(NEW.id_number);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_kyc_pii_enc ON public.kyc_submissions;
CREATE TRIGGER trg_sync_kyc_pii_enc
BEFORE INSERT OR UPDATE OF id_number ON public.kyc_submissions
FOR EACH ROW EXECUTE FUNCTION public._sync_kyc_pii_enc();

UPDATE public.profiles SET mpesa_phone = mpesa_phone
  WHERE mpesa_phone IS NOT NULL AND mpesa_phone_enc IS NULL;
UPDATE public.profiles SET bank_account_number = bank_account_number
  WHERE bank_account_number IS NOT NULL AND bank_account_number_enc IS NULL;
UPDATE public.profiles SET id_number = id_number
  WHERE id_number IS NOT NULL AND id_number_enc IS NULL;
UPDATE public.kyc_submissions SET id_number = id_number
  WHERE id_number IS NOT NULL AND id_number_enc IS NULL;

CREATE OR REPLACE FUNCTION public.decrypt_my_pii()
RETURNS TABLE (mpesa_phone text, bank_account_number text, id_number text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private, extensions AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  RETURN QUERY
  SELECT
    private.decrypt_pii(p.mpesa_phone_enc),
    private.decrypt_pii(p.bank_account_number_enc),
    private.decrypt_pii(p.id_number_enc)
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.decrypt_my_pii() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_decrypt_pii(p_user_id uuid, p_reason text DEFAULT NULL)
RETURNS TABLE (mpesa_phone text, bank_account_number text, id_number text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, extensions AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  BEGIN
    INSERT INTO public.admin_actions (actor_id, action_type, target_type, target_id, metadata)
    VALUES (v_actor, 'pii_decrypt', 'profile', p_user_id, jsonb_build_object('reason', p_reason));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN QUERY
  SELECT
    private.decrypt_pii(p.mpesa_phone_enc),
    private.decrypt_pii(p.bank_account_number_enc),
    private.decrypt_pii(p.id_number_enc)
  FROM public.profiles p
  WHERE p.user_id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_decrypt_pii(uuid, text) TO authenticated;

-- ============================================================
-- PHASE 5 — Push Notifications schema
-- ============================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  user_agent text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users manage own push subs" ON public.push_subscriptions;
CREATE POLICY "users manage own push subs" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id) WHERE enabled;

CREATE TABLE IF NOT EXISTS public.push_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid,
  subscription_id uuid REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  payload jsonb NOT NULL,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  retry_count int NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.push_deliveries TO authenticated;
GRANT ALL ON public.push_deliveries TO service_role;
ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users view own push deliveries" ON public.push_deliveries;
CREATE POLICY "users view own push deliveries" ON public.push_deliveries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_push_deliveries_retry
  ON public.push_deliveries(failed_at) WHERE failed_at IS NOT NULL AND delivered_at IS NULL;
