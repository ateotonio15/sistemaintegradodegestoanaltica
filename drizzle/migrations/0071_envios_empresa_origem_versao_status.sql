-- Repositório de Envios: completa os campos do registro (origem, versão, status).
-- Toda linha existente veio do envio de e-mail, então o padrão já reflete a realidade.
ALTER TABLE public.envios_empresa_arquivos
  ADD COLUMN origem text NOT NULL DEFAULT 'Envio automático por e-mail',
  ADD COLUMN versao integer NOT NULL DEFAULT 1,
  ADD COLUMN status text NOT NULL DEFAULT 'Enviado';

-- Versão = quantas vezes o mesmo arquivo (mesmo nome, empresa e competência) já foi enviado.
CREATE OR REPLACE FUNCTION public.registrar_envio_empresa_arquivos(
  p_envio_id uuid, p_usuario uuid, p_nome text, p_itens jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_item jsonb; v_agora timestamptz := clock_timestamp();
BEGIN
  IF p_envio_id IS NULL OR p_usuario IS NULL THEN RAISE EXCEPTION 'Envio invalido'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = p_usuario AND role IN ('admin','comum','administradoras')) THEN
    RAISE EXCEPTION 'Sem permissao para registrar envio';
  END IF;
  IF jsonb_typeof(p_itens) <> 'array' THEN RAISE EXCEPTION 'Itens invalidos'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    IF (v_item->>'movimentacao_id') IS NULL OR (v_item->>'empresa_id') IS NULL
       OR NULLIF(v_item->>'storage_path','') IS NULL OR NULLIF(v_item->>'nome_arquivo','') IS NULL
       OR NULLIF(v_item->>'tipo_relatorio','') IS NULL THEN
      RAISE EXCEPTION 'Item de envio incompleto';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.movimentacoes WHERE id = (v_item->>'movimentacao_id')::uuid) THEN
      RAISE EXCEPTION 'Movimentacao nao encontrada';
    END IF;
    INSERT INTO public.envios_empresa_arquivos
      (envio_id, movimentacao_id, empresa_id, contrato, competencia, periodo, nome_arquivo,
       bucket, storage_path, mime_type, tamanho_bytes, tipo_relatorio, enviado_por, enviado_nome, enviado_em,
       origem, versao, status)
    VALUES (
      p_envio_id,
      (v_item->>'movimentacao_id')::uuid,
      (v_item->>'empresa_id')::uuid,
      NULLIF(v_item->>'contrato',''),
      NULLIF(v_item->>'competencia',''),
      NULLIF(v_item->>'periodo',''),
      v_item->>'nome_arquivo',
      COALESCE(NULLIF(v_item->>'bucket',''), 'arquivos-envios'),
      v_item->>'storage_path',
      NULLIF(v_item->>'mime_type',''),
      NULLIF(v_item->>'tamanho_bytes','')::bigint,
      v_item->>'tipo_relatorio',
      p_usuario,
      NULLIF(trim(COALESCE(p_nome,'')),''),
      v_agora,
      'Envio automático por e-mail',
      (SELECT count(*) + 1 FROM public.envios_empresa_arquivos e
        WHERE e.empresa_id = (v_item->>'empresa_id')::uuid
          AND e.competencia = NULLIF(v_item->>'competencia','')
          AND e.nome_arquivo = v_item->>'nome_arquivo'),
      'Enviado'
    )
    ON CONFLICT (envio_id, storage_path) DO NOTHING;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_envio_empresa_arquivos(uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_envio_empresa_arquivos(uuid, uuid, text, jsonb) TO service_role;