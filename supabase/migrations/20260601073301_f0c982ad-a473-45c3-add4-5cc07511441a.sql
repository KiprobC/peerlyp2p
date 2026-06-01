
-- risk_flags: admins and moderators only
DROP POLICY IF EXISTS "Anyone can read risk flags" ON public.risk_flags;
CREATE POLICY "Admins and moderators can read risk flags"
ON public.risk_flags FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- rate_limit_config: admins only
DROP POLICY IF EXISTS "Anyone can view rate limit config" ON public.rate_limit_config;
CREATE POLICY "Admins can view rate limit config"
ON public.rate_limit_config FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- moderator_availability: moderators and admins only
DROP POLICY IF EXISTS "Moderators can view all availability" ON public.moderator_availability;
CREATE POLICY "Moderators and admins can view availability"
ON public.moderator_availability FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'moderator')
);

-- wallets: remove direct user UPDATE — balance changes must go through SECURITY DEFINER RPCs
DROP POLICY IF EXISTS "Users can update their own wallets" ON public.wallets;

-- profiles: remove anonymous access to PII; require authentication
DROP POLICY IF EXISTS "Public profiles are viewable" ON public.profiles;
CREATE POLICY "Authenticated users can view completed profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (setup_completed = true);
