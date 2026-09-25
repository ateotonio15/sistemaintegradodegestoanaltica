CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

DROP POLICY IF EXISTS "palestras_read_all_auth" ON public.palestras_saude;
CREATE POLICY "palestras_read_all_auth" ON public.palestras_saude FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

DROP POLICY IF EXISTS "metas_select_auth" ON public.indicador_metas;
CREATE POLICY "metas_select_auth" ON public.indicador_metas FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

DROP POLICY IF EXISTS "bloqueios_read_all_auth" ON public.bloqueios_calendario;
CREATE POLICY "bloqueios_read_all_auth" ON public.bloqueios_calendario FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can read feriados" ON public.feriados;
CREATE POLICY "Authenticated can read feriados" ON public.feriados FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

DROP POLICY IF EXISTS "contrato_proc_mov_select" ON public.contrato_processo_movimentacoes;
CREATE POLICY "contrato_proc_mov_select" ON public.contrato_processo_movimentacoes FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()) AND NOT public.has_role(auth.uid(), 'executivo_externo'));

DROP POLICY IF EXISTS "contrato_proc_pend_select" ON public.contrato_processo_pendencias;
CREATE POLICY "contrato_proc_pend_select" ON public.contrato_processo_pendencias FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()) AND NOT public.has_role(auth.uid(), 'executivo_externo'));

DROP POLICY IF EXISTS "contrato_processos_select" ON public.contrato_processos;
CREATE POLICY "contrato_processos_select" ON public.contrato_processos FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()) AND NOT public.has_role(auth.uid(), 'executivo_externo'));

DROP POLICY IF EXISTS "validacao_cruzada_select" ON public.contrato_validacoes_cruzadas;
CREATE POLICY "validacao_cruzada_select" ON public.contrato_validacoes_cruzadas FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()) AND NOT public.has_role(auth.uid(), 'executivo_externo'));

DROP POLICY IF EXISTS "cs_avaliacao_formularios_public_read" ON public.cs_avaliacao_formularios;
CREATE POLICY "cs_avaliacao_formularios_public_read" ON public.cs_avaliacao_formularios FOR SELECT TO anon USING (tipo = 'rh');

DROP POLICY IF EXISTS "Autenticados leem config" ON public.avaliacoes_config;
CREATE POLICY "Autenticados leem config" ON public.avaliacoes_config FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

DROP POLICY IF EXISTS "orbit_envios_select" ON public.orbit_envios;
CREATE POLICY "orbit_envios_select" ON public.orbit_envios FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
DROP POLICY IF EXISTS "orbit_envios_insert" ON public.orbit_envios;
CREATE POLICY "orbit_envios_insert" ON public.orbit_envios FOR INSERT TO authenticated WITH CHECK (enviado_por = auth.uid() AND public.has_any_role(auth.uid()));

DROP POLICY IF EXISTS "atd anexos insert auth" ON storage.objects;
CREATE POLICY "atd anexos insert auth" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'atendimentos-anexos' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "atd anexos read auth" ON storage.objects;
CREATE POLICY "atd anexos read auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'atendimentos-anexos' AND (owner = (select auth.uid()) OR (storage.foldername(name))[1] = (select auth.uid()::text)));