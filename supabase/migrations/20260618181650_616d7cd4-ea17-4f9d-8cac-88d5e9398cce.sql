DROP POLICY IF EXISTS cs_avaliacao_formularios_public_read ON public.cs_avaliacao_formularios;
CREATE POLICY cs_avaliacao_formularios_auth_read ON public.cs_avaliacao_formularios FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.cs_avaliacao_formularios FROM anon;