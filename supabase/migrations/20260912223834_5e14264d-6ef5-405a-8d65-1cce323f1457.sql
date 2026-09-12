-- ============ Sequência do identificador único ============
CREATE SEQUENCE IF NOT EXISTS public.contrato_processo_codigo_seq;

CREATE OR REPLACE FUNCTION public.gerar_codigo_contrato_processo()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT 'CTR-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public.contrato_processo_codigo_seq')::text, 6, '0');
$$;

-- ============ Processo único por contrato ============
CREATE TABLE public.contrato_processos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE DEFAULT public.gerar_codigo_contrato_processo(),
  implantacao_id uuid REFERENCES public.implantacoes_contratos(id) ON DELETE SET NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  nome_empresa text,
  cnpj text,
  status_geral text NOT NULL DEFAULT 'aberto'
    CHECK (status_geral IN ('aberto','em_andamento','aguardando_pendencia','concluido','cancelado')),
  setor_atual text NOT NULL DEFAULT 'documentos'
    CHECK (setor_atual IN ('documentos','analise_automatica','juridico','cadastro','financeiro','diretoria','concluido')),
  responsavel_atual_id uuid,
  responsavel_atual_nome text,
  pendencias_abertas integer NOT NULL DEFAULT 0,
  ultima_movimentacao_em timestamptz NOT NULL DEFAULT now(),
  resultado_final text NOT NULL DEFAULT 'Em análise'
    CHECK (resultado_final IN ('Em análise','Aprovado','Aprovado com ressalva','Reprovado','Implantado')),
  observacao text,
  created_by uuid,
  created_by_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contrato_processos_implantacao ON public.contrato_processos(implantacao_id);
CREATE INDEX idx_contrato_processos_empresa ON public.contrato_processos(empresa_id);
CREATE INDEX idx_contrato_processos_setor ON public.contrato_processos(setor_atual);
CREATE INDEX idx_contrato_processos_resultado ON public.contrato_processos(resultado_final);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_processos TO authenticated;
GRANT ALL ON public.contrato_processos TO service_role;
ALTER TABLE public.contrato_processos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contrato_processos_select" ON public.contrato_processos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "contrato_processos_write" ON public.contrato_processos
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'comum') OR
    public.has_role(auth.uid(), 'vendas') OR public.has_role(auth.uid(), 'diretora') OR
    public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'administradoras')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'comum') OR
    public.has_role(auth.uid(), 'vendas') OR public.has_role(auth.uid(), 'diretora') OR
    public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'administradoras')
  );

-- ============ Histórico de movimentações ============
CREATE TABLE public.contrato_processo_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.contrato_processos(id) ON DELETE CASCADE,
  acao text NOT NULL,
  setor_origem text,
  setor_destino text,
  status_anterior text,
  status_novo text,
  resultado_anterior text,
  resultado_novo text,
  responsavel_id uuid,
  responsavel_nome text,
  observacao text,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid,
  user_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contrato_proc_mov_processo ON public.contrato_processo_movimentacoes(processo_id, created_at);

GRANT SELECT, INSERT ON public.contrato_processo_movimentacoes TO authenticated;
GRANT ALL ON public.contrato_processo_movimentacoes TO service_role;
ALTER TABLE public.contrato_processo_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contrato_proc_mov_select" ON public.contrato_processo_movimentacoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "contrato_proc_mov_insert" ON public.contrato_processo_movimentacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'comum') OR
    public.has_role(auth.uid(), 'vendas') OR public.has_role(auth.uid(), 'diretora') OR
    public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'administradoras')
  );

-- ============ Pendências ============
CREATE TABLE public.contrato_processo_pendencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.contrato_processos(id) ON DELETE CASCADE,
  setor text NOT NULL DEFAULT 'documentos',
  descricao text NOT NULL,
  responsavel_id uuid,
  responsavel_nome text,
  prazo date,
  resolvida boolean NOT NULL DEFAULT false,
  resolvida_em timestamptz,
  resolvida_por uuid,
  resolvida_por_nome text,
  created_by uuid,
  created_by_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contrato_proc_pend_processo ON public.contrato_processo_pendencias(processo_id, resolvida);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_processo_pendencias TO authenticated;
GRANT ALL ON public.contrato_processo_pendencias TO service_role;
ALTER TABLE public.contrato_processo_pendencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contrato_proc_pend_select" ON public.contrato_processo_pendencias
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "contrato_proc_pend_write" ON public.contrato_processo_pendencias
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'comum') OR
    public.has_role(auth.uid(), 'vendas') OR public.has_role(auth.uid(), 'diretora') OR
    public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'administradoras')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'comum') OR
    public.has_role(auth.uid(), 'vendas') OR public.has_role(auth.uid(), 'diretora') OR
    public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'administradoras')
  );

-- ============ Triggers de manutenção ============
CREATE OR REPLACE FUNCTION public.contrato_processo_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contrato_processos_touch
BEFORE UPDATE ON public.contrato_processos
FOR EACH ROW EXECUTE FUNCTION public.contrato_processo_touch();

CREATE TRIGGER trg_contrato_proc_pend_touch
BEFORE UPDATE ON public.contrato_processo_pendencias
FOR EACH ROW EXECUTE FUNCTION public.contrato_processo_touch();

-- Recalcula pendências abertas
CREATE OR REPLACE FUNCTION public.contrato_processo_sync_pendencias()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_processo uuid := COALESCE(NEW.processo_id, OLD.processo_id);
BEGIN
  UPDATE public.contrato_processos p
     SET pendencias_abertas = (
           SELECT count(*) FROM public.contrato_processo_pendencias
            WHERE processo_id = v_processo AND resolvida = false
         ),
         updated_at = now()
   WHERE p.id = v_processo;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_contrato_proc_pend_sync
AFTER INSERT OR UPDATE OR DELETE ON public.contrato_processo_pendencias
FOR EACH ROW EXECUTE FUNCTION public.contrato_processo_sync_pendencias();

-- Aplica a movimentação ao processo
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
         resultado_final = COALESCE(NEW.resultado_novo, p.resultado_final),
         responsavel_atual_id = COALESCE(NEW.responsavel_id, p.responsavel_atual_id),
         responsavel_atual_nome = COALESCE(NEW.responsavel_nome, p.responsavel_atual_nome),
         updated_at = now()
   WHERE p.id = NEW.processo_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_contrato_proc_mov_aplicar
AFTER INSERT ON public.contrato_processo_movimentacoes
FOR EACH ROW EXECUTE FUNCTION public.contrato_processo_aplicar_movimentacao();

-- ============ RPC: registrar movimentação ============
CREATE OR REPLACE FUNCTION public.registrar_movimentacao_processo(
  p_processo_id uuid,
  p_acao text,
  p_setor_destino text DEFAULT NULL,
  p_status_novo text DEFAULT NULL,
  p_resultado_novo text DEFAULT NULL,
  p_responsavel_id uuid DEFAULT NULL,
  p_responsavel_nome text DEFAULT NULL,
  p_observacao text DEFAULT NULL,
  p_detalhes jsonb DEFAULT '{}'::jsonb
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
    status_anterior, status_novo, resultado_anterior, resultado_novo,
    responsavel_id, responsavel_nome, observacao, detalhes, user_id, user_nome
  ) VALUES (
    p_processo_id, p_acao, v_proc.setor_atual, p_setor_destino,
    v_proc.status_geral, p_status_novo, v_proc.resultado_final, p_resultado_novo,
    p_responsavel_id, p_responsavel_nome, p_observacao, COALESCE(p_detalhes, '{}'::jsonb),
    auth.uid(), v_nome
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_movimentacao_processo(uuid, text, text, text, text, uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_movimentacao_processo(uuid, text, text, text, text, uuid, text, text, jsonb) TO authenticated;

-- ============ RPC: criar processo ============
CREATE OR REPLACE FUNCTION public.criar_contrato_processo(
  p_implantacao_id uuid DEFAULT NULL,
  p_empresa_id uuid DEFAULT NULL,
  p_nome_empresa text DEFAULT NULL,
  p_cnpj text DEFAULT NULL
)
RETURNS public.contrato_processos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proc public.contrato_processos;
  v_nome text;
BEGIN
  IF p_implantacao_id IS NOT NULL THEN
    SELECT * INTO v_proc FROM public.contrato_processos WHERE implantacao_id = p_implantacao_id LIMIT 1;
    IF v_proc.id IS NOT NULL THEN
      RETURN v_proc;
    END IF;
  END IF;

  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = auth.uid();

  INSERT INTO public.contrato_processos (
    implantacao_id, empresa_id, nome_empresa, cnpj,
    responsavel_atual_id, responsavel_atual_nome, created_by, created_by_nome
  ) VALUES (
    p_implantacao_id, p_empresa_id, p_nome_empresa, p_cnpj,
    auth.uid(), v_nome, auth.uid(), v_nome
  ) RETURNING * INTO v_proc;

  INSERT INTO public.contrato_processo_movimentacoes (
    processo_id, acao, setor_destino, status_novo, resultado_novo,
    responsavel_id, responsavel_nome, user_id, user_nome
  ) VALUES (
    v_proc.id, 'processo_criado', 'documentos', 'aberto', 'Em análise',
    auth.uid(), v_nome, auth.uid(), v_nome
  );

  SELECT * INTO v_proc FROM public.contrato_processos WHERE id = v_proc.id;
  RETURN v_proc;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_contrato_processo(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_contrato_processo(uuid, uuid, text, text) TO authenticated;