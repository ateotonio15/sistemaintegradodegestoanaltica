
CREATE POLICY plantoes_executivo_write ON public.plantoes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'executivo'::app_role))
  WITH CHECK (has_role(auth.uid(), 'executivo'::app_role));

CREATE POLICY plantoes_atend_executivo_write ON public.plantoes_atendimentos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'executivo'::app_role))
  WITH CHECK (has_role(auth.uid(), 'executivo'::app_role));

CREATE POLICY plantoes_empresas_executivo_write ON public.plantoes_empresas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'executivo'::app_role))
  WITH CHECK (has_role(auth.uid(), 'executivo'::app_role));
