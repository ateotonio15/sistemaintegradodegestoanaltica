CREATE OR REPLACE FUNCTION public.nfse_central_vincular(
  _recebimento uuid, _revisao text, _storage_path text, _nome text, _tamanho bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.nfse_recebimentos; mv public.financeiro_movimentacoes; e public.empresas; novo uuid; atual text; liberado boolean;
BEGIN
  SELECT * INTO r FROM public.nfse_recebimentos WHERE id = _recebimento FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('estado','erro','motivo','Recebimento inexistente'); END IF;
  IF r.estado = 'vinculado' THEN RETURN jsonb_build_object('estado','vinculado','anexo_financeiro_id',r.anexo_financeiro_id); END IF;
  IF r.homologacao THEN RETURN jsonb_build_object('estado','aprovado_aguardando_liberacao','motivo','Homologação nunca anexa'); END IF;
  SELECT auto_anexar_reais INTO liberado FROM public.nfse_central_config WHERE id = 1 FOR SHARE;
  IF NOT coalesce(liberado,false) THEN RETURN jsonb_build_object('estado','aprovado_aguardando_liberacao','motivo','Anexação real desligada'); END IF;
  IF r.estado <> 'aprovado_aguardando_liberacao' OR r.diferenca_centavos IS DISTINCT FROM 0 OR r.movimentacao_destino_id IS NULL
     OR r.chave_validacao IS NULL OR r.validacao IS NULL OR r.valor_pdf_centavos IS NULL OR r.valor_excel_centavos IS NULL
     OR r.storage_path IS NULL OR r.emitida_em < timestamptz '2026-10-22 04:00:00+00' THEN
    RETURN jsonb_build_object('estado','erro','motivo','Validação não aprovada ou incompleta'); END IF;
  IF EXISTS (SELECT 1 FROM public.nfse_recebimentos o WHERE o.origem = r.origem AND o.cnpj_prestador = r.cnpj_prestador
       AND o.chave_acesso = r.chave_acesso AND o.homologacao = r.homologacao AND o.id <> r.id AND o.pdf_sha256 <> r.pdf_sha256 AND o.estado <> 'ja_recebido') THEN
    UPDATE public.nfse_recebimentos SET estado='revisao_versao_pdf', motivo='Outra versão de PDF para esta nota; exige revisão humana.', updated_at=now() WHERE id=r.id;
    RETURN jsonb_build_object('estado','revisao_versao_pdf'); END IF;
  IF coalesce((r.validacao->'conferido'->>'identidade_fiscal')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('estado','erro','motivo','Identidade fiscal do PDF não comprovada'); END IF;
  SELECT * INTO mv FROM public.financeiro_movimentacoes WHERE id = r.movimentacao_destino_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('estado','erro','motivo','Movimentação inexistente'); END IF;
  SELECT * INTO e FROM public.empresas WHERE id = mv.empresa_id;
  IF NOT EXISTS (SELECT 1 FROM public.nfse_central_candidatos(r.cnpj_tomador) c WHERE c.empresa_id = mv.empresa_id) THEN
    UPDATE public.nfse_recebimentos SET estado='divergencia', motivo='CNPJ do tomador não pertence mais a esta empresa.', updated_at=now() WHERE id=r.id;
    RETURN jsonb_build_object('estado','divergencia'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('nfse_mov:' || mv.id::text, 0));
  atual := public.nfse_central_revisao(mv.id);
  IF atual IS DISTINCT FROM _revisao OR atual IS DISTINCT FROM r.faturamento_revisao THEN
    UPDATE public.nfse_recebimentos SET estado='aguardando_validacao', chave_validacao=NULL, proxima_tentativa_em=now(), motivo='Faturamento alterado durante a análise; será reavaliado.', updated_at=now() WHERE id=r.id;
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