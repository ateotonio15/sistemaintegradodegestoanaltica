-- Repositório de Envios: arquivo central dos documentos enviados às empresas.
-- Append-only: linhas só entram pelo RPC service_role após o SMTP aceitar o e-mail.
CREATE TABLE public.envios_empresa_arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  envio_id uuid NOT NULL,
  movimentacao_id uuid NOT NULL,
  empresa_id uuid NOT NULL,
  contrato text NOT NULL,
  competencia text NOT NULL,
  periodo text,
  nome_arquivo text NOT NULL,
  bucket text NOT NULL DEFAULT 'arquivos-envios',
  storage_path text NOT NULL,
  mime_type text,
  tamanho_bytes bigint,
  tipo_relatorio text NOT NULL,
  enviado_por uuid NOT NULL,
  enviado_nome text,
  enviado_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (envio_id, storage_path)
);

CREATE INDEX envios_empresa_empresa_idx ON public.envios_empresa_arquivos (empresa_id, competencia DESC);
CREATE INDEX envios_empresa_mov_idx ON public.envios_empresa_arquivos (movimentacao_id);

GRANT SELECT ON public.envios_empresa_arquivos TO authenticated;
GRANT ALL ON public.envios_empresa_arquivos TO service_role;

ALTER TABLE public.envios_empresa_arquivos ENABLE ROW LEVEL SECURITY;

-- Lê quem lê a movimentação de destino (mesma regra do histórico de envio).
CREATE POLICY envios_empresa_leitura ON public.envios_empresa_arquivos
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.movimentacoes m WHERE m.id = envios_empresa_arquivos.movimentacao_id));

-- Histórico imutável: ninguém edita nem apaga o que foi enviado.
CREATE OR REPLACE FUNCTION public.envios_empresa_imutavel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Registros de arquivos enviados não podem ser alterados ou excluidos';
END;
$$;
REVOKE ALL ON FUNCTION public.envios_empresa_imutavel() FROM PUBLIC;

CREATE TRIGGER trg_envios_empresa_imutavel BEFORE UPDATE OR DELETE ON public.envios_empresa_arquivos
  FOR EACH ROW EXECUTE FUNCTION public.envios_empresa_imutavel();

-- Registro atômico chamado somente pela função de envio, após o SMTP aceitar.
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
       bucket, storage_path, mime_type, tamanho_bytes, tipo_relatorio, enviado_por, enviado_nome, enviado_em)
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
      v_agora
    )
    ON CONFLICT (envio_id, storage_path) DO NOTHING;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_envio_empresa_arquivos(uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_envio_empresa_arquivos(uuid, uuid, text, jsonb) TO service_role;