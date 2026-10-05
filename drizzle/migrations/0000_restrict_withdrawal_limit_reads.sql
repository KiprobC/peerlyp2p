DROP POLICY IF EXISTS "auth can read withdrawal limits" ON public.withdrawal_limit_overrides;
CREATE POLICY "Admins can read withdrawal limits" ON public.withdrawal_limit_overrides
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));