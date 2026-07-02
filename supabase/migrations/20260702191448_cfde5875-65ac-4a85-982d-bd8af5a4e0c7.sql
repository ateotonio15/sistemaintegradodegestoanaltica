
DROP POLICY IF EXISTS plantoes_empresas_externo_write ON public.plantoes_empresas;
CREATE POLICY plantoes_empresas_externo_write ON public.plantoes_empresas
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'executivo_externo'::app_role))
WITH CHECK (has_role(auth.uid(), 'executivo_externo'::app_role));
