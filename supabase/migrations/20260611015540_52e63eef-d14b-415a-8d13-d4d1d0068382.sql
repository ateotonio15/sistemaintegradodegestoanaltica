
DROP POLICY IF EXISTS cs_avaliacao_formularios_auth_select ON public.cs_avaliacao_formularios;
DROP POLICY IF EXISTS cs_avaliacao_formularios_auth_insert ON public.cs_avaliacao_formularios;
DROP POLICY IF EXISTS cs_avaliacao_formularios_auth_update ON public.cs_avaliacao_formularios;
DROP POLICY IF EXISTS cs_avaliacao_formularios_auth_delete ON public.cs_avaliacao_formularios;
CREATE POLICY cs_avaliacao_formularios_select ON public.cs_avaliacao_formularios FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'executivo'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
CREATE POLICY cs_avaliacao_formularios_write ON public.cs_avaliacao_formularios FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretora'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretora'::app_role));

DROP POLICY IF EXISTS cs_avaliacao_respostas_auth_select ON public.cs_avaliacao_respostas;
DROP POLICY IF EXISTS cs_avaliacao_respostas_auth_insert ON public.cs_avaliacao_respostas;
DROP POLICY IF EXISTS cs_avaliacao_respostas_auth_update ON public.cs_avaliacao_respostas;
DROP POLICY IF EXISTS cs_avaliacao_respostas_auth_delete ON public.cs_avaliacao_respostas;
CREATE POLICY cs_avaliacao_respostas_rw ON public.cs_avaliacao_respostas FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'executivo'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'executivo'::app_role));

DROP POLICY IF EXISTS cs_avaliacao_risco_auth_select ON public.cs_avaliacao_risco;
DROP POLICY IF EXISTS cs_avaliacao_risco_auth_insert ON public.cs_avaliacao_risco;
DROP POLICY IF EXISTS cs_avaliacao_risco_auth_update ON public.cs_avaliacao_risco;
DROP POLICY IF EXISTS cs_avaliacao_risco_auth_delete ON public.cs_avaliacao_risco;
CREATE POLICY cs_avaliacao_risco_rw ON public.cs_avaliacao_risco FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'executivo'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'executivo'::app_role));

DROP POLICY IF EXISTS cs_avaliacoes_executiva_auth_select ON public.cs_avaliacoes_executiva;
DROP POLICY IF EXISTS cs_avaliacoes_executiva_auth_insert ON public.cs_avaliacoes_executiva;
DROP POLICY IF EXISTS cs_avaliacoes_executiva_auth_update ON public.cs_avaliacoes_executiva;
DROP POLICY IF EXISTS cs_avaliacoes_executiva_auth_delete ON public.cs_avaliacoes_executiva;
CREATE POLICY cs_avaliacoes_executiva_rw ON public.cs_avaliacoes_executiva FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'executivo'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'executivo'::app_role));

DROP POLICY IF EXISTS cs_sinistralidade_historico_auth_select ON public.cs_sinistralidade_historico;
DROP POLICY IF EXISTS cs_sinistralidade_historico_auth_insert ON public.cs_sinistralidade_historico;
DROP POLICY IF EXISTS cs_sinistralidade_historico_auth_update ON public.cs_sinistralidade_historico;
DROP POLICY IF EXISTS cs_sinistralidade_historico_auth_delete ON public.cs_sinistralidade_historico;
CREATE POLICY cs_sinistralidade_historico_rw ON public.cs_sinistralidade_historico FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'financeiro'::app_role) OR has_role(auth.uid(),'executivo'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'financeiro'::app_role) OR has_role(auth.uid(),'executivo'::app_role));

DROP POLICY IF EXISTS cs_sinistralidade_mensal_auth_select ON public.cs_sinistralidade_mensal;
DROP POLICY IF EXISTS cs_sinistralidade_mensal_auth_insert ON public.cs_sinistralidade_mensal;
DROP POLICY IF EXISTS cs_sinistralidade_mensal_auth_update ON public.cs_sinistralidade_mensal;
DROP POLICY IF EXISTS cs_sinistralidade_mensal_auth_delete ON public.cs_sinistralidade_mensal;
CREATE POLICY cs_sinistralidade_mensal_rw ON public.cs_sinistralidade_mensal FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'financeiro'::app_role) OR has_role(auth.uid(),'executivo'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'financeiro'::app_role) OR has_role(auth.uid(),'executivo'::app_role));

DROP POLICY IF EXISTS "Non-readonly can insert demandas" ON public.demandas;
CREATE POLICY "Internal roles can insert demandas" ON public.demandas FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'executivo'::app_role)
    OR has_role(auth.uid(),'diretora'::app_role)
    OR has_role(auth.uid(),'comum'::app_role)
    OR has_role(auth.uid(),'administradoras'::app_role)
    OR has_role(auth.uid(),'financeiro'::app_role)
  );

DROP POLICY IF EXISTS "Authenticated can read importacoes" ON public.importacoes;
CREATE POLICY "Internal roles can read importacoes" ON public.importacoes FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'comum'::app_role)
    OR has_role(auth.uid(),'financeiro'::app_role)
  );

DROP POLICY IF EXISTS plantoes_atend_auth_read ON public.plantoes_atendimentos;
CREATE POLICY plantoes_atend_role_read ON public.plantoes_atendimentos FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'enfermeira'::app_role)
    OR has_role(auth.uid(),'diretora'::app_role)
  );

ALTER FUNCTION public.calcular_imc(numeric, integer) SET search_path = public;
ALTER FUNCTION public.classificar_pa(integer, integer) SET search_path = public;
ALTER FUNCTION public.classificar_glicemia(numeric, boolean) SET search_path = public;
ALTER FUNCTION public.calcular_rcq(numeric, numeric) SET search_path = public;
ALTER FUNCTION public.calcular_idade(date) SET search_path = public;
