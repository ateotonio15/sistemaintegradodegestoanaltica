DROP POLICY IF EXISTS mailing_brindes_role_select ON public.mailing_brindes;
CREATE POLICY mailing_brindes_role_select ON public.mailing_brindes FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'diretora') OR has_role(auth.uid(),'executivo')
  OR ((has_role(auth.uid(),'executivo_externo') OR has_role(auth.uid(),'comum') OR has_role(auth.uid(),'administradoras')) AND created_by = auth.uid())
);