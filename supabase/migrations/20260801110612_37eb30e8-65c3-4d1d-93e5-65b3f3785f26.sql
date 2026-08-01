ALTER TABLE public.network_confirmation_rules ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.network_confirmation_rules FROM anon, authenticated;
GRANT SELECT ON public.network_confirmation_rules TO authenticated;
GRANT ALL ON public.network_confirmation_rules TO service_role;

DROP POLICY IF EXISTS "Authenticated can view confirmation rules" ON public.network_confirmation_rules;
CREATE POLICY "Authenticated can view confirmation rules"
ON public.network_confirmation_rules
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins manage confirmation rules" ON public.network_confirmation_rules;
CREATE POLICY "Admins manage confirmation rules"
ON public.network_confirmation_rules
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));