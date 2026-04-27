-- ============================================
-- 1) Tabela de anexos vinculados a movimentações operacionais (usuário comum)
-- ============================================
CREATE TABLE IF NOT EXISTS public.anexos_movimentacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movimentacao_id uuid NOT NULL,
  empresa_id uuid NOT NULL,
  nome_arquivo text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  tamanho_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anexos_mov_mov_id ON public.anexos_movimentacao(movimentacao_id);
CREATE INDEX IF NOT EXISTS idx_anexos_mov_empresa_id ON public.anexos_movimentacao(empresa_id);

ALTER TABLE public.anexos_movimentacao ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer autenticado
CREATE POLICY "Authenticated read anexos_movimentacao"
  ON public.anexos_movimentacao FOR SELECT TO authenticated USING (true);

-- Admin: tudo
CREATE POLICY "Admin manage anexos_movimentacao"
  ON public.anexos_movimentacao FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Financeiro: tudo
CREATE POLICY "Financeiro manage anexos_movimentacao"
  ON public.anexos_movimentacao FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'financeiro'::app_role))
  WITH CHECK (has_role(auth.uid(), 'financeiro'::app_role));

-- Comum: pode inserir/excluir os próprios anexos
CREATE POLICY "Comum insert anexos_movimentacao"
  ON public.anexos_movimentacao FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'comum'::app_role) AND uploaded_by = auth.uid());

CREATE POLICY "Comum delete own anexos_movimentacao"
  ON public.anexos_movimentacao FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'comum'::app_role) AND uploaded_by = auth.uid());

-- ============================================
-- 2) Tabela de alertas "Faturamentos Enviado"
-- ============================================
CREATE TABLE IF NOT EXISTS public.alertas_financeiro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movimentacao_id uuid NOT NULL UNIQUE,
  empresa_id uuid NOT NULL,
  empresa_nome text NOT NULL,
  enviado_por_user_id uuid,
  enviado_por_nome text,
  data_envio date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente','Finalizado')),
  finalizado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alertas_fin_status ON public.alertas_financeiro(status);
CREATE INDEX IF NOT EXISTS idx_alertas_fin_empresa ON public.alertas_financeiro(empresa_id);

ALTER TABLE public.alertas_financeiro ENABLE ROW LEVEL SECURITY;

-- Apenas Admin e Financeiro podem ler alertas (usuários comum NÃO veem)
CREATE POLICY "Admin read alertas_financeiro"
  ON public.alertas_financeiro FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Financeiro read alertas_financeiro"
  ON public.alertas_financeiro FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Admin manage alertas_financeiro"
  ON public.alertas_financeiro FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Financeiro manage alertas_financeiro"
  ON public.alertas_financeiro FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'financeiro'::app_role))
  WITH CHECK (has_role(auth.uid(), 'financeiro'::app_role));

-- O usuário comum precisa permissão de INSERT (via trigger é SECURITY DEFINER, mas mantemos seguro)
-- Inserts ocorrerão dentro de função SECURITY DEFINER, então não precisamos policy de insert para comum.

CREATE TRIGGER update_alertas_fin_updated_at
  BEFORE UPDATE ON public.alertas_financeiro
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 3) Storage bucket para anexos das movimentações operacionais
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('anexos-movimentacoes', 'anexos-movimentacoes', false)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket
CREATE POLICY "Authenticated read anexos-movimentacoes storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'anexos-movimentacoes');

CREATE POLICY "Comum upload anexos-movimentacoes storage"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'anexos-movimentacoes' AND (
    has_role(auth.uid(), 'comum'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
  ));

CREATE POLICY "Comum delete own anexos-movimentacoes storage"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'anexos-movimentacoes' AND (
    owner = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
  ));

-- ============================================
-- 4) Função/trigger: ao preencher data_envio_financeiro em movimentacoes,
--    criar registro em financeiro_movimentacoes e gerar alerta
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_envio_financeiro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fin_mov_id uuid;
  v_empresa_nome text;
  v_user_nome text;
  v_tipo_emp text;
BEGIN
  -- só age quando data_envio_financeiro acaba de ser preenchida (passa de NULL para valor)
  IF NEW.data_envio_financeiro IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.data_envio_financeiro IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- buscar nome empresa e tipo financeiro
  SELECT nome, tipo_financeiro INTO v_empresa_nome, v_tipo_emp
  FROM public.empresas WHERE id = NEW.empresa_id;

  IF v_empresa_nome IS NULL THEN
    RETURN NEW;
  END IF;

  -- nome do remetente
  SELECT display_name INTO v_user_nome
  FROM public.profiles WHERE user_id = auth.uid();

  -- garante registro financeiro_movimentacoes (mesma empresa+mes+periodo)
  SELECT id INTO v_fin_mov_id
  FROM public.financeiro_movimentacoes
  WHERE empresa_id = NEW.empresa_id
    AND mes_referencia = NEW.mes_referencia
    AND periodo = NEW.periodo
  LIMIT 1;

  IF v_fin_mov_id IS NULL THEN
    INSERT INTO public.financeiro_movimentacoes
      (empresa_id, mes_referencia, periodo, tipo_cobranca, dentro_prazo)
    VALUES
      (NEW.empresa_id, NEW.mes_referencia, NEW.periodo, v_tipo_emp, true)
    RETURNING id INTO v_fin_mov_id;
  END IF;

  -- espelha anexos da movimentação operacional para anexos_financeiro
  INSERT INTO public.anexos_financeiro
    (financeiro_movimentacao_id, nome_arquivo, storage_path, mime_type, tamanho_bytes, uploaded_by)
  SELECT v_fin_mov_id, am.nome_arquivo, am.storage_path, am.mime_type, am.tamanho_bytes, am.uploaded_by
  FROM public.anexos_movimentacao am
  WHERE am.movimentacao_id = NEW.id
    AND NOT EXISTS (
      SELECT 1 FROM public.anexos_financeiro af
      WHERE af.financeiro_movimentacao_id = v_fin_mov_id
        AND af.storage_path = am.storage_path
    );

  -- cria/garante alerta Pendente
  INSERT INTO public.alertas_financeiro
    (movimentacao_id, empresa_id, empresa_nome, enviado_por_user_id, enviado_por_nome, data_envio, status)
  VALUES
    (NEW.id, NEW.empresa_id, v_empresa_nome, auth.uid(), v_user_nome, NEW.data_envio_financeiro, 'Pendente')
  ON CONFLICT (movimentacao_id) DO UPDATE
    SET status = 'Pendente',
        finalizado_em = NULL,
        data_envio = EXCLUDED.data_envio,
        enviado_por_user_id = EXCLUDED.enviado_por_user_id,
        enviado_por_nome = EXCLUDED.enviado_por_nome,
        empresa_nome = EXCLUDED.empresa_nome,
        updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_envio_financeiro ON public.movimentacoes;
CREATE TRIGGER trg_envio_financeiro
  AFTER INSERT OR UPDATE OF data_envio_financeiro ON public.movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.handle_envio_financeiro();

-- ============================================
-- 5) Trigger: quando data_envio_nota for preenchida em financeiro_movimentacoes,
--    finalizar todos os alertas das movimentações operacionais correspondentes
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_finalizar_alerta_financeiro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.data_envio_nota IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.data_envio_nota IS NOT NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.alertas_financeiro AS a
     SET status = 'Finalizado',
         finalizado_em = now(),
         updated_at = now()
   WHERE a.status = 'Pendente'
     AND a.movimentacao_id IN (
       SELECT m.id FROM public.movimentacoes m
        WHERE m.empresa_id = NEW.empresa_id
          AND m.mes_referencia = NEW.mes_referencia
          AND m.periodo = NEW.periodo
     );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finalizar_alerta_financeiro ON public.financeiro_movimentacoes;
CREATE TRIGGER trg_finalizar_alerta_financeiro
  AFTER INSERT OR UPDATE OF data_envio_nota ON public.financeiro_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.handle_finalizar_alerta_financeiro();

-- ============================================
-- 6) Realtime
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.alertas_financeiro;
ALTER PUBLICATION supabase_realtime ADD TABLE public.anexos_movimentacao;