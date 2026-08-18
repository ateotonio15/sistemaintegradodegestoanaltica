CREATE POLICY "Tec enfermagem view empresas" ON public.empresas FOR SELECT TO authenticated USING (has_role(auth.uid(), 'tec_enfermagem'::app_role));

CREATE POLICY "Tec enfermagem update contato empresas" ON public.empresas FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'tec_enfermagem'::app_role));

DROP POLICY IF EXISTS acoes_preventivas_select ON public.acoes_preventivas;
CREATE POLICY acoes_preventivas_select ON public.acoes_preventivas FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'executivo'::app_role) OR has_role(auth.uid(), 'enfermeira'::app_role) OR has_role(auth.uid(), 'tec_enfermagem'::app_role) OR has_role(auth.uid(), 'diretora'::app_role));

DROP POLICY IF EXISTS acoes_preventivas_update ON public.acoes_preventivas;
CREATE POLICY acoes_preventivas_update ON public.acoes_preventivas FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'executivo'::app_role) OR has_role(auth.uid(), 'enfermeira'::app_role) OR has_role(auth.uid(), 'tec_enfermagem'::app_role));

DROP POLICY IF EXISTS acoes_preventivas_delete ON public.acoes_preventivas;
CREATE POLICY acoes_preventivas_delete ON public.acoes_preventivas FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'executivo'::app_role) OR has_role(auth.uid(), 'enfermeira'::app_role) OR has_role(auth.uid(), 'tec_enfermagem'::app_role));