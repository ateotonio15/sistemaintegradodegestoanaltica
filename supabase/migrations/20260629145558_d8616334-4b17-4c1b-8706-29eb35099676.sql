CREATE POLICY cs_avaliacao_formularios_public_read ON public.cs_avaliacao_formularios FOR SELECT TO anon USING (true);
GRANT SELECT ON public.cs_avaliacao_formularios TO anon;