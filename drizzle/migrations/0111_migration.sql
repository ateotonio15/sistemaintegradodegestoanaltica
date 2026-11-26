DROP POLICY IF EXISTS acl_read ON public.atendimento_classificacao_listas;
CREATE POLICY acl_read ON public.atendimento_classificacao_listas
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.user_id = auth.uid())
);