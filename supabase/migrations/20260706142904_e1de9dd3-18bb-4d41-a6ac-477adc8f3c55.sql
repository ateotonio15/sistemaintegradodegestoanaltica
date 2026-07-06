CREATE POLICY "Executivo externo view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'executivo_externo'::app_role));

CREATE POLICY "Executivo externo view all user_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'executivo_externo'::app_role));