DROP POLICY IF EXISTS "Catalogo leitura autenticada" ON public.produtos_planos;
CREATE POLICY "Catalogo leitura autenticada" ON public.produtos_planos FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid()));

DROP POLICY IF EXISTS "leitura autenticada" ON public.empresa_cnpj_situacao;
CREATE POLICY "leitura autenticada" ON public.empresa_cnpj_situacao FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = empresa_cnpj_situacao.empresa_id));

DROP POLICY IF EXISTS "Autenticados leem encaminhamentos de suspensos" ON public.movimentacao_suspensos_encaminhamentos;
CREATE POLICY "Autenticados leem encaminhamentos de suspensos" ON public.movimentacao_suspensos_encaminhamentos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = movimentacao_suspensos_encaminhamentos.empresa_id));

DROP POLICY IF EXISTS "envios_empresa_download" ON storage.objects;
CREATE POLICY "envios_empresa_download" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'arquivos-envios' AND auth.uid() IS NOT NULL AND public.has_any_role(auth.uid())
  AND (storage.foldername(name))[1] = 'envios'
  AND EXISTS (SELECT 1 FROM public.movimentacoes m WHERE m.id::text = (storage.foldername(objects.name))[2]));

DROP POLICY IF EXISTS "relatorio_storage_leitura" ON storage.objects;
CREATE POLICY "relatorio_storage_leitura" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'relatorios-movimentacoes' AND auth.uid() IS NOT NULL AND public.has_any_role(auth.uid())
  AND EXISTS (SELECT 1 FROM public.movimentacoes m WHERE m.id::text = split_part(objects.name, '/', 1)));

DROP POLICY IF EXISTS "assinatura_email_propria_select" ON storage.objects;
CREATE POLICY "assinatura_email_propria_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'assinaturas-email' AND (
  owner_id = (select auth.uid()::text)
  OR name IN ((select auth.uid()::text) || '.png', (select auth.uid()::text) || '.jpg')
  OR public.has_role(auth.uid(), 'admin'::app_role)));