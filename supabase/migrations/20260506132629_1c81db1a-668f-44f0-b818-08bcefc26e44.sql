
-- Passkeys table
CREATE TABLE public.passkeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[] DEFAULT '{}',
  device_name text NOT NULL DEFAULT 'My device',
  aaguid text,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_passkeys_user_id ON public.passkeys(user_id);

ALTER TABLE public.passkeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own passkeys" ON public.passkeys
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users update own passkeys" ON public.passkeys
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users delete own passkeys" ON public.passkeys
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins view all passkeys" ON public.passkeys
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Challenges table (no client access)
CREATE TABLE public.webauthn_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  challenge text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('registration','authentication','step_up')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webauthn_challenges_expires ON public.webauthn_challenges(expires_at);
CREATE INDEX idx_webauthn_challenges_user ON public.webauthn_challenges(user_id);

ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No client access to challenges" ON public.webauthn_challenges
  FOR ALL USING (false) WITH CHECK (false);

-- Helper: count user passkeys
CREATE OR REPLACE FUNCTION public.passkey_count(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.passkeys WHERE user_id = _user_id;
$$;

-- Admin: list users with passkeys
CREATE OR REPLACE FUNCTION public.admin_list_passkey_users()
RETURNS TABLE(user_id uuid, email text, full_name text, passkey_count int, last_used_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    pr.email,
    pr.full_name,
    COUNT(*)::int as passkey_count,
    MAX(p.last_used_at) as last_used_at
  FROM public.passkeys p
  LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE has_role(auth.uid(), 'admin'::app_role)
  GROUP BY p.user_id, pr.email, pr.full_name
  ORDER BY MAX(p.last_used_at) DESC NULLS LAST;
$$;
