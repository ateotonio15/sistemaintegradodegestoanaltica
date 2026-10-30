-- Controle de versão do Repositório de Envios.
-- Mesmo documento = mesma empresa, contrato, competência, período e categoria (o nome do arquivo não entra).
-- Envio novo substitui o anterior: o antigo fica "Substituído" (nunca apagado) e o novo fica "Atual".

-- 1) Libera temporariamente o gatilho para ajustar as linhas já existentes.
DROP TRIGGER trg_envios_empresa_imutavel ON public.envios_empresa_arquivos;

-- 2) Renumera as versões pela identidade do documento (não pelo nome do arquivo).
WITH numerado AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY empresa_id, contrato, competencia, periodo, tipo_relatorio
           ORDER BY enviado_em, id
         ) AS v
  FROM public.envios_empresa_arquivos
)
UPDATE public.envios_empresa_arquivos e
SET versao = n.v
FROM numerado n
WHERE e.id = n.id;

-- 3) A versão mais recente de cada documento fica Atual; as anteriores, Substituído.
WITH ultima AS (
  SELECT DISTINCT ON (empresa_id, contrato, competencia, periodo, tipo_relatorio) id
  FROM public.envios_empresa_arquivos
  ORDER BY empresa_id, contrato, competencia, periodo, tipo_relatorio, enviado_em DESC, id DESC
)
UPDATE public.envios_empresa_arquivos e
SET status = CASE WHEN EXISTS (SELECT 1 FROM ultima u WHERE u.id = e.id) THEN 'Atual' ELSE 'Substituído' END;

-- 4) Nova regra de imutabilidade: exclusão continua proibida; a única alteração
--    permitida é a troca do status da versão (feita somente pela função de registro).
CREATE OR REPLACE FUNCTION public.envios_empresa_imutavel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Registros de arquivos enviados não podem ser excluidos';
  END IF;
  IF NEW.id = OLD.id
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.envio_id = OLD.envio_id
     AND NEW.movimentacao_id = OLD.movimentacao_id
     AND NEW.empresa_id = OLD.empresa_id
     AND NEW.contrato = OLD.contrato
     AND NEW.competencia = OLD.competencia
     AND NEW.periodo IS NOT DISTINCT FROM OLD.periodo
     AND NEW.nome_arquivo = OLD.nome_arquivo
     AND NEW.bucket = OLD.bucket
     AND NEW.storage_path = OLD.storage_path
     AND NEW.versao = OLD.versao
     AND NEW.enviado_por = OLD.enviado_por
     AND NEW.enviado_em = OLD.enviado_em THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Registros de arquivos enviados não podem ser alterados';
END;
$$;
REVOKE ALL ON FUNCTION public.envios_empresa_imutavel() FROM PUBLIC;

CREATE TRIGGER trg_envios_empresa_imutavel BEFORE UPDATE OR DELETE ON public.envios_empresa_arquivos
  FOR EACH ROW EXECUTE FUNCTION public.envios_empresa_imutavel();

-- 5) Registro: a versão conta pela identidade do documento e o envio novo substitui o anterior.
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
    -- Mesmo documento (empresa, contrato, competência, período e categoria):
    -- a versão anterior fica Substituída, sem apagar o arquivo.
    UPDATE public.envios_empresa_arquivos
    SET status = 'Substituído'
    WHERE empresa_id = (v_item->>'empresa_id')::uuid
      AND contrato = NULLIF(v_item->>'contrato','')
      AND competencia = NULLIF(v_item->>'competencia','')
      AND periodo IS NOT DISTINCT FROM NULLIF(v_item->>'periodo','')
      AND tipo_relatorio = v_item->>'tipo_relatorio'
      AND status = 'Atual';
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
          AND e.contrato = NULLIF(v_item->>'contrato','')
          AND e.competencia = NULLIF(v_item->>'competencia','')
          AND e.periodo IS NOT DISTINCT FROM NULLIF(v_item->>'periodo','')
          AND e.tipo_relatorio = v_item->>'tipo_relatorio'),
      'Atual'
    )
    ON CONFLICT (envio_id, storage_path) DO NOTHING;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_envio_empresa_arquivos(uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_envio_empresa_arquivos(uuid, uuid, text, jsonb) TO service_role;