CREATE POLICY plantoes_empresas_externo_vinculo_read ON public.plantoes_empresas FOR SELECT TO authenticated
USING (has_role(auth.uid(),'executivo_externo'::app_role) AND id IN (SELECT empresa_id FROM public.empresa_usuarios WHERE user_id = auth.uid()));

CREATE POLICY plantoes_externo_vinculo_read ON public.plantoes FOR SELECT TO authenticated
USING (has_role(auth.uid(),'executivo_externo'::app_role) AND empresa_id IN (SELECT empresa_id FROM public.empresa_usuarios WHERE user_id = auth.uid()));

CREATE POLICY plantoes_atend_externo_vinculo_read ON public.plantoes_atendimentos FOR SELECT TO authenticated
USING (has_role(auth.uid(),'executivo_externo'::app_role) AND plantao_id IN (
  SELECT p.id FROM public.plantoes p WHERE p.empresa_id IN (SELECT empresa_id FROM public.empresa_usuarios WHERE user_id = auth.uid())
));