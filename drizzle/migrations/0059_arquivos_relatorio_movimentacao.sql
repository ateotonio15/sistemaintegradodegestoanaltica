CREATE TABLE public.movimentacao_relatorio_arquivos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 movimentacao_id uuid NOT NULL REFERENCES public.movimentacoes(id) ON DELETE CASCADE,
 nome_arquivo text NOT NULL,
 storage_path text NOT NULL UNIQUE,
 mime_type text,
 tamanho_bytes bigint NOT NULL CHECK (tamanho_bytes > 0 AND tamanho_bytes <= 15728640),
 uploaded_by uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT relatorio_arquivo_formato CHECK (nome_arquivo ~* '\.(pdf|xlsx|xlsm|xls)$'),
 CONSTRAINT relatorio_arquivo_path CHECK (split_part(storage_path, '/', 1) = movimentacao_id::text AND split_part(storage_path, '/', 2) = uploaded_by::text)
);
GRANT SELECT, INSERT, DELETE ON public.movimentacao_relatorio_arquivos TO authenticated;
GRANT ALL ON public.movimentacao_relatorio_arquivos TO service_role;
ALTER TABLE public.movimentacao_relatorio_arquivos ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_relatorio_arquivos_mov ON public.movimentacao_relatorio_arquivos(movimentacao_id);
CREATE POLICY relatorio_arquivos_leitura ON public.movimentacao_relatorio_arquivos FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.movimentacoes m WHERE m.id = movimentacao_id));
CREATE POLICY relatorio_arquivos_upload ON public.movimentacao_relatorio_arquivos FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid() AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'comum') OR public.has_role(auth.uid(), 'administradoras')) AND EXISTS (SELECT 1 FROM public.movimentacoes m WHERE m.id = movimentacao_id));
CREATE POLICY relatorio_arquivos_exclusao ON public.movimentacao_relatorio_arquivos FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'comum') OR public.has_role(auth.uid(), 'administradoras')) AND EXISTS (SELECT 1 FROM public.movimentacoes m WHERE m.id = movimentacao_id));
CREATE POLICY relatorio_storage_leitura ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'relatorios-movimentacoes' AND EXISTS (SELECT 1 FROM public.movimentacoes m WHERE m.id::text = split_part(name, '/', 1)));
CREATE POLICY relatorio_storage_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'relatorios-movimentacoes' AND split_part(name, '/', 2) = auth.uid()::text AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'comum') OR public.has_role(auth.uid(), 'administradoras')) AND EXISTS (SELECT 1 FROM public.movimentacoes m WHERE m.id::text = split_part(name, '/', 1)));
CREATE POLICY relatorio_storage_exclusao ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'relatorios-movimentacoes' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'comum') OR public.has_role(auth.uid(), 'administradoras')) AND EXISTS (SELECT 1 FROM public.movimentacoes m WHERE m.id::text = split_part(name, '/', 1)));
COMMENT ON TABLE public.movimentacao_relatorio_arquivos IS 'Arquivos exclusivos para envio do relatório de vidas; não são anexos operacionais nem financeiros.';