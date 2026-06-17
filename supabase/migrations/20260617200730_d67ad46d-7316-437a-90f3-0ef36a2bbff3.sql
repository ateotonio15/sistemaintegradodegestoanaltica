DROP POLICY IF EXISTS cs_avaliacao_formularios_write ON public.cs_avaliacao_formularios;
CREATE POLICY cs_avaliacao_formularios_write ON public.cs_avaliacao_formularios
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretora'::app_role) OR has_role(auth.uid(), 'executivo'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretora'::app_role) OR has_role(auth.uid(), 'executivo'::app_role));