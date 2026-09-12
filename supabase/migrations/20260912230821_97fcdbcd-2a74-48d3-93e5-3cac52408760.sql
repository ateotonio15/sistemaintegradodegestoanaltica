
-- 1) Novas colunas
ALTER TABLE public.contrato_processos
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'recebido',
  ADD COLUMN IF NOT EXISTS data_entrada_setor timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS proxima_acao text;

ALTER TABLE public.contrato_processos DROP CONSTRAINT IF EXISTS contrato_processos_status_check;
ALTER TABLE public.contrato_processos ADD CONSTRAINT contrato_processos_status_check CHECK (status = ANY (ARRAY[
  'recebido','em_extracao','analise_automatica','aguardando_juridico','analise_juridica','pendencia_juridica',
  'aguardando_cadastro','analise_cadastro','pendencia_cadastral','aguardando_financeiro','analise_financeira',
  'pendencia_financeira','aguardando_documento_empresa','em_revisao','aprovado','aprovado_ressalva','reprovado','implantado'
]));

-- setor_atual: aceitar tambem 'comercial' (mantendo os valores atuais)
ALTER TABLE public.contrato_processos DROP CONSTRAINT IF EXISTS contrato_processos_setor_atual_check;
ALTER TABLE public.contrato_processos ADD CONSTRAINT contrato_processos_setor_atual_check CHECK (setor_atual = ANY (ARRAY[
  'comercial','documentos','analise_automatica','juridico','cadastro','financeiro','diretoria','concluido'
]));

ALTER TABLE public.contrato_processo_movimentacoes
  ADD COLUMN IF NOT EXISTS status_detalhado_anterior text,
  ADD COLUMN IF NOT EXISTS status_detalhado_novo text;

-- 2) Trigger de aplicacao passa a considerar status detalhado e data de entrada no setor
CREATE OR REPLACE FUNCTION public.contrato_processo_aplicar_movimentacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.contrato_processos p
     SET ultima_movimentacao_em = NEW.created_at,
         setor_atual = COALESCE(NEW.setor_destino, p.setor_atual),
         status_geral = COALESCE(NEW.status_novo, p.status_geral),
         status = COALESCE(NEW.status_detalhado_novo, p.status),
         data_entrada_setor = CASE
           WHEN NEW.setor_destino IS NOT NULL AND NEW.setor_destino <> p.setor_atual
             THEN NEW.created_at ELSE p.data_entrada_setor END,
         resultado_final = COALESCE(NEW.resultado_novo, p.resultado_final),
         responsavel_atual_id = COALESCE(NEW.responsavel_id, p.responsavel_atual_id),
         responsavel_atual_nome = COALESCE(NEW.responsavel_nome, p.responsavel_atual_nome),
         updated_at = now()
   WHERE p.id = NEW.processo_id;
  RETURN NULL;
END;
$$;

-- 3) registrar_movimentacao_processo com status detalhado e proxima acao
CREATE OR REPLACE FUNCTION public.registrar_movimentacao_processo(
  p_processo_id uuid,
  p_acao text,
  p_setor_destino text DEFAULT NULL,
  p_status_novo text DEFAULT NULL,
  p_resultado_novo text DEFAULT NULL,
  p_responsavel_id uuid DEFAULT NULL,
  p_responsavel_nome text DEFAULT NULL,
  p_observacao text DEFAULT NULL,
  p_detalhes jsonb DEFAULT '{}'::jsonb,
  p_status_detalhado text DEFAULT NULL,
  p_proxima_acao text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proc public.contrato_processos;
  v_nome text;
  v_id uuid;
BEGIN
  SELECT * INTO v_proc FROM public.contrato_processos WHERE id = p_processo_id;
  IF v_proc.id IS NULL THEN
    RAISE EXCEPTION 'Processo não encontrado';
  END IF;

  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = auth.uid();

  INSERT INTO public.contrato_processo_movimentacoes (
    processo_id, acao, setor_origem, setor_destino,
    status_anterior, status_novo, status_detalhado_anterior, status_detalhado_novo,
    resultado_anterior, resultado_novo,
    responsavel_id, responsavel_nome, observacao, detalhes, user_id, user_nome
  ) VALUES (
    p_processo_id, p_acao, v_proc.setor_atual, p_setor_destino,
    v_proc.status_geral, p_status_novo, v_proc.status, p_status_detalhado,
    v_proc.resultado_final, p_resultado_novo,
    p_responsavel_id, p_responsavel_nome, p_observacao, COALESCE(p_detalhes, '{}'::jsonb),
    auth.uid(), v_nome
  ) RETURNING id INTO v_id;

  IF p_proxima_acao IS NOT NULL THEN
    UPDATE public.contrato_processos SET proxima_acao = p_proxima_acao, updated_at = now()
     WHERE id = p_processo_id;
  END IF;

  RETURN v_id;
END;
$$;

-- 4) Encaminhar contrato entre setores
CREATE OR REPLACE FUNCTION public.encaminhar_contrato_processo(
  p_processo_id uuid,
  p_setor_destino text,
  p_status text DEFAULT NULL,
  p_responsavel_id uuid DEFAULT NULL,
  p_responsavel_nome text DEFAULT NULL,
  p_proxima_acao text DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status_geral text;
BEGIN
  v_status_geral := CASE
    WHEN p_setor_destino = 'concluido' THEN 'concluido'
    WHEN p_status IN ('pendencia_juridica','pendencia_cadastral','pendencia_financeira','aguardando_documento_empresa') THEN 'aguardando_pendencia'
    ELSE 'em_andamento' END;

  RETURN public.registrar_movimentacao_processo(
    p_processo_id, 'encaminhado', p_setor_destino, v_status_geral, NULL,
    p_responsavel_id, p_responsavel_nome, p_observacao, '{}'::jsonb, p_status, p_proxima_acao
  );
END;
$$;
