
-- 1) Lock down cs_* tables: replace public-role policies with authenticated-only equivalents
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'cs_avaliacao_formularios','cs_avaliacao_respostas','cs_avaliacao_risco',
    'cs_avaliacoes_executiva','cs_sinistralidade_historico','cs_sinistralidade_mensal'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS cs_af_all_select ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS cs_af_all_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS cs_af_all_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS cs_af_all_delete ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS cs_resp_all_select ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS cs_resp_all_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS cs_resp_all_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS cs_resp_all_delete ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS cs_ar_all_select ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS cs_ar_all_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS cs_ar_all_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS cs_ar_all_delete ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS cs_ae_all_select ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS cs_ae_all_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS cs_ae_all_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS cs_ae_all_delete ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS cs_sh_all_select ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS cs_sh_all_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS cs_sh_all_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS cs_sh_all_delete ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS cs_sm_all_select ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS cs_sm_all_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS cs_sm_all_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS cs_sm_all_delete ON public.%I', t);

    EXECUTE format('CREATE POLICY "%s_auth_select" ON public.%I FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)', t, t);
    EXECUTE format('CREATE POLICY "%s_auth_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL)', t, t);
    EXECUTE format('CREATE POLICY "%s_auth_update" ON public.%I FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)', t, t);
    EXECUTE format('CREATE POLICY "%s_auth_delete" ON public.%I FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL)', t, t);
  END LOOP;
END $$;

-- 2) demandas: restrict SELECT to roles that need it
DROP POLICY IF EXISTS "Authenticated can read demandas" ON public.demandas;
CREATE POLICY "Internal roles can read demandas"
ON public.demandas FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR has_role(auth.uid(),'executivo'::app_role)
  OR has_role(auth.uid(),'diretora'::app_role)
  OR has_role(auth.uid(),'comum'::app_role)
  OR has_role(auth.uid(),'administradoras'::app_role)
  OR has_role(auth.uid(),'financeiro'::app_role)
);

-- 3) grupos_financeiros / grupos_financeiros_contratos: switch management policy to authenticated
DROP POLICY IF EXISTS "Admins/Financeiro manage grupos_financeiros" ON public.grupos_financeiros;
CREATE POLICY "Admins/Financeiro manage grupos_financeiros"
ON public.grupos_financeiros FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));

DROP POLICY IF EXISTS "Admins/Financeiro manage gfc" ON public.grupos_financeiros_contratos;
CREATE POLICY "Admins/Financeiro manage gfc"
ON public.grupos_financeiros_contratos FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));

-- 4) Health tables: restrict SELECT to admin/enfermeira/diretora
CREATE OR REPLACE FUNCTION public.is_saude_reader(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(_uid,'admin'::app_role)
      OR public.has_role(_uid,'enfermeira'::app_role)
      OR public.has_role(_uid,'diretora'::app_role);
$$;

DROP POLICY IF EXISTS triagens_select_all ON public.triagens;
CREATE POLICY triagens_select ON public.triagens FOR SELECT TO authenticated
USING (public.is_saude_reader(auth.uid()));

DROP POLICY IF EXISTS acoes_saude_select_all ON public.acoes_saude;
CREATE POLICY acoes_saude_select ON public.acoes_saude FOR SELECT TO authenticated
USING (public.is_saude_reader(auth.uid()));
