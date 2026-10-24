ALTER TABLE public.nfse_recebimentos
  ADD COLUMN IF NOT EXISTS chave_validacao text,
  ADD COLUMN IF NOT EXISTS proxima_tentativa_em timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS reservado_ate timestamptz;
CREATE INDEX IF NOT EXISTS nfse_recebimentos_fila_idx ON public.nfse_recebimentos (proxima_tentativa_em);
-- Recebimento canônico por nota/PDF, separado entre homologação e produção
CREATE UNIQUE INDEX IF NOT EXISTS nfse_recebimentos_canonico_uidx ON public.nfse_recebimentos (origem, cnpj_prestador, chave_acesso, pdf_sha256, homologacao)
  WHERE estado <> 'ja_recebido';

-- Candidatos pelo CNPJ normalizado, filtrados no banco
CREATE OR REPLACE FUNCTION public.nfse_central_candidatos(_cnpj text)
RETURNS TABLE (empresa_id uuid, cnpj text, origem text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id, e.cnpj, 'empresa' FROM public.empresas e WHERE regexp_replace(coalesce(e.cnpj,''),'\D','','g') = _cnpj AND length(_cnpj) = 14
  UNION ALL
  SELECT p.empresa_id, p.cnpj, 'pagador' FROM public.financeiro_pagadores p WHERE p.ativo AND regexp_replace(coalesce(p.cnpj,''),'\D','','g') = _cnpj AND length(_cnpj) = 14
$$;
REVOKE ALL ON FUNCTION public.nfse_central_candidatos(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nfse_central_candidatos(text) TO service_role;

-- Revisão forte: identidade, local, tamanho, origem e versão do objeto armazenado
CREATE OR REPLACE FUNCTION public.nfse_central_revisao(_mov uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(md5(string_agg(concat_ws('|', a.id, coalesce(a.bucket,'anexos-financeiro'), a.storage_path, a.tamanho_bytes, coalesce(a.origem,'normal'),
           a.mime_type, a.nome_arquivo, o.id, o.updated_at, o.metadata->>'eTag'), ',' ORDER BY a.id::text)), '')
  FROM public.anexos_financeiro a
  LEFT JOIN storage.objects o ON o.bucket_id = coalesce(a.bucket,'anexos-financeiro') AND o.name = a.storage_path
  WHERE a.financeiro_movimentacao_id = _mov
$$;
REVOKE ALL ON FUNCTION public.nfse_central_revisao(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.nfse_central_revisao(uuid) TO authenticated, service_role;

-- Todo caminho que altera anexos de uma movimentação passa pelo mesmo bloqueio do vínculo
CREATE OR REPLACE FUNCTION public.nfse_central_lock_anexos()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.financeiro_movimentacao_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('nfse_mov:' || OLD.financeiro_movimentacao_id::text, 0)); END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.financeiro_movimentacao_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('nfse_mov:' || NEW.financeiro_movimentacao_id::text, 0)); END IF;
  RETURN coalesce(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_nfse_central_lock_anexos ON public.anexos_financeiro;
CREATE TRIGGER trg_nfse_central_lock_anexos BEFORE INSERT OR UPDATE OR DELETE ON public.anexos_financeiro
  FOR EACH ROW EXECUTE FUNCTION public.nfse_central_lock_anexos();

-- Reserva de trabalho para a fila (concorrência segura)
CREATE OR REPLACE FUNCTION public.nfse_central_reservar(_lote int)
RETURNS SETOF public.nfse_recebimentos LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.nfse_recebimentos r SET reservado_ate = now() + interval '5 minutes'
  WHERE r.id IN (
    SELECT id FROM public.nfse_recebimentos
    WHERE estado IN ('recebido_pendente','aguardando_faturado','aguardando_faturamento_anexado','destino_ambiguo','aguardando_validacao','validacao_inconclusiva','divergencia','aprovado_aguardando_liberacao')
      AND proxima_tentativa_em <= now() AND (reservado_ate IS NULL OR reservado_ate < now())
    ORDER BY proxima_tentativa_em, id LIMIT greatest(1, least(_lote, 20))
    FOR UPDATE SKIP LOCKED)
  RETURNING r.*
$$;
REVOKE ALL ON FUNCTION public.nfse_central_reservar(int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nfse_central_reservar(int) TO service_role;

-- Mudanças em anexos/movimentações/pagadores antecipam a próxima tentativa
CREATE OR REPLACE FUNCTION public.nfse_central_despertar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u text; t text;
BEGIN
  IF TG_TABLE_NAME <> 'nfse_recebimentos' THEN
    UPDATE public.nfse_recebimentos SET proxima_tentativa_em = now()
    WHERE proxima_tentativa_em > now() AND estado IN
      ('recebido_pendente','aguardando_faturado','aguardando_faturamento_anexado','destino_ambiguo','aguardando_validacao','validacao_inconclusiva','divergencia','aprovado_aguardando_liberacao');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.nfse_recebimentos WHERE proxima_tentativa_em <= now() AND estado IN
    ('recebido_pendente','aguardando_faturado','aguardando_faturamento_anexado','destino_ambiguo','aguardando_validacao','validacao_inconclusiva','divergencia','aprovado_aguardando_liberacao')) THEN
    RETURN NULL;
  END IF;
  SELECT valor INTO u FROM public.config_sync WHERE chave = 'nfse_central_url';
  SELECT valor INTO t FROM public.config_sync WHERE chave = 'nfse_central_token';
  IF u IS NULL OR t IS NULL THEN RETURN NULL; END IF;
  BEGIN
    PERFORM net.http_post(url := u, headers := jsonb_build_object('Content-Type','application/json','x-sync-token',t), body := '{}'::jsonb, timeout_milliseconds := 120000);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.nfse_central_despertar() FROM public, anon, authenticated;

-- Barreira final completa dentro da transação
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