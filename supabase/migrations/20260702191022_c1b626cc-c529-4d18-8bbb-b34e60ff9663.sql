
DROP POLICY IF EXISTS plantoes_empresas_externo_read ON public.plantoes_empresas;
CREATE POLICY plantoes_empresas_externo_read ON public.plantoes_empresas
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'executivo_externo'::app_role));

DROP POLICY IF EXISTS plantoes_externo_read ON public.plantoes;
CREATE POLICY plantoes_externo_read ON public.plantoes
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'executivo_externo'::app_role));

DROP POLICY IF EXISTS plantoes_externo_write ON public.plantoes;
CREATE POLICY plantoes_externo_write ON public.plantoes
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'executivo_externo'::app_role))
WITH CHECK (has_role(auth.uid(), 'executivo_externo'::app_role));

DROP POLICY IF EXISTS plantoes_atend_externo_read ON public.plantoes_atendimentos;
CREATE POLICY plantoes_atend_externo_read ON public.plantoes_atendimentos
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'executivo_externo'::app_role));

DROP POLICY IF EXISTS plantoes_atend_externo_write ON public.plantoes_atendimentos;
CREATE POLICY plantoes_atend_externo_write ON public.plantoes_atendimentos
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'executivo_externo'::app_role))
WITH CHECK (has_role(auth.uid(), 'executivo_externo'::app_role));
