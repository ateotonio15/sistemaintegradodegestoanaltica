ALTER TABLE public.nfse_recebimentos
  ADD COLUMN IF NOT EXISTS valor_pdf_centavos bigint,
  ADD COLUMN IF NOT EXISTS valor_excel_centavos bigint,
  ADD COLUMN IF NOT EXISTS diferenca_centavos bigint,
  ADD COLUMN IF NOT EXISTS validacao jsonb,
  ADD COLUMN IF NOT EXISTS faturamento_revisao text,
  ADD COLUMN IF NOT EXISTS validado_em timestamptz,
  ADD COLUMN IF NOT EXISTS validado_por uuid,
  ADD COLUMN IF NOT EXISTS homologacao boolean NOT NULL DEFAULT false;

CREATE TABLE public.nfse_central_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  auto_anexar_reais boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.nfse_central_config TO authenticated;
GRANT ALL ON public.nfse_central_config TO service_role;
ALTER TABLE public.nfse_central_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin e financeiro leem config NFS-e" ON public.nfse_central_config FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));
INSERT INTO public.nfse_central_config (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE POLICY "Admin e financeiro leem entrada NFS-e" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'nfse-entrada' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro')));

-- Revisão do faturamento: lista ordenada dos anexos atuais da movimentação
CREATE OR REPLACE FUNCTION public.nfse_central_revisao(_mov uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(string_agg(id::text, ',' ORDER BY id::text), '')
  FROM public.anexos_financeiro WHERE financeiro_movimentacao_id = _mov
$$;
REVOKE ALL ON FUNCTION public.nfse_central_revisao(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.nfse_central_revisao(uuid) TO authenticated, service_role;

-- Vínculo transacional: só o servidor chama (service_role)
CREATE OR REPLACE FUNCTION public.nfse_central_vincular(
  _recebimento uuid, _revisao text, _storage_path text, _nome text, _tamanho bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.nfse_recebimentos; mv public.financeiro_movimentacoes; e public.empresas; novo uuid; atual text;
BEGIN
  SELECT * INTO r FROM public.nfse_recebimentos WHERE id = _recebimento FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('estado','erro','motivo','Recebimento inexistente'); END IF;
  IF r.estado = 'vinculado' THEN RETURN jsonb_build_object('estado','vinculado','anexo_financeiro_id',r.anexo_financeiro_id); END IF;
  IF r.diferenca_centavos IS DISTINCT FROM 0 OR r.movimentacao_destino_id IS NULL THEN
    RETURN jsonb_build_object('estado','erro','motivo','Validação não aprovada'); END IF;
  SELECT * INTO mv FROM public.financeiro_movimentacoes WHERE id = r.movimentacao_destino_id FOR UPDATE;
  SELECT * INTO e FROM public.empresas WHERE id = mv.empresa_id;
  -- Bloqueia alterações concorrentes de anexos desta movimentação até o fim da transação
  PERFORM 1 FROM public.anexos_financeiro WHERE financeiro_movimentacao_id = mv.id FOR UPDATE;
  atual := public.nfse_central_revisao(mv.id);
  IF atual IS DISTINCT FROM _revisao OR atual IS DISTINCT FROM r.faturamento_revisao THEN
    UPDATE public.nfse_recebimentos SET estado='aguardando_validacao', motivo='Faturamento alterado durante a análise; será reavaliado.', updated_at=now() WHERE id=r.id;
    RETURN jsonb_build_object('estado','aguardando_validacao','motivo','Faturamento alterado durante a análise');
  END IF;
  IF mv.data_envio_nota IS NOT NULL OR coalesce(e.exige_po_pc,false) OR coalesce(e.aguarda_faturamento_excel,false)
     OR EXISTS (SELECT 1 FROM public.anexos_financeiro a WHERE a.financeiro_movimentacao_id = mv.id
         AND coalesce(lower(a.origem),'normal') NOT IN ('retroativo','reajuste')
         AND (coalesce(a.mime_type,'') ILIKE '%pdf%' OR a.nome_arquivo ILIKE '%.pdf'))
     OR NOT EXISTS (SELECT 1 FROM public.anexos_financeiro a WHERE a.financeiro_movimentacao_id = mv.id
         AND coalesce(lower(a.origem),'normal') NOT IN ('retroativo','reajuste')
         AND (a.mime_type ~* '(spreadsheet|excel|csv)' OR a.nome_arquivo ~* '\.(xlsx|xlsm|xls|csv)$')) THEN
    UPDATE public.nfse_recebimentos SET estado='aguardando_faturado', motivo='Movimentação deixou de estar em “Faturado”.', updated_at=now() WHERE id=r.id;
    RETURN jsonb_build_object('estado','aguardando_faturado');
  END IF;
  INSERT INTO public.anexos_financeiro (financeiro_movimentacao_id, nome_arquivo, storage_path, mime_type, tamanho_bytes, origem, compartilhado_grupo, bucket)
  VALUES (mv.id, _nome, _storage_path, 'application/pdf', _tamanho, 'central_nfse', false, 'anexos-financeiro')
  RETURNING id INTO novo;
  UPDATE public.nfse_recebimentos SET estado='vinculado', motivo=NULL, anexo_financeiro_id=novo, updated_at=now() WHERE id=r.id;
  RETURN jsonb_build_object('estado','vinculado','anexo_financeiro_id',novo);
END $$;
REVOKE ALL ON FUNCTION public.nfse_central_vincular(uuid,text,text,text,bigint) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nfse_central_vincular(uuid,text,text,text,bigint) TO service_role;