
GRANT SELECT ON public.cs_avaliacao_formularios TO anon, authenticated;
GRANT ALL ON public.cs_avaliacao_formularios TO service_role;
GRANT INSERT ON public.cs_avaliacao_respostas TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.cs_avaliacao_respostas TO authenticated;
GRANT ALL ON public.cs_avaliacao_respostas TO service_role;
