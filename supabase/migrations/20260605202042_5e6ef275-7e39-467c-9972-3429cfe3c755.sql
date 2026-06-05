
-- 1. Colunas em empresas
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS status_implantacao text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS primeira_competencia_financeira text,
  ADD COLUMN IF NOT EXISTS primeiro_fechamento_em timestamptz,
  ADD COLUMN IF NOT EXISTS primeiro_processamento_financeiro_em timestamptz;

-- 2. Tabela de histórico
CREATE TABLE IF NOT EXISTS public.empresa_implantacao_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  data_implantacao date,
  primeira_competencia text,
  primeiro_fechamento_em timestamptz,
  primeiro_processamento_em timestamptz,
  evento text NOT NULL,
  detalhes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.empresa_implantacao_historico TO authenticated;
GRANT ALL ON public.empresa_implantacao_historico TO service_role;

ALTER TABLE public.empresa_implantacao_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cadastro/Financeiro/Diretora/Admin podem ver historico"
  ON public.empresa_implantacao_historico FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'comum'::app_role)
    OR public.has_role(auth.uid(), 'administradoras'::app_role)
    OR public.has_role(auth.uid(), 'financeiro'::app_role)
    OR public.has_role(auth.uid(), 'diretora'::app_role)
  );

CREATE POLICY "Sistema insere historico"
  ON public.empresa_implantacao_historico FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_emp_impl_hist_empresa ON public.empresa_implantacao_historico(empresa_id);
CREATE INDEX IF NOT EXISTS idx_empresas_status_implantacao ON public.empresas(status_implantacao) WHERE status_implantacao = 'aguardando_primeiro_fechamento';

-- 3. Função: calcular primeira competência financeira
CREATE OR REPLACE FUNCTION public.calcular_primeira_competencia(p_empresa_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp record;
  v_data_impl date;
  v_dia_corte int;
  v_periodo_fim int;
  v_ano int;
  v_mes int;
BEGIN
  SELECT data_implantacao, tipo_movimentacao, periodo_movimentacao,
         dia_movimentacao, data_corte, tipo_contrato
    INTO v_emp
  FROM public.empresas
  WHERE id = p_empresa_id;

  v_data_impl := COALESCE(v_emp.data_implantacao, CURRENT_DATE);

  -- Dia de corte do mês de implantação
  IF v_emp.tipo_movimentacao = 'Fechada' AND v_emp.periodo_movimentacao IS NOT NULL THEN
    -- usa o fim do período (ex.: '15-20' -> 20)
    v_periodo_fim := COALESCE(NULLIF(split_part(v_emp.periodo_movimentacao, '-', 2), '')::int, 30);
    v_dia_corte := v_periodo_fim;
  ELSIF v_emp.data_corte IS NOT NULL THEN
    v_dia_corte := v_emp.data_corte;
  ELSIF v_emp.dia_movimentacao IS NOT NULL THEN
    v_dia_corte := v_emp.dia_movimentacao;
  ELSE
    v_dia_corte := 30;
  END IF;

  v_ano := EXTRACT(YEAR FROM v_data_impl)::int;
  v_mes := EXTRACT(MONTH FROM v_data_impl)::int;

  IF EXTRACT(DAY FROM v_data_impl)::int > v_dia_corte THEN
    -- após o corte: primeira competência é mês seguinte
    v_mes := v_mes + 1;
    IF v_mes > 12 THEN
      v_mes := 1;
      v_ano := v_ano + 1;
    END IF;
  END IF;

  RETURN to_char(make_date(v_ano, v_mes, 1), 'YYYY-MM');
END;
$$;

-- 4. Função: ativar contratos pendentes (chamável pelo frontend e cron)
CREATE OR REPLACE FUNCTION public.ativar_contratos_pendentes()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_emp record;
  v_now_comp text := to_char(CURRENT_DATE, 'YYYY-MM');
BEGIN
  FOR v_emp IN
    SELECT id, nome, primeira_competencia_financeira, data_implantacao
      FROM public.empresas
     WHERE status_implantacao = 'aguardando_primeiro_fechamento'
       AND primeira_competencia_financeira IS NOT NULL
       AND primeira_competencia_financeira <= v_now_comp
  LOOP
    UPDATE public.empresas
       SET status_implantacao = 'ativo',
           primeiro_fechamento_em = COALESCE(primeiro_fechamento_em, now()),
           updated_at = now()
     WHERE id = v_emp.id;

    INSERT INTO public.empresa_implantacao_historico
      (empresa_id, data_implantacao, primeira_competencia, primeiro_fechamento_em, evento, detalhes)
    VALUES
      (v_emp.id, v_emp.data_implantacao, v_emp.primeira_competencia_financeira, now(),
       'ativado_automaticamente', jsonb_build_object('competencia', v_now_comp));

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calcular_primeira_competencia(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ativar_contratos_pendentes() TO authenticated;

-- 5. Ajustar finalizar_implantacao_cadastro: marcar status_implantacao e primeira competência
CREATE OR REPLACE FUNCTION public.finalizar_implantacao_cadastro(p_impl uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_impl record;
  v_nome text;
  v_emp_id uuid;
  v_tipo_mov text;
  v_competencia text;
BEGIN
  IF NOT (public.has_role(v_uid,'comum'::app_role) OR public.has_role(v_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Apenas Cadastro pode finalizar';
  END IF;
  SELECT * INTO v_impl FROM public.implantacoes_contratos WHERE id = p_impl;
  IF v_impl.id IS NULL THEN RAISE EXCEPTION 'Implantação não encontrada'; END IF;
  IF v_impl.status NOT IN ('aprovado_diretoria','enviado_cadastro') THEN
    RAISE EXCEPTION 'Implantação ainda não foi aprovada pela Diretoria';
  END IF;
  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = v_uid;

  v_tipo_mov := CASE
    WHEN v_impl.periodo_movimentacao IN ('20-25','25-30') THEN 'Fechada'
    WHEN v_impl.periodo_movimentacao IS NOT NULL THEN 'Diária'
    ELSE 'Fechada'
  END;

  v_emp_id := v_impl.empresa_id;

  IF v_emp_id IS NULL AND v_impl.cnpj IS NOT NULL THEN
    SELECT id INTO v_emp_id FROM public.empresas WHERE cnpj = v_impl.cnpj LIMIT 1;
  END IF;

  IF v_emp_id IS NULL THEN
    INSERT INTO public.empresas (
      nome, cnpj, codigo_contrato, grupo_contrato, endereco, telefone_empresa,
      tipo_contrato, periodo_movimentacao, dia_movimentacao, data_corte, tipo_movimentacao,
      data_implantacao, vidas, operadora_plano, responsavel_contrato,
      responsavel_user_id, status_empresa, contrato_faixa_etaria,
      status_implantacao
    ) VALUES (
      COALESCE(v_impl.nome_empresa, 'Empresa sem nome'),
      v_impl.cnpj, v_impl.codigo_contrato, v_impl.grupo_contrato, v_impl.endereco, v_impl.telefone,
      'EMPRESARIAL',
      v_impl.periodo_movimentacao, v_impl.dia_movimentacao, v_impl.data_corte, v_tipo_mov,
      v_impl.inicio_atendimento, COALESCE(v_impl.total_vidas, 0), v_impl.modalidade, v_impl.created_by_nome,
      COALESCE(v_impl.responsavel_cadastro_user_id, v_uid), 'Ativa',
      (v_impl.faixas_etarias IS NOT NULL),
      'aguardando_primeiro_fechamento'
    )
    RETURNING id INTO v_emp_id;
  ELSE
    IF COALESCE(v_impl.total_vidas, 0) > 0 THEN
      UPDATE public.empresas
         SET vidas = v_impl.total_vidas,
             updated_at = now()
       WHERE id = v_emp_id;
    END IF;
    -- marca como aguardando primeiro fechamento mesmo se a empresa já existia
    UPDATE public.empresas
       SET status_implantacao = 'aguardando_primeiro_fechamento',
           updated_at = now()
     WHERE id = v_emp_id
       AND status_implantacao IS DISTINCT FROM 'ativo';
  END IF;

  -- calcula e grava primeira competência
  v_competencia := public.calcular_primeira_competencia(v_emp_id);
  UPDATE public.empresas
     SET primeira_competencia_financeira = v_competencia,
         updated_at = now()
   WHERE id = v_emp_id;

  -- histórico
  INSERT INTO public.empresa_implantacao_historico
    (empresa_id, data_implantacao, primeira_competencia, evento, detalhes)
  SELECT v_emp_id, data_implantacao, v_competencia, 'implantado',
         jsonb_build_object('implantacao_id', p_impl, 'por', v_nome)
    FROM public.empresas WHERE id = v_emp_id;

  -- se a competência já chegou, ativa imediatamente
  IF v_competencia <= to_char(CURRENT_DATE, 'YYYY-MM') THEN
    UPDATE public.empresas
       SET status_implantacao = 'ativo',
           primeiro_fechamento_em = COALESCE(primeiro_fechamento_em, now()),
           updated_at = now()
     WHERE id = v_emp_id;
  END IF;

  UPDATE public.implantacao_anexos
     SET empresa_id = v_emp_id
   WHERE implantacao_id = p_impl AND empresa_id IS NULL;

  UPDATE public.implantacoes_contratos
     SET status = 'implantado', progresso = 100,
         empresa_id = v_emp_id,
         implantado_em = now(), implantado_por = v_uid, implantado_por_nome = v_nome,
         updated_at = now()
   WHERE id = p_impl;

  PERFORM public._log_impl(p_impl, 'implantado',
    jsonb_build_object('por', v_nome, 'empresa_id', v_emp_id, 'primeira_competencia', v_competencia));

  UPDATE public.implantacao_alertas
     SET status = 'Finalizado', finalizado_em = now(), updated_at = now()
   WHERE implantacao_id = p_impl AND destinatario_role = 'comum' AND status = 'Pendente';

  RETURN v_emp_id;
END
$$;

-- 6. Cron diário para ativar contratos
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('ativar-contratos-recem-implantados');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'ativar-contratos-recem-implantados',
      '0 3 * * *',
      $cron$ SELECT public.ativar_contratos_pendentes(); $cron$
    );
  END IF;
END $$;
